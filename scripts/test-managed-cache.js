"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const managedTemp = require("./lib/managed-temp.js");
const cache = require("./lib/managed-cache.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-cache-test-"));
const projects = [];
function project(name) {
  const root = path.join(fixture, name);
  fs.mkdirSync(root, { recursive: true });
  projects.push(root);
  return root;
}
function ownerPath(run) { return path.join(run.root, managedTemp.OWNER_FILE); }
function setRunOwner(run, update) {
  const file = ownerPath(run);
  const owner = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(owner, update);
  fs.writeFileSync(file, `${JSON.stringify(owner)}\n`);
}
function leaseFiles(cachePath) {
  const dir = path.join(path.dirname(cachePath), ".leases", path.basename(cachePath));
  return fs.existsSync(dir) ? fs.readdirSync(dir).map(name => path.join(dir, name)) : [];
}
function cleanup() {
  for (const root of projects) {
    const directory = cache.cachePath(root, "npm");
    const namespace = path.dirname(directory);
    const expected = path.join(cache.cacheBase(), require("crypto").createHash("sha256").update(fs.realpathSync(root), "utf8").digest("hex").slice(0, 32));
    assert.strictEqual(path.resolve(namespace), path.resolve(expected), "cache fixture cleanup must stay in its exact hashed namespace");
    if (fs.existsSync(namespace)) {
      managedTemp.assertNoLinks(namespace);
      fs.rmSync(namespace, { recursive: true, force: true });
    }
    const tempBase = managedTemp.managedBase(root);
    if (fs.existsSync(tempBase)) {
      managedTemp.assertNoLinks(tempBase);
      fs.rmSync(tempBase, { recursive: true, force: true });
    }
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}

async function main() {
  const root = project("reuse-and-evict");
  const run = managedTemp.createRun(root);
  const otherProject = project("cache-owner-mismatch");
  assert.throws(() => cache.acquireCache(otherProject, "npm", { runRoot: run.root }), /same canonical project/);
  assert(!fs.existsSync(cache.cachePath(otherProject, "npm")), "cross-project refusal must not allocate a cache");
  const first = cache.acquireCache(root, "node-compile", { runRoot: run.root, maxBytes: 1024 * 1024 });
  assert.strictEqual(first.path, cache.cachePath(root, "node-compile"));
  fs.writeFileSync(path.join(first.path, "compile.bin"), Buffer.alloc(64, 7));
  const marker = JSON.parse(fs.readFileSync(path.join(first.path, cache.CACHE_MARKER), "utf8"));
  assert.strictEqual(marker.projectRoot, fs.realpathSync(root));
  assert.match(marker.projectHash, /^[0-9a-f]{64}$/u);
  assert.strictEqual(marker.kind, "node-compile");
  assert.deepStrictEqual(first.release(), { released: true });

  const reused = cache.acquireCache(root, "node-compile", { runRoot: run.root, maxBytes: 1024 * 1024 });
  assert.strictEqual(reused.path, first.path, "repeated acquisitions should reuse a stable cache directory");
  assert(fs.existsSync(path.join(reused.path, "compile.bin")));
  assert.deepStrictEqual(reused.release(), { released: true });
  const evicted = cache.pruneCaches({ projectRoot: root, maxBytes: 0, maxAgeMs: 7 * 24 * 60 * 60 * 1000, budgetMs: 1000 });
  assert(evicted.removed.some(item => item.path === first.path), "idle cache over the byte budget was not evicted");
  assert(evicted.bytesFreed >= 64);
  assert(!fs.existsSync(first.path));
  const plateau = cache.pruneCaches({ projectRoot: root, maxBytes: 0, budgetMs: 1000 });
  assert.strictEqual(plateau.bytesFreed, 0, "repeated prune should plateau after the owned cache is removed");
  assert(run.finish().removed);

  const claimRoot = project("stale-claim");
  const claimRun = managedTemp.createRun(claimRoot);
  const claimCache = cache.acquireCache(claimRoot, "npm", { runRoot: claimRun.root });
  claimCache.release();
  const claimFile = path.join(cache.cacheBase(), ".operation.claim");
  let createdClaim = false;
  try {
    const fd = fs.openSync(claimFile, "wx", 0o600);
    createdClaim = true;
    try { fs.writeFileSync(fd, JSON.stringify({ version: 1, pid: 2147483647, token: "stale-test-claim" })); }
    finally { fs.closeSync(fd); }
    const claimResult = cache.pruneCaches({ projectRoot: claimRoot, maxBytes: 0 });
    assert.strictEqual(claimResult.reason, "stale-operation-claim-requires-manual-recovery");
    assert(fs.existsSync(claimCache.path), "stale operation claim must not permit cache deletion");
  } finally { if (createdClaim) fs.unlinkSync(claimFile); }
  assert(cache.pruneCaches({ projectRoot: claimRoot, maxBytes: 0 }).removed.some(item => item.path === claimCache.path));
  assert(claimRun.finish().removed);

  const oldestRoot = project("oldest-first");
  const oldestRun = managedTemp.createRun(oldestRoot);
  const oldest = cache.acquireCache(oldestRoot, "npm", { runRoot: oldestRun.root });
  fs.writeFileSync(path.join(oldest.path, "old.dat"), Buffer.alloc(32, 1));
  oldest.release();
  const newer = cache.acquireCache(oldestRoot, "cargo-home", { runRoot: oldestRun.root });
  fs.writeFileSync(path.join(newer.path, "new.dat"), Buffer.alloc(32, 2));
  newer.release();
  const oldMarkerPath = path.join(oldest.path, cache.CACHE_MARKER);
  const oldMarker = JSON.parse(fs.readFileSync(oldMarkerPath, "utf8"));
  oldMarker.lastUsedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(oldMarkerPath, JSON.stringify(oldMarker));
  const currentSizes = cache.status().filter(item => item.projectRoot === fs.realpathSync(oldestRoot));
  const newerBytes = currentSizes.find(item => item.kind === "cargo-home").bytes;
  const oldestPrune = cache.pruneCaches({ projectRoot: oldestRoot, maxBytes: newerBytes, maxAgeMs: 30 * 24 * 60 * 60 * 1000, budgetMs: 1000 });
  assert(oldestPrune.removed.some(item => item.path === oldest.path), "oldest idle cache should be evicted first");
  assert(!oldestPrune.removed.some(item => item.path === newer.path), "newer cache should survive when oldest eviction meets the budget");
  assert(fs.existsSync(newer.path));
  assert(oldestRun.finish().removed);

  const liveRoot = project("live-supervisor");
  const liveRun = managedTemp.createRun(liveRoot);
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const childClosed = new Promise(resolve => child.once("close", resolve));
  liveRun.setChildPid(child.pid);
  const liveCache = cache.acquireCache(liveRoot, "cargo-home", { runRoot: liveRun.root, maxBytes: 1024 * 1024 });
  const liveLeaseFile = leaseFiles(liveCache.path)[0];
  const liveLease = JSON.parse(fs.readFileSync(liveLeaseFile, "utf8"));
  liveLease.pid = 2147483647;
  fs.writeFileSync(liveLeaseFile, JSON.stringify(liveLease));
  setRunOwner(liveRun, { pid: 2147483647 });
  try {
    const protectedReport = cache.pruneCaches({ projectRoot: liveRoot, maxBytes: 0, budgetMs: 1000 });
    assert(protectedReport.retained.some(item => item.path === liveCache.path && item.reason === "active-lease"));
    assert(protectedReport.activeOverBudget, "live supervisor cache over budget was not surfaced");
    assert(fs.existsSync(liveCache.path));
  } finally {
    child.kill();
    await childClosed;
  }
  setRunOwner(liveRun, { childPid: null, childGroup: false, launching: false });
  const stale = cache.pruneCaches({ projectRoot: liveRoot, maxBytes: 0, budgetMs: 1000 });
  assert(stale.removed.some(item => item.path === liveCache.path), "cache lease with a known stale run was not recovered");
  assert(managedTemp.sweep(liveRoot).removed.includes(liveRun.id));

  const sweptRoot = project("swept-run-bound-supervisor");
  const sweptRun = managedTemp.createRun(sweptRoot);
  const supervisor = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const supervisorClosed = new Promise(resolve => supervisor.once("close", resolve));
  const sweptCache = cache.acquireCache(sweptRoot, "npm", { runRoot: sweptRun.root, maxBytes: 1024 * 1024 });
  assert.deepStrictEqual(sweptCache.bindSupervisor(supervisor.pid), { bound: true, supervisorPid: supervisor.pid });
  const sweptLeaseFile = leaseFiles(sweptCache.path)[0];
  const sweptLease = JSON.parse(fs.readFileSync(sweptLeaseFile, "utf8"));
  sweptLease.pid = 2147483647;
  fs.writeFileSync(sweptLeaseFile, JSON.stringify(sweptLease));
  setRunOwner(sweptRun, { pid: 2147483647 });
  try {
    assert(managedTemp.sweep(sweptRoot).removed.includes(sweptRun.id), "scratch sweep should be able to remove a stopped run before cache pruning");
    const held = cache.pruneCaches({ projectRoot: sweptRoot, maxBytes: 0, budgetMs: 1000 });
    assert(held.retained.some(item => item.path === sweptCache.path && item.reason === "active-lease"), "bound live supervisor must protect a cache after scratch marker removal");
    assert(fs.existsSync(sweptCache.path));
  } finally {
    supervisor.kill();
    await supervisorClosed;
  }
  const recovered = cache.pruneCaches({ projectRoot: sweptRoot, maxBytes: 0, budgetMs: 1000 });
  assert(recovered.removed.some(item => item.path === sweptCache.path), "dead bound supervisor should allow recovery after the run marker was swept");

  const unboundRoot = project("swept-run-unbound-lease");
  const unboundRun = managedTemp.createRun(unboundRoot);
  const unboundCache = cache.acquireCache(unboundRoot, "npm", { runRoot: unboundRun.root, maxBytes: 1024 * 1024 });
  const unboundLeaseFile = leaseFiles(unboundCache.path)[0];
  const unboundLease = JSON.parse(fs.readFileSync(unboundLeaseFile, "utf8"));
  unboundLease.pid = 2147483647;
  fs.writeFileSync(unboundLeaseFile, JSON.stringify(unboundLease));
  setRunOwner(unboundRun, { pid: 2147483647 });
  assert(managedTemp.sweep(unboundRoot).removed.includes(unboundRun.id));
  const unbound = cache.pruneCaches({ projectRoot: unboundRoot, maxBytes: 0, budgetMs: 1000 });
  assert(unbound.retained.some(item => item.path === unboundCache.path && item.reason === "missing-or-invalid-run-owner"), "unbound missing-run lease must remain uncertain");

  const unresolvedRoot = project("unresolved-run");
  const unresolvedRun = managedTemp.createRun(unresolvedRoot);
  unresolvedRun.setLaunching(true);
  const unresolvedCache = cache.acquireCache(unresolvedRoot, "npm", { runRoot: unresolvedRun.root, maxBytes: 1024 * 1024 });
  const unresolvedLeaseFile = leaseFiles(unresolvedCache.path)[0];
  const unresolvedLease = JSON.parse(fs.readFileSync(unresolvedLeaseFile, "utf8"));
  unresolvedLease.pid = 2147483647;
  fs.writeFileSync(unresolvedLeaseFile, JSON.stringify(unresolvedLease));
  setRunOwner(unresolvedRun, { pid: 2147483647 });
  const unresolved = cache.pruneCaches({ projectRoot: unresolvedRoot, maxBytes: 0, budgetMs: 1000 });
  assert(unresolved.retained.some(item => item.path === unresolvedCache.path && item.reason === "unresolved-launch-lease"));
  assert(fs.existsSync(unresolvedCache.path), "unresolved launch lease must protect its cache");
  fs.unlinkSync(unresolvedLeaseFile);
  fs.rmSync(path.dirname(unresolvedLeaseFile), { recursive: true, force: true });
  const unresolvedRunReport = managedTemp.sweep(unresolvedRoot);
  assert(unresolvedRunReport.pending.some(item => item.reason === "unresolved-launch-lease"));
  // The explicit fixture teardown owns this unresolved test marker after its cache lease is removed.
  const unresolvedOwner = JSON.parse(fs.readFileSync(ownerPath(unresolvedRun), "utf8"));
  unresolvedOwner.launching = false;
  fs.writeFileSync(ownerPath(unresolvedRun), JSON.stringify(unresolvedOwner));
  assert(managedTemp.sweep(unresolvedRoot).removed.includes(unresolvedRun.id));
  const unresolvedEviction = cache.pruneCaches({ projectRoot: unresolvedRoot, maxBytes: 0, budgetMs: 1000 });
  assert(unresolvedEviction.removed.some(item => item.path === unresolvedCache.path));

  const linkRoot = project("linked-cache");
  const linkRun = managedTemp.createRun(linkRoot);
  const linkCache = cache.acquireCache(linkRoot, "npm", { runRoot: linkRun.root });
  const outside = path.join(fixture, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "keep.txt"), "keep");
  try {
    fs.symlinkSync(outside, path.join(linkCache.path, "linked"), process.platform === "win32" ? "junction" : "dir");
    linkCache.release();
    const linkReport = cache.pruneCaches({ projectRoot: linkRoot, maxBytes: 0, budgetMs: 1000 });
    assert(linkReport.retained.some(item => item.path === linkCache.path && item.reason === "linked-cache-entry"));
    assert(fs.existsSync(path.join(outside, "keep.txt")));
    assert(fs.existsSync(linkCache.path));
    try { fs.rmSync(path.join(linkCache.path, "linked"), { force: true }); } catch { /* fixture teardown remains link-safe */ }
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
  }
  assert(linkRun.finish().removed);

  const budgetRoot = project("budget");
  const budgetRun = managedTemp.createRun(budgetRoot);
  const budgetCache = cache.acquireCache(budgetRoot, "npm", { runRoot: budgetRun.root });
  for (let index = 0; index < 2000; index += 1) fs.writeFileSync(path.join(budgetCache.path, `item-${index}.dat`), "x");
  budgetCache.release();
  const budget = cache.pruneCaches({ projectRoot: budgetRoot, maxBytes: 0, budgetMs: 0 });
  assert(!budget.complete || budget.retained.some(item => item.reason === "budget-exhausted"));
  assert(fs.existsSync(budgetCache.path), "budget-limited prune must not delete incompletely observed cache data");
  assert(budgetRun.finish().removed);

  assert.throws(() => cache.acquireCache(root, "npm", { runRoot: path.join(root, "unknown-run") }), /Cannot bind cache lease/u);
  process.stdout.write("managed-cache focused tests passed\n");
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; }).finally(cleanup);
