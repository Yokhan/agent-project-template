"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-cache-test-"));
process.env.APT_MANAGED_CACHE_BASE = path.join(fixture, "isolated-cache-base");
const managedTemp = require("./lib/managed-temp.js");
const cache = require("./lib/managed-cache.js");
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
async function retryOperationInProgress(operation) {
  const deadline = Date.now() + 1500;
  while (true) {
    try {
      const result = operation();
      if (result?.reason !== "operation-in-progress") return result;
    } catch (error) {
      if (!error.message.endsWith("operation-in-progress")) throw error;
    }
    if (Date.now() >= deadline) throw new Error("Timed out waiting for the managed-cache fixture operation claim");
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
const acquireCache = (...args) => retryOperationInProgress(() => cache.acquireCache(...args));
const pruneCaches = (...args) => retryOperationInProgress(() => cache.pruneCaches(...args));
const releaseCache = lease => retryOperationInProgress(() => lease.release());
const bindSupervisor = (lease, pid) => retryOperationInProgress(() => lease.bindSupervisor(pid));
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

function fileManifest(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile()) files.push([path.relative(root, target), require("crypto").createHash("sha256").update(fs.readFileSync(target)).digest("hex")]);
    }
  }
  return files.sort(([left], [right]) => left.localeCompare(right));
}

function createFileLink(linkPath, target, skipped) {
  try { fs.symlinkSync(target, linkPath, "file"); return true; }
  catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) {
      skipped.push(`${path.basename(linkPath)}:${error.code}`);
      return false;
    }
    throw error;
  }
}

async function testOwnedCacheLinkEviction() {
  const outside = path.join(fixture, "cache-link-targets");
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, "manifest.json"), JSON.stringify({ keep: ["cache-target", "payload"] }) + "\n");
  fs.writeFileSync(path.join(outside, "payload.txt"), "outside cache target must not change\n");
  const beforeManifest = fileManifest(outside);
  const skippedFileLinks = [];

  const root = project("links-owned-cache");
  const run = managedTemp.createRun(root);
  const ownedCache = await acquireCache(root, "npm", { runRoot: run.root });
  const markerPath = path.join(ownedCache.path, cache.CACHE_MARKER);
  const markerBytes = fs.readFileSync(markerPath);
  const payload = Buffer.from("owned cache payload\n");
  fs.writeFileSync(path.join(ownedCache.path, "payload.txt"), payload);
  const junction = path.join(ownedCache.path, "absolute-directory-junction");
  fs.symlinkSync(outside, junction, process.platform === "win32" ? "junction" : "dir");
  assert(fs.lstatSync(junction).isSymbolicLink(), "cache directory link fixture was not created");
  createFileLink(path.join(ownedCache.path, "absolute-file-link"), path.join(outside, "payload.txt"), skippedFileLinks);
  createFileLink(path.join(ownedCache.path, "relative-file-link"), path.relative(ownedCache.path, path.join(outside, "manifest.json")), skippedFileLinks);
  createFileLink(path.join(ownedCache.path, "dangling-file-link"), path.join(outside, "missing.txt"), skippedFileLinks);
  createFileLink(path.join(ownedCache.path, "cyclic-file-link"), "cyclic-file-link", skippedFileLinks);

  const active = await pruneCaches({ projectRoot: root, maxBytes: 0, budgetMs: 1000 });
  assert(active.retained.some(item => item.path === ownedCache.path && item.reason === "active-lease"), "cache links bypassed the live lease barrier");
  assert(fs.lstatSync(junction).isSymbolicLink(), "active cache link was removed despite its lease");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);

  assert.deepStrictEqual(await releaseCache(ownedCache), { released: true });
  const markerSize = fs.statSync(markerPath).size;
  const evicted = await pruneCaches({ projectRoot: root, maxBytes: 0, budgetMs: 1000 });
  assert(evicted.complete, `link-bearing owned cache eviction was incomplete: ${JSON.stringify(evicted.retained)}`);
  assert(evicted.removed.some(item => item.path === ownedCache.path), "inactive owned cache with descendant links was not evicted");
  assert.strictEqual(evicted.bytesObserved, markerSize + payload.length, "link targets or link metadata were counted as cache payload bytes");
  assert.strictEqual(evicted.bytesFreed, markerSize + payload.length);
  assert.strictEqual(evicted.filesFreed, 2, "only regular payload files and the cache marker should count as files");
  assert(!fs.existsSync(ownedCache.path));
  assert.deepStrictEqual(fileManifest(outside), beforeManifest, "cache eviction changed a link target");
  assert(run.finish().removed);

  const markerRoot = project("linked-cache-owner-marker");
  const markerRun = managedTemp.createRun(markerRoot);
  const markerCache = await acquireCache(markerRoot, "npm", { runRoot: markerRun.root });
  const ownedMarker = path.join(markerCache.path, cache.CACHE_MARKER);
  const ownedMarkerBytes = fs.readFileSync(ownedMarker);
  assert.deepStrictEqual(await releaseCache(markerCache), { released: true });
  fs.unlinkSync(ownedMarker);
  fs.symlinkSync(outside, ownedMarker, process.platform === "win32" ? "junction" : "dir");
  const markerRejected = await pruneCaches({ projectRoot: markerRoot, maxBytes: 0, budgetMs: 1000 });
  assert(!markerRejected.removed.some(item => item.path === markerCache.path), "cache owner marker link was accepted for eviction");
  assert(fs.lstatSync(ownedMarker).isSymbolicLink());
  assert(fs.existsSync(markerCache.path));
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  fs.unlinkSync(ownedMarker);
  fs.writeFileSync(ownedMarker, ownedMarkerBytes);
  const markerRetry = await pruneCaches({ projectRoot: markerRoot, maxBytes: 0, budgetMs: 1000 });
  assert(markerRetry.removed.some(item => item.path === markerCache.path));
  assert(markerRun.finish().removed);

  const ancestorRoot = project("linked-cache-ancestor");
  const namespace = path.dirname(cache.cachePath(ancestorRoot, "npm"));
  fs.mkdirSync(cache.cacheBase(), { recursive: true });
  const ancestorTarget = path.join(fixture, "cache-ancestor-target");
  fs.mkdirSync(ancestorTarget, { recursive: true });
  fs.writeFileSync(path.join(ancestorTarget, "manifest.json"), "ancestor target\n");
  const beforeAncestor = fileManifest(ancestorTarget);
  fs.symlinkSync(ancestorTarget, namespace, process.platform === "win32" ? "junction" : "dir");
  try {
    const ancestorReport = cache.pruneCaches({ projectRoot: ancestorRoot, maxBytes: 0, budgetMs: 1000 });
    assert(!ancestorReport.removed.some(item => path.resolve(item.path) === path.resolve(cache.cachePath(ancestorRoot, "npm"))),
      "cache namespace ancestor link was followed or accepted for eviction");
    assert(fs.lstatSync(namespace).isSymbolicLink(), "cache namespace ancestor link was modified");
    assert.deepStrictEqual(fileManifest(ancestorTarget), beforeAncestor);
  } finally { fs.unlinkSync(namespace); }

  const budgetRoot = project("linked-cache-budget");
  const budgetRun = managedTemp.createRun(budgetRoot);
  const budgetCache = await acquireCache(budgetRoot, "npm", { runRoot: budgetRun.root });
  fs.symlinkSync(outside, path.join(budgetCache.path, "budget-link"), process.platform === "win32" ? "junction" : "dir");
  assert.deepStrictEqual(await releaseCache(budgetCache), { released: true });
  const budget = await pruneCaches({ projectRoot: budgetRoot, maxBytes: 0, budgetMs: 0 });
  assert(!budget.complete && budget.reason === "budget-exhausted");
  assert(fs.existsSync(budgetCache.path), "incomplete link-bearing inventory removed its authenticated cache marker");
  assert(fs.existsSync(path.join(budgetCache.path, cache.CACHE_MARKER)));
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  const retry = await pruneCaches({ projectRoot: budgetRoot, maxBytes: 0, budgetMs: 1000 });
  assert(retry.removed.some(item => item.path === budgetCache.path), "cache retry did not evict the owned link-bearing cache");
  assert(budgetRun.finish().removed);

  const errorRoot = project("linked-cache-unlink-error");
  const errorRun = managedTemp.createRun(errorRoot);
  const errorCache = await acquireCache(errorRoot, "npm", { runRoot: errorRun.root });
  const errorPayloadPath = path.join(errorCache.path, "payload.txt");
  const errorPayload = Buffer.from("cache partial accounting payload\n");
  fs.writeFileSync(errorPayloadPath, errorPayload);
  const errorLink = path.join(errorCache.path, "error-link");
  fs.symlinkSync(outside, errorLink, process.platform === "win32" ? "junction" : "dir");
  assert.deepStrictEqual(await releaseCache(errorCache), { released: true });
  const originalUnlink = fs.unlinkSync;
  let injectedUnlinkFailure = false;
  fs.unlinkSync = function (target, ...args) {
    if (!injectedUnlinkFailure && path.resolve(String(target)) === path.resolve(errorLink)) {
      injectedUnlinkFailure = true;
      const error = new Error("injected cache-link unlink failure");
      error.code = "EACCES";
      throw error;
    }
    return originalUnlink.call(this, target, ...args);
  };
  let unlinkFailure;
  try { unlinkFailure = await pruneCaches({ projectRoot: errorRoot, maxBytes: 0, budgetMs: 1000 }); }
  finally { fs.unlinkSync = originalUnlink; }
  assert(injectedUnlinkFailure, "cache link unlink failure injection did not execute");
  assert(!unlinkFailure.complete && unlinkFailure.retained.some(item => item.path === errorCache.path), "cache unlink error did not retain the cache");
  assert(fs.existsSync(path.join(errorCache.path, cache.CACHE_MARKER)), "cache unlink error removed its owner marker");
  assert(fs.lstatSync(errorLink).isSymbolicLink(), "failed cache unlink changed the link entry");
  assert.strictEqual(unlinkFailure.bytesFreed, fs.existsSync(errorPayloadPath) ? 0 : errorPayload.length,
    "cache failure accounting disagreed with regular payload entries already removed");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  const errorRetry = await pruneCaches({ projectRoot: errorRoot, maxBytes: 0, budgetMs: 1000 });
  assert(errorRetry.removed.some(item => item.path === errorCache.path), "cache retry did not evict the owned link-bearing cache");
  assert(errorRun.finish().removed);

  assert.deepStrictEqual(fileManifest(outside), beforeManifest, "a cache link case changed target bytes");
  process.stdout.write(skippedFileLinks.length
    ? `file-symlink subcases unavailable on this host: ${skippedFileLinks.join(", ")}\n`
    : "file-symlink subcases: absolute, relative, dangling, and cyclic verified\n");
  process.stdout.write("owned-cache link eviction focused tests passed (directory junction required and verified)\n");
}
function spawnObserved(args, env) {
  const child = spawn(process.execPath, args, { cwd: path.resolve(__dirname, ".."), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk.toString(); });
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  return { child, done: new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }))) };
}

async function main() {
  if (process.argv.includes("--links-only")) { await testOwnedCacheLinkEviction(); return; }
  const identityBusy = cache.__testing.readIdentityUnderMutex({ prepare: () => ({ get: () => { const error = new Error("database is locked"); error.code = "ERR_SQLITE_ERROR"; throw error; } }) });
  assert.deepStrictEqual(identityBusy, { busy: true, reason: "operation-in-progress" }, "SQLite BUSY during identity read must remain retryable");

  const firstOwnerBase = path.join(fixture, "brand-new-coordinator");
  const firstOwnerCode = "const c=require('./scripts/lib/managed-cache.js');const lock=c.__testing.acquireGate(c.cacheBase());if(lock.busy)throw Error(lock.reason);process.stdout.write('first-owner-holding\\n');setInterval(()=>{},1000);";
  const firstOwnerEnv = { ...process.env, APT_MANAGED_CACHE_BASE: firstOwnerBase };
  const firstOwner = spawn(process.execPath, ["-e", firstOwnerCode], { cwd: path.resolve(__dirname, ".."), env: firstOwnerEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let firstOwnerStdout = "", firstOwnerStderr = "";
  firstOwner.stdout.on("data", chunk => { firstOwnerStdout += chunk.toString(); });
  firstOwner.stderr.on("data", chunk => { firstOwnerStderr += chunk.toString(); });
  const firstOwnerClosed = new Promise(resolve => firstOwner.once("close", (code, signal) => resolve({ code, signal })));
  await new Promise((resolve, reject) => {
    firstOwner.stdout.on("data", () => { if (firstOwnerStdout.includes("first-owner-holding\n")) resolve(); });
    firstOwner.once("error", reject);
    firstOwner.once("close", (code, signal) => { if (!firstOwnerStdout.includes("first-owner-holding\n")) reject(new Error(`brand-new coordinator owner exited before lock (${code}, ${signal}): ${firstOwnerStderr}`)); });
  });
  firstOwner.kill();
  await firstOwnerClosed;
  process.env.APT_MANAGED_CACHE_BASE = firstOwnerBase;
  const firstOwnerRecovery = await cache.pruneCaches();
  assert(firstOwnerRecovery.complete, "first-ever coordinator owner may die after locking without losing the committed database identity");
  process.env.APT_MANAGED_CACHE_BASE = path.join(fixture, "isolated-cache-base");

  const deadInitBase = path.join(fixture, "dead-init-coordinator");
  fs.mkdirSync(deadInitBase, { recursive: true });
  const deadInitDb = new (require("node:sqlite").DatabaseSync)(path.join(deadInitBase, ".operation.sqlite"));
  const deadInitIdentity = require("crypto").randomUUID();
  deadInitDb.exec("PRAGMA synchronous=FULL; BEGIN IMMEDIATE; CREATE TABLE coordinator_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  deadInitDb.prepare("INSERT INTO coordinator_meta(key,value) VALUES('identity',?)").run(deadInitIdentity);
  deadInitDb.exec("COMMIT"); deadInitDb.close();
  const deadInitFile = path.join(deadInitBase, ".operation.sqlite.init");
  const deadInitBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: require("crypto").randomUUID(), createdAt: new Date().toISOString() })}\n`);
  fs.writeFileSync(deadInitFile, deadInitBytes, { flag: "wx" });
  const deadInitCode = "const r=require('./scripts/lib/managed-cache.js').pruneCaches();if(!r.complete&&r.reason!=='operation-in-progress')throw Error(JSON.stringify(r));process.stdout.write('ok\\n');";
  const deadInitEnv = { ...process.env, APT_MANAGED_CACHE_BASE: deadInitBase };
  const deadInitChildren = [spawnObserved(["-e", deadInitCode], deadInitEnv), spawnObserved(["-e", deadInitCode], deadInitEnv)];
  const deadInitResults = await Promise.all(deadInitChildren.map(item => item.done));
  assert(deadInitResults.every(result => result.code === 0), `same stale init marker contention failed: ${JSON.stringify(deadInitResults)}`);
  assert(!fs.existsSync(deadInitFile), "one mutex owner should clear only the unchanged dead init marker");
  const validatedDeadInitDb = new (require("node:sqlite").DatabaseSync)(path.join(deadInitBase, ".operation.sqlite"), { readOnly: true });
  assert.strictEqual(validatedDeadInitDb.prepare("SELECT value FROM coordinator_meta WHERE key='identity'").get().value, deadInitIdentity);
  validatedDeadInitDb.close();

  const unlinkFailureBase = path.join(fixture, "init-unlink-failure");
  fs.mkdirSync(unlinkFailureBase, { recursive: true });
  const unlinkDbPath = path.join(unlinkFailureBase, ".operation.sqlite");
  const unlinkSetupDb = new (require("node:sqlite").DatabaseSync)(unlinkDbPath);
  unlinkSetupDb.exec("PRAGMA synchronous=FULL; BEGIN IMMEDIATE; CREATE TABLE coordinator_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  unlinkSetupDb.prepare("INSERT INTO coordinator_meta(key,value) VALUES('identity',?)").run(require("crypto").randomUUID());
  unlinkSetupDb.exec("COMMIT"); unlinkSetupDb.close();
  const unlinkInitFile = path.join(unlinkFailureBase, ".operation.sqlite.init");
  const unlinkInitBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: require("crypto").randomUUID(), createdAt: new Date().toISOString() })}\n`);
  fs.writeFileSync(unlinkInitFile, unlinkInitBytes, { flag: "wx" });
  const originalUnlinkSync = fs.unlinkSync;
  fs.unlinkSync = function (target, ...args) {
    if (path.resolve(String(target)) === path.resolve(unlinkInitFile)) { const error = new Error("injected init marker unlink failure"); error.code = "EACCES"; throw error; }
    return originalUnlinkSync.call(this, target, ...args);
  };
  try { assert.throws(() => cache.__testing.acquireGate(unlinkFailureBase), error => error.code === "EACCES" && /injected init marker unlink failure/u.test(error.message)); }
  finally { fs.unlinkSync = originalUnlinkSync; }
  assert(fs.readFileSync(unlinkInitFile).equals(unlinkInitBytes), "failed init marker unlink must preserve the exact marker");
  const postFailureDb = new (require("node:sqlite").DatabaseSync)(unlinkDbPath, { timeout: 0 });
  postFailureDb.exec("PRAGMA busy_timeout=0; BEGIN IMMEDIATE; ROLLBACK;");
  postFailureDb.close();

  const root = project("reuse-and-evict");
  const run = managedTemp.createRun(root);
  const otherProject = project("cache-owner-mismatch");
  assert.throws(() => cache.acquireCache(otherProject, "npm", { runRoot: run.root }), /same canonical project/);
  assert(!fs.existsSync(cache.cachePath(otherProject, "npm")), "cross-project refusal must not allocate a cache");
  const first = await acquireCache(root, "node-compile", { runRoot: run.root, maxBytes: 1024 * 1024 });
  assert.strictEqual(first.path, cache.cachePath(root, "node-compile"));
  fs.writeFileSync(path.join(first.path, "compile.bin"), Buffer.alloc(64, 7));
  const marker = JSON.parse(fs.readFileSync(path.join(first.path, cache.CACHE_MARKER), "utf8"));
  assert.strictEqual(marker.projectRoot, fs.realpathSync(root));
  assert.match(marker.projectHash, /^[0-9a-f]{64}$/u);
  assert.strictEqual(marker.kind, "node-compile");
  assert.deepStrictEqual(await releaseCache(first), { released: true });

  const reused = await acquireCache(root, "node-compile", { runRoot: run.root, maxBytes: 1024 * 1024 });
  assert.strictEqual(reused.path, first.path, "repeated acquisitions should reuse a stable cache directory");
  assert(fs.existsSync(path.join(reused.path, "compile.bin")));
  assert.deepStrictEqual(await releaseCache(reused), { released: true });
  const evicted = await pruneCaches({ projectRoot: root, maxBytes: 0, maxAgeMs: 7 * 24 * 60 * 60 * 1000, budgetMs: 1000 });
  assert(evicted.removed.some(item => item.path === first.path), "idle cache over the byte budget was not evicted");
  assert(evicted.bytesFreed >= 64);
  assert(!fs.existsSync(first.path));
  const plateau = await pruneCaches({ projectRoot: root, maxBytes: 0, budgetMs: 1000 });
  assert.strictEqual(plateau.bytesFreed, 0, "repeated prune should plateau after the owned cache is removed");
  assert(run.finish().removed);

  const retryRoot = project("transient-operation-claim");
  const retryRun = managedTemp.createRun(retryRoot);
  const claimHolder = spawn(process.execPath, ["-e", "const fs=require('fs'),path=require('path'),crypto=require('crypto');const file=path.join(process.argv[1],'.operation.claim');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({version:1,pid:process.pid,token:crypto.randomUUID(),createdAt:new Date().toISOString()}),{flag:'wx'});process.stdout.write('ready\\n');setTimeout(()=>fs.unlinkSync(file),200);", cache.cacheBase()], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const claimHolderClosed = new Promise((resolve, reject) => {
    claimHolder.once("error", reject);
    claimHolder.once("close", code => code === 0 ? resolve() : reject(new Error(`operation-claim fixture exited with ${code}`)));
  });
  await new Promise((resolve, reject) => {
    let output = "";
    claimHolder.stdout.on("data", chunk => {
      output += chunk.toString();
      if (output.includes("ready\n")) resolve();
    });
    claimHolder.once("error", reject);
    claimHolder.once("close", code => { if (code !== 0 && !output.includes("ready\n")) reject(new Error(`operation-claim fixture exited before ready (${code})`)); });
  });
  let observedRetry = false;
  const retryLease = await retryOperationInProgress(() => {
    try { return cache.acquireCache(retryRoot, "npm", { runRoot: retryRun.root }); }
    catch (error) {
      if (error.message.endsWith("operation-in-progress")) observedRetry = true;
      throw error;
    }
  });
  assert(observedRetry, "fixture must observe a live operation claim before succeeding");
  assert.deepStrictEqual(await releaseCache(retryLease), { released: true });
  await claimHolderClosed;
  assert(retryRun.finish().removed);

  const crashedRoot = project("killed-sqlite-coordinator");
  const crashedRun = managedTemp.createRun(crashedRoot);
  const holdCode = "const c=require('./scripts/lib/managed-cache.js');const lock=c.__testing.acquireGate(c.cacheBase());if(lock.busy)throw Error(lock.reason);process.stdout.write('holding\\n');setInterval(()=>{},1000);";
  const mutexHolder = spawn(process.execPath, ["-e", holdCode, cache.cacheBase()], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const mutexClosed = new Promise(resolve => mutexHolder.once("close", resolve));
  await new Promise((resolve, reject) => {
    let output = "";
    mutexHolder.stdout.on("data", chunk => { output += chunk.toString(); if (output.includes("holding\n")) resolve(); });
    mutexHolder.once("error", reject);
    mutexHolder.once("close", code => { if (code !== 0 && !output.includes("holding\n")) reject(new Error(`SQLite mutex fixture exited before ready (${code})`)); });
  });
  mutexHolder.kill();
  await mutexClosed;
  const recoveredLease = await acquireCache(crashedRoot, "npm", { runRoot: crashedRun.root });
  assert.deepStrictEqual(await releaseCache(recoveredLease), { released: true }, "new client should recover only the dead matching v2 coordinator claim");
  assert(fs.readdirSync(cache.cacheBase()).some(name => name.startsWith(".operation-recovered-")), "dead v2 coordinator bytes must be quarantined with a receipt");
  assert(crashedRun.finish().removed);

  const raceRoot = project("recover-acquire-race");
  const raceRun = managedTemp.createRun(raceRoot);
  const raceClaimFile = path.join(cache.cacheBase(), cache.OPERATION_CLAIM);
  const raceBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: require("crypto").randomUUID(), createdAt: new Date().toISOString() })}\n`);
  fs.writeFileSync(raceClaimFile, raceBytes, { flag: "wx" });
  const raceHash = require("crypto").createHash("sha256").update(raceBytes).digest("hex");
  const raceRecoveryCode = "const c=require('./scripts/lib/managed-cache.js'),until=Date.now()+3000;while(Date.now()<until){try{c.recoverLegacyClaim(process.argv[1],2147483647);process.stdout.write('recovered\\n');process.exit(0)}catch(e){if(!/operation-in-progress/u.test(e.message))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20)}}throw Error('recovery timed out waiting for coordinator mutex');";
  const raceAcquireCode = "const c=require('./scripts/lib/managed-cache.js');const until=Date.now()+3000;let lease;while(Date.now()<until){try{lease=c.acquireCache(process.argv[1],'npm',{runRoot:process.argv[2]});break}catch(e){if(!/stale-operation-claim-requires-manual-recovery|operation-in-progress/u.test(e.message))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20)}}if(!lease)throw Error('acquire did not proceed after explicit recovery');lease.release();";
  const raceEnv = { ...process.env, APT_MANAGED_CACHE_BASE: cache.cacheBase() };
  const raceRecovery = spawnObserved(["-e", raceRecoveryCode, raceHash], raceEnv);
  const raceAcquire = spawnObserved(["-e", raceAcquireCode, raceRoot, raceRun.root], raceEnv);
  const raceResults = await Promise.all([raceRecovery.done, raceAcquire.done]);
  assert(raceResults.every(result => result.code === 0), `recovery/acquire race failed: ${JSON.stringify(raceResults)}`);
  assert(!fs.existsSync(raceClaimFile), "serialized explicit recovery and new acquisition should leave no coordinator claim");
  assert(raceRun.finish().removed);

  const interruptedFile = path.join(cache.cacheBase(), cache.OPERATION_CLAIM);
  const interruptedToken = require("crypto").randomUUID();
  const interruptedBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: interruptedToken, createdAt: new Date().toISOString() })}\n`);
  fs.writeFileSync(interruptedFile, interruptedBytes, { flag: "wx" });
  const interruptedHash = require("crypto").createHash("sha256").update(interruptedBytes).digest("hex");
  const interruptAfterRenameCode = "const fs=require('fs'),path=require('path'),crypto=require('crypto');const {DatabaseSync}=require('node:sqlite');const base=process.argv[1],db=new DatabaseSync(path.join(base,'.operation.sqlite'));db.exec('BEGIN IMMEDIATE');const identity=db.prepare(\"SELECT value FROM coordinator_meta WHERE key='identity'\").get().value;const file=path.join(base,'.operation.claim'),bytes=fs.readFileSync(file),archive=path.join(base,'.operation-recovery-'+Date.now()+'-'+crypto.randomUUID());const intent={version:1,action:'explicit-legacy-v1-recovery',pid:2147483647,databaseIdentity:identity,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString()};fs.mkdirSync(archive,{mode:0o700});fs.writeFileSync(path.join(archive,'intent.json'),JSON.stringify(intent)+'\\n',{flag:'wx'});fs.renameSync(file,path.join(archive,'.operation.claim'));process.stdout.write('renamed\\n');setInterval(()=>{},1000);";
  const interruptedEnv = { ...process.env, APT_MANAGED_CACHE_BASE: cache.cacheBase() };
  const interrupted = spawn(process.execPath, ["-e", interruptAfterRenameCode, cache.cacheBase()], { cwd: path.resolve(__dirname, ".."), env: interruptedEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const interruptedClosed = new Promise(resolve => interrupted.once("close", resolve));
  await new Promise((resolve, reject) => {
    let output = "", errorOutput = "";
    interrupted.stdout.on("data", chunk => { output += chunk.toString(); if (output.includes("renamed\n")) resolve(); });
    interrupted.stderr.on("data", chunk => { errorOutput += chunk.toString(); });
    interrupted.once("error", reject);
    interrupted.once("close", code => { if (code !== 0 && !output.includes("renamed\n")) reject(new Error(`recovery interruption fixture exited before rename (${code}): ${errorOutput}`)); });
  });
  interrupted.kill();
  await interruptedClosed;
  assert(!fs.existsSync(interruptedFile), "controlled crash must occur after atomic archive rename");
  const resumedPrune = await pruneCaches({ maxBytes: cache.DEFAULT_MAX_BYTES });
  assert(resumedPrune.complete, "next coordinator acquisition must complete an intent-backed archive receipt");
  const resumedArchive = fs.readdirSync(cache.cacheBase()).filter(name => name.startsWith(".operation-recovery-")).map(name => path.join(cache.cacheBase(), name)).find(directory => {
    try { return JSON.parse(fs.readFileSync(path.join(directory, "intent.json"), "utf8")).sha256 === interruptedHash; } catch { return false; }
  });
  assert(resumedArchive, "interrupted archive should remain identifiable");
  const resumedReceipt = JSON.parse(fs.readFileSync(path.join(resumedArchive, "receipt.json"), "utf8"));
  assert.strictEqual(resumedReceipt.sha256, interruptedHash);
  assert(!JSON.stringify(resumedReceipt).includes(interruptedToken), "recovery receipts must not contain the raw marker nonce");

  const claimRoot = project("stale-claim");
  const claimRun = managedTemp.createRun(claimRoot);
  const claimCache = await acquireCache(claimRoot, "npm", { runRoot: claimRun.root });
  await releaseCache(claimCache);
  const protectedPayload = path.join(claimCache.path, "payload.bin");
  fs.writeFileSync(protectedPayload, "keep-payload");
  const leaseDirBeforeRecovery = path.join(path.dirname(claimCache.path), ".leases", path.basename(claimCache.path));
  const leaseNamesBeforeRecovery = fs.existsSync(leaseDirBeforeRecovery) ? fs.readdirSync(leaseDirBeforeRecovery) : [];
  const claimFile = path.join(cache.cacheBase(), ".operation.claim");
  let createdClaim = false;
  try {
    const fd = fs.openSync(claimFile, "wx", 0o600);
    createdClaim = true;
    try { fs.writeFileSync(fd, JSON.stringify({ version: 1, pid: 2147483647, token: require("crypto").randomUUID(), createdAt: new Date().toISOString() })); }
    finally { fs.closeSync(fd); }
    const claimResult = await pruneCaches({ projectRoot: claimRoot, maxBytes: 0 });
    assert.strictEqual(claimResult.reason, "stale-operation-claim-requires-manual-recovery");
    assert(fs.existsSync(claimCache.path), "stale operation claim must not permit cache deletion");
    const staleBytes = fs.readFileSync(claimFile);
    const staleHash = require("crypto").createHash("sha256").update(staleBytes).digest("hex");
    assert.throws(() => cache.recoverLegacyClaim("0".repeat(64), 2147483647), /exact expected hash\/PID/u);
    assert.throws(() => cache.recoverLegacyClaim(staleHash, process.pid), /exact expected hash\/PID/u);
    const originalKill = process.kill;
    process.kill = (pid, signal) => { if (pid === 2147483647 && signal === 0) { const error = new Error("permission denied"); error.code = "EPERM"; throw error; } return originalKill(pid, signal); };
    try { assert.throws(() => cache.recoverLegacyClaim(staleHash, 2147483647), /live or its death could not be confirmed/u); }
    finally { process.kill = originalKill; }
    const recovery = cache.recoverLegacyClaim(staleHash, 2147483647);
    assert(recovery.recovered);
    assert(!JSON.stringify(recovery).includes(JSON.parse(staleBytes.toString("utf8")).token), "recovery result must not expose the raw claim nonce");
    assert(fs.readFileSync(path.join(recovery.archive, cache.OPERATION_CLAIM)).equals(staleBytes), "legacy recovery must retain exact marker bytes");
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(recovery.archive, "receipt.json"), "utf8")).sha256, staleHash);
    assert(!fs.existsSync(claimFile));
    assert.strictEqual(fs.readFileSync(protectedPayload, "utf8"), "keep-payload", "mutex recovery must not alter cache payload");
    assert.deepStrictEqual(fs.existsSync(leaseDirBeforeRecovery) ? fs.readdirSync(leaseDirBeforeRecovery) : [], leaseNamesBeforeRecovery, "mutex recovery must not alter cache leases");
    const cliToken = require("crypto").randomUUID();
    const cliBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: cliToken, createdAt: new Date().toISOString() })}\n`);
    fs.writeFileSync(claimFile, cliBytes, { flag: "wx" });
    const cliHash = require("crypto").createHash("sha256").update(cliBytes).digest("hex");
    const cli = spawnSync(process.execPath, [path.resolve(__dirname, "managed-temp.js"), "cache-recover", "--expected-sha256", cliHash, "--pid", "2147483647"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, APT_MANAGED_CACHE_BASE: cache.cacheBase() }, encoding: "utf8" });
    assert.strictEqual(cli.status, 0, `cache-recover CLI failed: ${cli.stderr}`);
    assert(!cli.stdout.includes(cliToken), "cache-recover CLI output must not expose the raw claim nonce");
  } finally { if (createdClaim && fs.existsSync(claimFile)) fs.unlinkSync(claimFile); }
  assert((await pruneCaches({ projectRoot: claimRoot, maxBytes: 0 })).removed.some(item => item.path === claimCache.path));
  assert(claimRun.finish().removed);

  const oldestRoot = project("oldest-first");
  const oldestRun = managedTemp.createRun(oldestRoot);
  const oldest = await acquireCache(oldestRoot, "npm", { runRoot: oldestRun.root });
  fs.writeFileSync(path.join(oldest.path, "old.dat"), Buffer.alloc(32, 1));
  await releaseCache(oldest);
  const newer = await acquireCache(oldestRoot, "cargo-home", { runRoot: oldestRun.root });
  fs.writeFileSync(path.join(newer.path, "new.dat"), Buffer.alloc(32, 2));
  await releaseCache(newer);
  const oldMarkerPath = path.join(oldest.path, cache.CACHE_MARKER);
  const oldMarker = JSON.parse(fs.readFileSync(oldMarkerPath, "utf8"));
  oldMarker.lastUsedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(oldMarkerPath, JSON.stringify(oldMarker));
  const currentSizes = cache.status().filter(item => item.projectRoot === fs.realpathSync(oldestRoot));
  const newerBytes = currentSizes.find(item => item.kind === "cargo-home").bytes;
  const oldestPrune = await pruneCaches({ projectRoot: oldestRoot, maxBytes: newerBytes, maxAgeMs: 30 * 24 * 60 * 60 * 1000, budgetMs: 1000 });
  assert(oldestPrune.removed.some(item => item.path === oldest.path), "oldest idle cache should be evicted first");
  assert(!oldestPrune.removed.some(item => item.path === newer.path), "newer cache should survive when oldest eviction meets the budget");
  assert(fs.existsSync(newer.path));
  assert(oldestRun.finish().removed);

  const liveRoot = project("live-supervisor");
  const liveRun = managedTemp.createRun(liveRoot);
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const childClosed = new Promise(resolve => child.once("close", resolve));
  liveRun.setChildPid(child.pid);
  const liveCache = await acquireCache(liveRoot, "cargo-home", { runRoot: liveRun.root, maxBytes: 1024 * 1024 });
  const liveLeaseFile = leaseFiles(liveCache.path)[0];
  const liveLease = JSON.parse(fs.readFileSync(liveLeaseFile, "utf8"));
  liveLease.pid = 2147483647;
  fs.writeFileSync(liveLeaseFile, JSON.stringify(liveLease));
  setRunOwner(liveRun, { pid: 2147483647 });
  try {
    const protectedReport = await pruneCaches({ projectRoot: liveRoot, maxBytes: 0, budgetMs: 1000 });
    assert(protectedReport.retained.some(item => item.path === liveCache.path && item.reason === "active-lease"));
    assert(protectedReport.activeOverBudget, "live supervisor cache over budget was not surfaced");
    assert(fs.existsSync(liveCache.path));
  } finally {
    child.kill();
    await childClosed;
  }
  setRunOwner(liveRun, { childPid: null, childGroup: false, launching: false });
  const stale = await pruneCaches({ projectRoot: liveRoot, maxBytes: 0, budgetMs: 1000 });
  assert(stale.removed.some(item => item.path === liveCache.path), "cache lease with a known stale run was not recovered");
  assert(managedTemp.sweep(liveRoot).removed.includes(liveRun.id));

  const sweptRoot = project("swept-run-bound-supervisor");
  const sweptRun = managedTemp.createRun(sweptRoot);
  const supervisor = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const supervisorClosed = new Promise(resolve => supervisor.once("close", resolve));
  const sweptCache = await acquireCache(sweptRoot, "npm", { runRoot: sweptRun.root, maxBytes: 1024 * 1024 });
  assert.deepStrictEqual(await bindSupervisor(sweptCache, supervisor.pid), { bound: true, supervisorPid: supervisor.pid });
  const sweptLeaseFile = leaseFiles(sweptCache.path)[0];
  const sweptLease = JSON.parse(fs.readFileSync(sweptLeaseFile, "utf8"));
  sweptLease.pid = 2147483647;
  fs.writeFileSync(sweptLeaseFile, JSON.stringify(sweptLease));
  setRunOwner(sweptRun, { pid: 2147483647 });
  try {
    assert(managedTemp.sweep(sweptRoot).removed.includes(sweptRun.id), "scratch sweep should be able to remove a stopped run before cache pruning");
    const held = await pruneCaches({ projectRoot: sweptRoot, maxBytes: 0, budgetMs: 1000 });
    assert(held.retained.some(item => item.path === sweptCache.path && item.reason === "active-lease"), "bound live supervisor must protect a cache after scratch marker removal");
    assert(fs.existsSync(sweptCache.path));
  } finally {
    supervisor.kill();
    await supervisorClosed;
  }
  const recovered = await pruneCaches({ projectRoot: sweptRoot, maxBytes: 0, budgetMs: 1000 });
  assert(recovered.removed.some(item => item.path === sweptCache.path), "dead bound supervisor should allow recovery after the run marker was swept");

  const unboundRoot = project("swept-run-unbound-lease");
  const unboundRun = managedTemp.createRun(unboundRoot);
  const unboundCache = await acquireCache(unboundRoot, "npm", { runRoot: unboundRun.root, maxBytes: 1024 * 1024 });
  const unboundLeaseFile = leaseFiles(unboundCache.path)[0];
  const unboundLease = JSON.parse(fs.readFileSync(unboundLeaseFile, "utf8"));
  unboundLease.pid = 2147483647;
  fs.writeFileSync(unboundLeaseFile, JSON.stringify(unboundLease));
  setRunOwner(unboundRun, { pid: 2147483647 });
  assert(managedTemp.sweep(unboundRoot).removed.includes(unboundRun.id));
  const unbound = await pruneCaches({ projectRoot: unboundRoot, maxBytes: 0, budgetMs: 1000 });
  assert(unbound.retained.some(item => item.path === unboundCache.path && item.reason === "missing-or-invalid-run-owner"), "unbound missing-run lease must remain uncertain");

  const unresolvedRoot = project("unresolved-run");
  const unresolvedRun = managedTemp.createRun(unresolvedRoot);
  unresolvedRun.setLaunching(true);
  const unresolvedCache = await acquireCache(unresolvedRoot, "npm", { runRoot: unresolvedRun.root, maxBytes: 1024 * 1024 });
  const unresolvedLeaseFile = leaseFiles(unresolvedCache.path)[0];
  const unresolvedLease = JSON.parse(fs.readFileSync(unresolvedLeaseFile, "utf8"));
  unresolvedLease.pid = 2147483647;
  fs.writeFileSync(unresolvedLeaseFile, JSON.stringify(unresolvedLease));
  setRunOwner(unresolvedRun, { pid: 2147483647 });
  const unresolved = await pruneCaches({ projectRoot: unresolvedRoot, maxBytes: 0, budgetMs: 1000 });
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
  const unresolvedEviction = await pruneCaches({ projectRoot: unresolvedRoot, maxBytes: 0, budgetMs: 1000 });
  assert(unresolvedEviction.removed.some(item => item.path === unresolvedCache.path));

  await testOwnedCacheLinkEviction();

  const budgetRoot = project("budget");
  const budgetRun = managedTemp.createRun(budgetRoot);
  const budgetCache = await acquireCache(budgetRoot, "npm", { runRoot: budgetRun.root });
  for (let index = 0; index < 2000; index += 1) fs.writeFileSync(path.join(budgetCache.path, `item-${index}.dat`), "x");
  await releaseCache(budgetCache);
  const budget = await pruneCaches({ projectRoot: budgetRoot, maxBytes: 0, budgetMs: 0 });
  assert(!budget.complete || budget.retained.some(item => item.reason === "budget-exhausted"));
  assert(fs.existsSync(budgetCache.path), "budget-limited prune must not delete incompletely observed cache data");
  assert(budgetRun.finish().removed);

  assert.throws(() => cache.acquireCache(root, "npm", { runRoot: path.join(root, "unknown-run") }), /Cannot bind cache lease/u);

  const archiveBase = cache.cacheBase();
  let archives = fs.readdirSync(archiveBase).filter(name => name.startsWith(".operation-recovered-") || name.startsWith(".operation-recovery-"));
  const archiveSource = path.join(archiveBase, archives.find(name => name.startsWith(".operation-recovered-")));
  assert(fs.existsSync(path.join(archiveSource, "receipt.json")), "archive-bound test needs a completed, reviewable recovery record");
  while (archives.length < 32) {
    const name = `.operation-recovered-budget-${archives.length}-${require("crypto").randomUUID()}`;
    fs.cpSync(archiveSource, path.join(archiveBase, name), { recursive: true, errorOnExist: true });
    archives.push(name);
  }
  const fullBudgetClaim = path.join(archiveBase, cache.OPERATION_CLAIM);
  const fullBudgetBytes = Buffer.from(`${JSON.stringify({ version: 1, pid: 2147483647, token: require("crypto").randomUUID(), createdAt: new Date().toISOString() })}\n`);
  fs.writeFileSync(fullBudgetClaim, fullBudgetBytes, { flag: "wx" });
  const fullBudgetHash = require("crypto").createHash("sha256").update(fullBudgetBytes).digest("hex");
  const archiveCountBefore = fs.readdirSync(archiveBase).filter(name => name.startsWith(".operation-recovered-") || name.startsWith(".operation-recovery-")).length;
  assert.throws(() => cache.recoverLegacyClaim(fullBudgetHash, 2147483647), /retention limit is full/u);
  assert(fs.readFileSync(fullBudgetClaim).equals(fullBudgetBytes), "full archive budget must preserve the marker");
  assert.strictEqual(fs.readdirSync(archiveBase).filter(name => name.startsWith(".operation-recovered-") || name.startsWith(".operation-recovery-")).length, archiveCountBefore, "full archive budget must not create another directory");
  process.stdout.write("managed-cache focused tests passed\n");
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; }).finally(cleanup);
