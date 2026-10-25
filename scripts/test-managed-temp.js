"use strict";

// Focused safety tests for the managed-temp API and CLI. All fixtures are disposable.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const managed = require("./lib/managed-temp.js");
const reports = require("./lib/managed-run-report.js");
const ownershipApi = require("./lib/managed-run-ownership.js");
const { exportBuild } = require("./managed-temp.js");

const cli = path.join(__dirname, "managed-temp.js");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-temp-test-"));
const originalManagedCacheBase = process.env.APT_MANAGED_CACHE_BASE;
process.env.APT_MANAGED_CACHE_BASE = path.join(fixture, "managed-cache");
const fixtureProjects = new Set();
function project(name) {
  const root = path.join(fixture, name);
  fs.mkdirSync(root, { recursive: true });
  fixtureProjects.add(root);
  return root;
}
function runCli(root, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, env: options.env || process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    if (options.killAfterMs) setTimeout(() => child.kill(options.signal || "SIGTERM"), options.killAfterMs).unref();
  });
}
function ownerPath(run) { return path.join(run.root, managed.OWNER_FILE); }
function markStale(run, preserveChild = false) {
  const owner = JSON.parse(fs.readFileSync(ownerPath(run), "utf8"));
  owner.pid = 2147483647;
  if (!preserveChild) owner.childPid = null;
  fs.writeFileSync(ownerPath(run), JSON.stringify(owner));
}
function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}
async function waitForPidsStopped(pids) {
  // The native supervisor has a bounded 5s termination-confirmation window;
  // include OS process teardown rather than racing that exact deadline.
  for (let attempt = 0; attempt < 400 && pids.some(pidAlive); attempt += 1) await new Promise(resolve => setTimeout(resolve, 25));
  assert(pids.every(pid => !pidAlive(pid)), `fixture processes remained alive: ${pids.filter(pidAlive).join(",")}`);
}

function fileManifest(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile()) files.push([path.relative(root, target), crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex")]);
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

async function testOwnedLinkCleanup() {
  const outside = path.join(fixture, "link-target-manifest");
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, "manifest.json"), JSON.stringify({ keep: ["sentinel", "payload"] }) + "\n");
  fs.writeFileSync(path.join(outside, "payload.txt"), "outside payload must not change\n");
  const beforeManifest = fileManifest(outside);
  const root = project("links-owned-cleanup");
  const run = managed.createRun(root);
  const junction = path.join(run.temp, "absolute-directory-junction");
  fs.symlinkSync(outside, junction, process.platform === "win32" ? "junction" : "dir");
  assert(fs.lstatSync(junction).isSymbolicLink(), "directory link fixture was not created");

  const skippedFileLinks = [];
  const absoluteFileLink = path.join(run.temp, "absolute-file-link");
  const relativeFileLink = path.join(run.temp, "relative-file-link");
  const danglingFileLink = path.join(run.temp, "dangling-file-link");
  const cyclicFileLink = path.join(run.temp, "cyclic-file-link");
  createFileLink(absoluteFileLink, path.join(outside, "payload.txt"), skippedFileLinks);
  createFileLink(relativeFileLink, path.relative(run.temp, path.join(outside, "manifest.json")), skippedFileLinks);
  createFileLink(danglingFileLink, path.join(outside, "missing.txt"), skippedFileLinks);
  createFileLink(cyclicFileLink, path.basename(cyclicFileLink), skippedFileLinks);

  const linkedObservation = managed.observeTree(run.root, { budgetMs: 1000 });
  assert(!linkedObservation.complete && linkedObservation.reason === "linked-entry", "default observation must remain link-strict");
  assert.throws(() => exportBuild(run.root, path.join(fixture, "linked-export"), run.root), /unverified output tree/u,
    "keep-output export must reject descendant links");
  assert(!fs.existsSync(path.join(fixture, "linked-export")));

  const unowned = path.join(fixture, "unowned-link-cleanup");
  fs.mkdirSync(unowned);
  const unownedLink = path.join(unowned, "external");
  fs.symlinkSync(outside, unownedLink, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => managed.removeBounded(unowned, Date.now() + 1000), /Refusing nested symlink or junction/u,
    "the exported owner-less remover must remain link-strict");
  assert(fs.lstatSync(unownedLink).isSymbolicLink());
  fs.unlinkSync(unownedLink);
  fs.rmdirSync(unowned);

  markStale(run);
  const report = managed.sweep(root, { budgetMs: 1000 });
  assert(report.removed.includes(run.id), `owned cleanup did not remove its run: ${JSON.stringify(report.errors)}`);
  assert.strictEqual(report.errors.length, 0);
  assert.deepStrictEqual(fileManifest(outside), beforeManifest, "owned cleanup changed a link target");

  const childRoot = project("links-real-child-process");
  const childReceipt = path.join(childRoot, "created-links.json");
  const childCode = `const fs=require("fs"),path=require("path");const root=process.env.AGENT_MANAGED_TEMP;if(!root)throw new Error("managed run root missing");const temp=path.join(root,"tmp"),outside=process.argv[1],receipt=process.argv[2],created=[],skipped=[];const junction=path.join(temp,"child-directory-junction");fs.symlinkSync(outside,junction,process.platform==="win32"?"junction":"dir");created.push(path.basename(junction));for(const [name,target] of [["absolute-file-link",path.join(outside,"payload.txt")],["relative-file-link",path.relative(temp,path.join(outside,"manifest.json"))],["dangling-file-link",path.join(outside,"missing.txt")],["cyclic-file-link","cyclic-file-link"]]){try{fs.symlinkSync(target,path.join(temp,name),"file");created.push(name)}catch(error){if(process.platform==="win32"&&["EPERM","EACCES","UNKNOWN"].includes(error.code))skipped.push(name+":"+error.code);else throw error}}fs.writeFileSync(receipt,JSON.stringify({created,skipped}));`;
  const childRun = await runCli(childRoot, ["run", "--", process.execPath, "-e", childCode, outside, childReceipt]);
  assert.strictEqual(childRun.code, 0, childRun.stderr);
  const createdLinks = JSON.parse(fs.readFileSync(childReceipt, "utf8"));
  assert(createdLinks.created.includes("child-directory-junction"), "real child did not create the required directory junction");
  assert(managed.status(childRoot).length === 0, "real process run retained owned scratch containing links");
  const runSummaryLine = childRun.stderr.split(/\r?\n/u).find(line => line.startsWith("managed-run: "));
  assert(runSummaryLine, `managed run summary missing: ${childRun.stderr}`);
  const runSummary = JSON.parse(runSummaryLine.slice("managed-run: ".length));
  const runReport = reports.readReportPath(runSummary.report);
  assert.strictEqual(runSummary.scratchRemoved, true, "real child run did not confirm scratch cleanup");
  assert.strictEqual(runReport.process.commandExitCode, 0, "real child did not exit successfully");
  assert(runReport.process.treeStopped === true || runReport.process.groupStopped === true, "real child process family lacked stop proof");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest, "real-process cleanup changed a link target");

  const budgetRoot = project("links-budget");
  const budgetRun = managed.createRun(budgetRoot);
  fs.symlinkSync(outside, path.join(budgetRun.temp, "one-link-entry"), process.platform === "win32" ? "junction" : "dir");
  markStale(budgetRun);
  const limited = managed.sweep(budgetRoot, { budgetMs: 1000, maxEntries: 1 });
  assert(limited.pending.some(item => item.path === budgetRun.id && item.reason === "budget-exhausted"));
  assert(fs.existsSync(ownerPath(budgetRun)), "cleanup budget must retain the owner marker after partial work");
  assert.strictEqual(limited.accounting.observedBytesRemoved, 0, "link targets and link metadata must not count as payload bytes");
  assert(!limited.accounting.remainingComplete && limited.accounting.reason === "budget-exhausted");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  assert(managed.sweep(budgetRoot, { budgetMs: 1000 }).removed.includes(budgetRun.id), "cleanup retry did not finish the owned run");

  const partialRoot = project("links-partial-accounting");
  const partialRun = managed.createRun(partialRoot);
  const partialPayload = Buffer.from("counted regular payload\n");
  fs.writeFileSync(path.join(partialRun.temp, "payload.txt"), partialPayload);
  markStale(partialRun);
  const partial = managed.sweep(partialRoot, { budgetMs: 1000, maxEntries: 1 });
  assert(partial.pending.some(item => item.path === partialRun.id && item.reason === "budget-exhausted"));
  assert.strictEqual(partial.accounting.observedBytesRemoved, partialPayload.length);
  assert.strictEqual(partial.accounting.observedFilesRemoved, 1);
  assert(fs.existsSync(ownerPath(partialRun)), "partial cleanup removed its owner marker");
  assert(!partial.accounting.remainingComplete && partial.accounting.reason === "budget-exhausted");
  assert(managed.sweep(partialRoot, { budgetMs: 1000 }).removed.includes(partialRun.id));

  const errorRoot = project("links-unlink-error");
  const errorRun = managed.createRun(errorRoot);
  const errorLink = path.join(errorRun.temp, "external");
  fs.symlinkSync(outside, errorLink, process.platform === "win32" ? "junction" : "dir");
  markStale(errorRun);
  const originalUnlink = fs.unlinkSync;
  let injectedUnlinkFailure = false;
  fs.unlinkSync = function (target, ...args) {
    if (!injectedUnlinkFailure && path.resolve(String(target)) === path.resolve(errorLink)) {
      injectedUnlinkFailure = true;
      const error = new Error("injected owned-link unlink failure");
      error.code = "EACCES";
      throw error;
    }
    return originalUnlink.call(this, target, ...args);
  };
  let unlinkFailureReport;
  try { unlinkFailureReport = managed.sweep(errorRoot, { budgetMs: 1000 }); }
  finally { fs.unlinkSync = originalUnlink; }
  assert(injectedUnlinkFailure, "link unlink failure injection did not execute");
  assert(unlinkFailureReport.errors.length > 0, "link unlink error was not reported");
  assert(fs.existsSync(ownerPath(errorRun)), "unlink error removed its owner marker");
  assert(fs.lstatSync(errorLink).isSymbolicLink(), "failed unlink changed the link entry");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  assert(managed.sweep(errorRoot, { budgetMs: 1000 }).removed.includes(errorRun.id), "owned cleanup retry did not remove the link");

  const markerRoot = project("links-owner-marker");
  const markerRun = managed.createRun(markerRoot);
  markStale(markerRun);
  const marker = ownerPath(markerRun);
  const ownerBytes = fs.readFileSync(marker);
  fs.unlinkSync(marker);
  fs.symlinkSync(outside, marker, process.platform === "win32" ? "junction" : "dir");
  const markerReport = managed.sweep(markerRoot, { budgetMs: 1000 });
  assert(markerReport.skipped.some(item => item.path === markerRun.id && item.reason === "invalid-owner"), "owner-marker link was accepted");
  assert(fs.existsSync(markerRun.root));
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  fs.unlinkSync(marker);
  fs.writeFileSync(marker, ownerBytes);
  assert(managed.sweep(markerRoot, { budgetMs: 1000 }).removed.includes(markerRun.id));

  const nestedMarkerCases = [
    { name: "junction", create: markerPath => { fs.symlinkSync(outside, markerPath, "junction"); return true; }, remove: markerPath => fs.rmdirSync(markerPath) },
    { name: "dangling", create: markerPath => createFileLink(markerPath, path.join(outside, "missing-owner-marker.json"), skippedFileLinks), remove: markerPath => fs.unlinkSync(markerPath) },
    { name: "cyclic", create: markerPath => createFileLink(markerPath, path.basename(markerPath), skippedFileLinks), remove: markerPath => fs.unlinkSync(markerPath) },
  ];
  for (const markerCase of nestedMarkerCases) {
    const nestedMarkerRoot = project(`nested-owner-marker-${markerCase.name}`);
    const nestedMarkerRun = managed.createRun(nestedMarkerRoot);
    const nestedWorkspace = path.join(nestedMarkerRun.temp, "nested-workspace");
    fs.mkdirSync(nestedWorkspace);
    const nestedPayload = path.join(nestedWorkspace, "payload.txt");
    fs.writeFileSync(nestedPayload, "nested workspace must remain owned\n");
    const nestedMarker = path.join(nestedWorkspace, managed.OWNER_FILE);
    const created = markerCase.create(nestedMarker);
    if (!created) {
      markStale(nestedMarkerRun);
      assert(managed.sweep(nestedMarkerRoot, { budgetMs: 1000 }).removed.includes(nestedMarkerRun.id),
        `${markerCase.name} unsupported marker fixture cleanup did not finish`);
      continue;
    }
    assert(fs.lstatSync(nestedMarker).isSymbolicLink(), `${markerCase.name} nested owner marker fixture was not a link`);
    markStale(nestedMarkerRun);
    const nestedMarkerReport = managed.sweep(nestedMarkerRoot, { budgetMs: 1000 });
    assert(nestedMarkerReport.errors.some(item => /linked owner marker/u.test(item.error)),
      `${markerCase.name} nested owner marker was not rejected: ${JSON.stringify(nestedMarkerReport.errors)}`);
    assert(fs.existsSync(ownerPath(nestedMarkerRun)), `${markerCase.name} nested marker rejection removed the outer owner`);
    assert.strictEqual(fs.readFileSync(nestedPayload, "utf8"), "nested workspace must remain owned\n",
      `${markerCase.name} nested marker rejection descended into the nested workspace`);
    markerCase.remove(nestedMarker);
    assert(managed.sweep(nestedMarkerRoot, { budgetMs: 1000 }).removed.includes(nestedMarkerRun.id),
      `${markerCase.name} nested marker cleanup retry did not finish`);
  }

  const swapRoot = project("links-changed-parent");
  const swapRun = managed.createRun(swapRoot);
  const swapLink = path.join(swapRun.temp, "external");
  fs.symlinkSync(outside, swapLink, process.platform === "win32" ? "junction" : "dir");
  markStale(swapRun);
  const originalLstat = fs.lstatSync;
  let sawLinkLeaf = false, rejectedChangedParent = false;
  fs.lstatSync = function (target, ...args) {
    const absolute = path.resolve(String(target));
    if (absolute === path.resolve(swapLink)) sawLinkLeaf = true;
    if (sawLinkLeaf && !rejectedChangedParent && absolute === path.resolve(swapRun.root)) {
      rejectedChangedParent = true;
      const stat = originalLstat.call(this, target, ...args);
      return new Proxy(stat, { get(value, property) {
        if (property === "isSymbolicLink") return () => true;
        const result = Reflect.get(value, property, value);
        return typeof result === "function" ? result.bind(value) : result;
      } });
    }
    return originalLstat.call(this, target, ...args);
  };
  let swapReport;
  try { swapReport = managed.sweep(swapRoot, { budgetMs: 1000 }); }
  finally { fs.lstatSync = originalLstat; }
  assert(rejectedChangedParent, "changed-parent injection did not reach final ancestor validation");
  assert(swapReport.errors.length > 0, "cleanup did not reject the changed parent");
  assert(fs.existsSync(ownerPath(swapRun)), "changed-parent rejection removed the owner marker");
  assert.deepStrictEqual(fileManifest(outside), beforeManifest);
  assert(managed.sweep(swapRoot, { budgetMs: 1000 }).removed.includes(swapRun.id), "retry did not remove the unchanged fixture link");

  assert.deepStrictEqual(fileManifest(outside), beforeManifest, "a link cleanup case changed target bytes");
  process.stdout.write(skippedFileLinks.length
    ? `file-symlink subcases unavailable on this host: ${skippedFileLinks.join(", ")}\n`
    : "file-symlink subcases: absolute, relative, dangling, and cyclic verified\n");
  process.stdout.write("owned-link cleanup focused tests passed (directory junction required and verified)\n");
}

async function main() {
  if (process.argv.includes("--links-only")) { await testOwnedLinkCleanup(); return; }
  const root = project("cli-success");
  const inheritedManagedTemp = process.env.AGENT_MANAGED_TEMP;
  const inheritedManagedBinding = process.env.AGENT_MANAGED_RUN_BINDING;
  const ownerSession = "native-session-A";
  const ownerRequest = "22222222-2222-4222-8222-222222222222";
  const ownerTurn = "root-turn:Case-sensitive";
  const sessionRoot = path.join(root, ".session-cache", "codex-turns", crypto.createHash("sha256").update(ownerSession).digest("hex").slice(0, 24));
  const ledgerFile = path.join(sessionRoot, "requests", ownerRequest, "request.json");
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  fs.writeFileSync(ledgerFile, JSON.stringify({ schemaVersion: 1, root: fs.realpathSync(root), sessionId: ownerSession, requestId: ownerRequest, rootTurnId: ownerTurn, startedAt: new Date().toISOString() }));
  const exactRun = managed.createRun(root, { requestStatePath: ledgerFile, env: { CODEX_SESSION_ID: ownerSession } });
  assert.deepStrictEqual(exactRun.ownership, { sessionId: ownerSession, requestId: ownerRequest, rootTurnId: ownerTurn, source: "request-state", confidence: "exact" });
  assert.strictEqual(ownershipApi.classifyOwnership(exactRun.ownership, { sessionId: ownerSession, requestId: ownerRequest, rootTurnId: ownerTurn }), "current");
  assert.strictEqual(ownershipApi.classifyOwnership(exactRun.ownership, { sessionId: ownerSession, requestId: "44444444-4444-4444-8444-444444444444" }), "other");
  assert.strictEqual(ownershipApi.classifyOwnership(exactRun.ownership, { sessionId: "native-session-a", requestId: ownerRequest }), "other", "native session IDs must remain case-distinct");
  assert.strictEqual(ownershipApi.classifyOwnership(exactRun.ownership, { sessionId: ownerSession, requestId: ownerRequest, rootTurnId: "root-turn:case-sensitive" }), "other", "native root turn IDs must remain case-distinct");
  assert.strictEqual(ownershipApi.classifyOwnership({ ...exactRun.ownership, confidence: "observed", requestId: null, rootTurnId: null }, { sessionId: ownerSession, requestId: ownerRequest }), "unknown");
  assert(exactRun.finish().removed);
  assert.throws(() => reports.readReportPath(path.join(root, "runs", "22222222-2222-4222-8222-222222222222.json")), /outside the managed report namespace/u);
  assert.throws(() => managed.createRun(root, { requestStatePath: ledgerFile, env: { CODEX_SESSION_ID: "55555555-5555-4555-8555-555555555555" } }), /another observed session/u);
  const prefixProbe = managed.createRun(root);
  assert(path.relative(os.homedir(), prefixProbe.temp).length <= 100,
    `managed TEMP path is too long relative to the home directory: ${path.relative(os.homedir(), prefixProbe.temp)}`);
  assert(prefixProbe.finish().removed, "temporary path probe did not clean up");
  const resourceRun = managed.createRun(root);
  const resource = resourceRun.allocate("fixture", "observed bytes");
  assert(resource.startsWith(path.join(resourceRun.root, "resources") + path.sep));
  assert(path.relative(resourceRun.root, resource).length < 40, "allocated resource path should stay short on Windows");
  fs.writeFileSync(path.join(resource, "measured.bin"), Buffer.alloc(37, 1));
  const observedTree = managed.observeTree(resourceRun.root, { budgetMs: 1000 });
  assert(observedTree.complete && observedTree.bytes >= 37 && observedTree.files >= 2, "run usage observer missed owned files");
  const boundedTree = managed.observeTree(resourceRun.root, { budgetMs: 1000, maxEntries: 1 });
  assert(!boundedTree.complete && boundedTree.reason === "budget-exhausted");
  assert(boundedTree.bytes >= 0 && boundedTree.files >= 0, "bounded measurements should remain truthful lower bounds");
  const resourceOwner = JSON.parse(fs.readFileSync(ownerPath(resourceRun), "utf8"));
  assert(resourceOwner.resources.some(item => item.path === path.relative(resourceRun.root, resource) && item.kind === "fixture" && item.label === "observed bytes"), "resource allocation was not registered with its full kind and label");
  markStale(resourceRun);
  const resourceReport = managed.sweep(root);
  assert(resourceReport.removed.includes(resourceRun.id));
  assert(resourceReport.accounting.observedBytesRemoved >= 37);
  assert(resourceReport.accounting.observedFilesRemoved >= 2);
  assert(resourceReport.observations.some(item => item.path === resourceRun.id && item.remainingComplete && item.observedBytesRemaining === 0));
  assert.throws(() => resourceRun.allocate("../outside"), /safe identifier/);

  const deferredAccounting = managed.createRun(root);
  fs.writeFileSync(path.join(deferredAccounting.temp, "large.bin"), Buffer.alloc(19, 2));
  markStale(deferredAccounting);
  const deferredAccountingReport = managed.sweep(root, { maxEntries: 1 });
  const deferredObservation = deferredAccountingReport.observations.find(item => item.path === deferredAccounting.id);
  assert(deferredObservation && !deferredObservation.remainingComplete && deferredObservation.reason === "budget-exhausted");
  assert.strictEqual(deferredObservation.observedBytesRemaining, null, "an incomplete bounded scan must not claim a remaining byte total");
  assert(managed.sweep(root).removed.includes(deferredAccounting.id));

  const dependentRoot = project("dependent-parent");
  const parentRun = managed.createRun(dependentRoot);
  const dependentProject = path.join(parentRun.temp, "chromium-project");
  fs.mkdirSync(dependentProject);
  let dependentRun, dependentCache, dependentCachePath;
  try {
    process.env.AGENT_MANAGED_TEMP = parentRun.root;
    process.env.AGENT_MANAGED_RUN_BINDING = parentRun.binding;
    dependentRun = managed.createRun(dependentProject);
    const cacheModule = require("./lib/managed-cache.js");
    dependentCache = cacheModule.acquireCache(dependentProject, "node-compile", { runRoot: dependentRun.root });
    dependentCachePath = dependentCache.path;
  } finally {
    if (inheritedManagedTemp === undefined) delete process.env.AGENT_MANAGED_TEMP;
    else process.env.AGENT_MANAGED_TEMP = inheritedManagedTemp;
    if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING;
    else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding;
  }
  const dependentBinding = path.join(parentRun.root, "dependents", `${dependentRun.id}.json`);
  assert(fs.existsSync(dependentBinding), "nested project resource was not registered under its parent run");
  const dependentReport = reports.writeReport(dependentProject, { runId: dependentRun.id, completedAt: new Date().toISOString(), exitCode: 0 });
  assert.strictEqual(reports.readReportPath(dependentReport).runId, dependentRun.id);
  const dependentReportDirectory = reports.reportDirectory(dependentProject);
  const dependentProjectCanonical = fs.realpathSync(dependentProject);
  markStale(parentRun);
  markStale(dependentRun);
  const blockedParentSweep = managed.sweep(dependentRoot);
  assert(blockedParentSweep.pending.some(item => item.path === parentRun.id && item.reason === "dependent-resource-live-caches-exceed-budget"), `parent cleanup did not report the active child cache: ${JSON.stringify(blockedParentSweep.pending)}`);
  assert(fs.existsSync(ownerPath(parentRun)), "parent cleanup removed its marker while a dependent cache lease was active");
  assert(fs.existsSync(dependentProject), "parent cleanup removed the fixture project with an active dependent cache");
  assert(!fs.existsSync(dependentRun.root), "dependent scratch itself should be swept before cache pruning");
  assert.deepStrictEqual(dependentCache.release(), { released: true });
  fs.writeFileSync(path.join(dependentReportDirectory, "unowned.txt"), "preserve");
  const settledParentSweep = managed.sweep(dependentRoot);
  assert(settledParentSweep.removed.includes(parentRun.id), "parent cleanup did not resume after the dependent cache became idle");
  assert(!fs.existsSync(dependentProject));
  assert(!fs.existsSync(dependentCachePath));
  assert(fs.existsSync(dependentReportDirectory) && fs.existsSync(dependentReport) && fs.existsSync(path.join(dependentReportDirectory, "unowned.txt")), "external immutable reports and neighboring data must survive settlement");
  assert.strictEqual(reports.readReportPath(dependentReport).runId, dependentRun.id, "immutable report path must remain readable after project deletion");
  assert.strictEqual(path.basename(dependentReportDirectory), crypto.createHash("sha256").update(dependentProjectCanonical).digest("hex").slice(0, 32));
  managed.assertNoLinks(dependentReportDirectory);
  fs.rmSync(dependentReportDirectory, { recursive: true, force: false });

  const foregroundDependentRoot = project("foreground-dependent-parent");
  const foregroundParent = managed.createRun(foregroundDependentRoot, { processContract: "foreground" });
  const foregroundChildProject = path.join(foregroundParent.temp, "child-project");
  fs.mkdirSync(foregroundChildProject);
  const foregroundLease = managed.inspectRunLease(foregroundParent.root);
  assert(foregroundLease.valid && foregroundLease.active && foregroundLease.pending && foregroundLease.owner,
    "a live foreground parent should remain pending cleanup while validating its inherited lease");
  const liveForegroundSweep = managed.sweep(foregroundDependentRoot);
  assert(liveForegroundSweep.busy.some(item => item.path === foregroundParent.id && item.reason === "live-lease"),
    "a live foreground owner should be classified as busy during ordinary cleanup");
  assert(!liveForegroundSweep.pending.some(item => item.path === foregroundParent.id),
    "a live foreground owner should not be reported as unresolved pending cleanup");
  const originalDateNow = Date.now;
  let budgetClockCalls = 0;
  let budgetedForegroundSweep;
  try {
    Date.now = () => budgetClockCalls++ === 0 ? 1 : 2;
    budgetedForegroundSweep = managed.sweep(foregroundDependentRoot, { budgetMs: 0 });
  } finally { Date.now = originalDateNow; }
  assert(budgetedForegroundSweep.busy.some(item => item.path === foregroundParent.id && item.reason === "live-lease"),
    "a live foreground owner should be classified as busy when the cleanup budget is exhausted");
  assert(!budgetedForegroundSweep.pending.some(item => item.path === foregroundParent.id),
    "budget exhaustion must not misreport a live foreground owner as unresolved pending cleanup");
  const beforeForegroundChild = process.env.AGENT_MANAGED_TEMP;
  let foregroundChild;
  try {
    process.env.AGENT_MANAGED_TEMP = foregroundParent.root;
    process.env.AGENT_MANAGED_RUN_BINDING = foregroundParent.binding;
    foregroundChild = managed.createRun(foregroundChildProject);
  } finally {
    if (beforeForegroundChild === undefined) delete process.env.AGENT_MANAGED_TEMP;
    else process.env.AGENT_MANAGED_TEMP = beforeForegroundChild;
    if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING;
    else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding;
  }
  assert(fs.existsSync(path.join(foregroundParent.root, "dependents", `${foregroundChild.id}.json`)),
    "a live foreground parent should register inherited child work");
  markStale(foregroundChild);
  assert(managed.sweep(foregroundChildProject).removed.includes(foregroundChild.id));
  assert(foregroundParent.finish({ foregroundCompleted: true }).removed,
    "confirmed foreground completion should clean the parent after its child is gone");

  const emptyReportRoot = project("empty-report-parent");
  const emptyReportParent = managed.createRun(emptyReportRoot);
  const emptyReportProject = path.join(emptyReportParent.temp, "project");
  fs.mkdirSync(emptyReportProject);
  let emptyReportChild;
  try { process.env.AGENT_MANAGED_TEMP = emptyReportParent.root; process.env.AGENT_MANAGED_RUN_BINDING = emptyReportParent.binding; emptyReportChild = managed.createRun(emptyReportProject); }
  finally { if (inheritedManagedTemp === undefined) delete process.env.AGENT_MANAGED_TEMP; else process.env.AGENT_MANAGED_TEMP = inheritedManagedTemp; if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING; else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding; }
  const emptyReportDirectory = reports.reportDirectory(emptyReportProject);
  fs.mkdirSync(emptyReportDirectory, { recursive: true });
  markStale(emptyReportParent); markStale(emptyReportChild);
  let emptyReportSweep, emptyReportAttempts = 0;
  do {
    emptyReportSweep = managed.sweep(emptyReportRoot);
    const transientGate = emptyReportSweep.pending.some(item => item.path === emptyReportParent.id && item.reason === "dependent-resource-operation-in-progress");
    if (!transientGate) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  } while (++emptyReportAttempts < 80);
  assert(emptyReportSweep.removed.includes(emptyReportParent.id), `empty interrupted report namespace should not block parent recovery: ${JSON.stringify(emptyReportSweep.pending)}`);
  assert(fs.existsSync(emptyReportDirectory), "settlement should not remove external report namespaces");
  managed.assertNoLinks(emptyReportDirectory);
  fs.rmdirSync(emptyReportDirectory);

  const interruptedBindingRoot = project("interrupted-binding");
  const interruptedBindingParent = managed.createRun(interruptedBindingRoot);
  const interruptedBindingProject = path.join(interruptedBindingParent.temp, "project");
  fs.mkdirSync(interruptedBindingProject);
  const originalOpen = fs.openSync, originalFsync = fs.fsyncSync;
  let bindingFd;
  try {
    process.env.AGENT_MANAGED_TEMP = interruptedBindingParent.root;
    process.env.AGENT_MANAGED_RUN_BINDING = interruptedBindingParent.binding;
    fs.openSync = (file, ...args) => { const fd = originalOpen(file, ...args); if (path.basename(String(file)).startsWith(".dependent-") && String(file).endsWith(".tmp")) bindingFd = fd; return fd; };
    fs.fsyncSync = fd => { if (fd === bindingFd) throw new Error("injected dependent staging failure"); return originalFsync(fd); };
    assert.throws(() => managed.createRun(interruptedBindingProject), /injected dependent staging failure/);
  } finally {
    fs.openSync = originalOpen; fs.fsyncSync = originalFsync;
    if (inheritedManagedTemp === undefined) delete process.env.AGENT_MANAGED_TEMP; else process.env.AGENT_MANAGED_TEMP = inheritedManagedTemp;
    if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING; else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding;
  }
  assert(!fs.existsSync(managed.managedBase(interruptedBindingProject)), "failed registration allocated an unregistered external namespace");
  assert(interruptedBindingParent.finish().removed, "incomplete staging must not strand the parent fixture");

  const success = await runCli(root, ["run", "--", process.execPath, "-e", "require('fs').writeFileSync(require('path').join(process.env.TEMP,'ok'),'yes')"]);
  assert.strictEqual(success.code, 0, success.stderr);
  assert.deepStrictEqual(managed.status(root), []);

  const npmCacheChild = "const fs=require('fs'),p=require('path'),d=process.env.npm_config_cache;fs.mkdirSync(p.join(d,'_npx','fixture'),{recursive:true});fs.mkdirSync(p.join(d,'_logs'),{recursive:true});fs.writeFileSync(p.join(d,'_npx','fixture','package.json'),'{}');fs.writeFileSync(p.join(d,'_logs','fixture.log'),'ok');console.log(d)";
  const isolatedEnv = { ...process.env, npm_config_cache: "C:/shared-cache-lower", NPM_CONFIG_CACHE: "C:/shared-cache-upper" };
  const npmSuccess = await runCli(root, ["run", "--", process.execPath, "-e", npmCacheChild], { env: isolatedEnv });
  assert.strictEqual(npmSuccess.code, 0, npmSuccess.stderr);
  const reportedCache = path.resolve(npmSuccess.stdout.trim());
  const relativeCache = path.relative(managed.managedBase(root), reportedCache);
  assert.match(relativeCache, /^[0-9a-f-]{36}[\\/]resources[\\/]\d+-npm-cache$/i, relativeCache);
  assert.deepStrictEqual(managed.status(root), [], "successful npm cache workspace was retained");
  assert(!fs.existsSync(reportedCache), "npm cache directory survived successful cleanup");

  const npmFailure = await runCli(root, ["run", "--", process.execPath, "-e", npmCacheChild + ";process.exit(19)"]);
  assert.strictEqual(npmFailure.code, 19, npmFailure.stderr);
  const failedCache = path.resolve(npmFailure.stdout.trim());
  assert(!fs.existsSync(failedCache), "npm cache directory survived failed child cleanup");
  assert.deepStrictEqual(managed.status(root), [], "failed npm cache workspace was retained");

  const nodeExecutables = new Set([process.execPath]);
  try { nodeExecutables.add(fs.realpathSync(process.execPath)); } catch { /* retain the original executable candidates */ }
  const npmCliCandidates = [
    ...[...nodeExecutables].flatMap(executable => {
      const nodeDirectory = path.dirname(executable);
      return [
        path.join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"),
        path.resolve(nodeDirectory, "../node_modules/npm/bin/npm-cli.js"),
        path.resolve(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
      ];
    }),
    process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules/npm/bin/npm-cli.js"),
  ].filter(Boolean);
  const npmCli = npmCliCandidates.find(candidate => fs.existsSync(candidate));
  if (!npmCli) throw new Error("Acceptance requires installed npm CLI (npm-cli.js) to verify its actual cache resolution");
  const npmConfigProbe = "const cp=require('child_process'),p=require('path'),r=cp.spawnSync(process.execPath,[process.argv[1],'config','ls','-l'],{encoding:'utf8',windowsHide:true});if(r.status!==0){process.stderr.write(r.stderr||'npm config query failed');process.exit(r.status||20)}const line=r.stdout.split(String.fromCharCode(10)).map(x=>x.trim()).find(x=>x.startsWith('cache = ')),v=line&&JSON.parse(line.slice(8)),actual=v&&p.resolve(v).toLowerCase(),expected=p.resolve(process.env.npm_config_cache).toLowerCase(),id=p.basename(process.env.AGENT_MANAGED_TEMP).toLowerCase(),redacted=expected.replace(id,'***');if(!actual||(actual!==expected&&actual!==p.resolve(redacted).toLowerCase())){process.stderr.write('npm CLI did not resolve cache to the owned operation folder');process.exit(21)}console.log('npm-cache-resolution-verified')";
  const npmConfig = await runCli(root, ["run", "--", process.execPath, "-e", npmConfigProbe, npmCli], { env: isolatedEnv });
  assert.strictEqual(npmConfig.code, 0, npmConfig.stderr);
  assert.match(npmConfig.stdout, /npm-cache-resolution-verified/);
  assert.deepStrictEqual(managed.status(root), [], "real npm CLI workspace was retained");

  const failure = await runCli(root, ["run", "--", process.execPath, "-e", "require('fs').writeFileSync(require('path').join(process.env.TMPDIR,'failed'),'yes');process.exit(7)"]);
  assert.strictEqual(failure.code, 7, failure.stderr);
  assert.deepStrictEqual(managed.status(root), []);

  if (process.platform === "win32") {
  const interruptRoot = project("interrupted");
  const childPidFile = path.join(interruptRoot, "child.pid");
  const stopFile = path.join(interruptRoot, "stop-child");
  const childCode = "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.cwd(),'child.pid'),String(process.pid));process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{if(fs.existsSync(p.join(process.cwd(),'stop-child')))process.exit(0)},50)";
  const wrapper = spawn(process.execPath, [cli, "run", "--", process.execPath, "-e", childCode], { cwd: interruptRoot,
    stdio: "ignore", windowsHide: true });
  const wrapperClosed = new Promise(resolve => wrapper.once("close", (code, signal) => resolve({ code, signal })));
  for (let attempt = 0; attempt < 100 && !fs.existsSync(childPidFile); attempt += 1) await new Promise(resolve => setTimeout(resolve, 25));
  assert(fs.existsSync(childPidFile), "managed child did not start");
  const childPid = Number(fs.readFileSync(childPidFile, "utf8"));
  const active = managed.status(interruptRoot);
  const supervised = active.find(item => item.childPid && item.active);
  assert(supervised, "live supervisor lease was not reported");
  assert.doesNotThrow(() => process.kill(supervised.childPid, 0), "reported supervisor process is not alive");
  assert.doesNotThrow(() => process.kill(childPid, 0), "foreground command process is not alive");
  // Bypass the wrapper's signal handler: a hard wrapper death must leave the
  // still-running child's lease intact so a sweep cannot erase its TEMP data.
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/F", "/PID", String(wrapper.pid)], { stdio: "ignore", windowsHide: true });
    await new Promise((resolve, reject) => { killer.once("error", reject); killer.once("close", resolve); });
  } else wrapper.kill("SIGKILL");
  const interrupted = await wrapperClosed;
  assert.notStrictEqual(interrupted.code, 0);
  const orphan = managed.status(interruptRoot).find(item => item.id === supervised.id);
  assert(orphan, `abrupt wrapper death removed its owner marker: ${JSON.stringify(managed.status(interruptRoot))}`);
  if (process.platform !== "win32") {
    assert(orphan.active, "abrupt wrapper death did not leave the live supervisor lease visible");
    assert(managed.sweep(interruptRoot).busy.some(item => item.path === orphan.id), "sweep did not protect the orphaned process family");
    // Process-tree containment is unavailable on this platform. Stop only the
    // two fixture-owned processes explicitly before verifying stale cleanup.
    for (const pid of new Set([orphan.childPid, childPid])) {
      try { process.kill(pid, "SIGKILL"); } catch { /* already stopped */ }
    }
    await waitForPidsStopped([...new Set([orphan.childPid, childPid])]);
  } else {
    await waitForPidsStopped([...new Set([orphan.childPid, childPid])]);
  }
  assert(managed.sweep(interruptRoot).removed.length === 1, "stale interrupted workspace was not swept");
  fs.rmSync(childPidFile, { force: true });
  assert.deepStrictEqual(managed.status(interruptRoot), []);
  }

  const foregroundRoot = project("foreground-contract");
  const unfinishedForeground = managed.createRun(foregroundRoot, { processContract: "foreground" });
  markStale(unfinishedForeground);
  assert(managed.sweep(foregroundRoot).pending.some(item => item.reason === "foreground-contract-not-completed"), "unfinished foreground contract must protect scratch even after all recorded PIDs die");
  let budgetedDeadForegroundSweep;
  budgetClockCalls = 0;
  try {
    Date.now = () => budgetClockCalls++ === 0 ? 1 : 2;
    budgetedDeadForegroundSweep = managed.sweep(foregroundRoot, { budgetMs: 0 });
  } finally { Date.now = originalDateNow; }
  assert(budgetedDeadForegroundSweep.pending.some(item => item.path === unfinishedForeground.id && item.reason === "foreground-contract-not-completed"),
    "budget exhaustion must preserve a dead foreground owner's specific pending reason");
  assert(!budgetedDeadForegroundSweep.busy.some(item => item.path === unfinishedForeground.id),
    "a dead foreground owner must not be misclassified as busy when the cleanup budget is exhausted");
  const deadForegroundChildProject = path.join(unfinishedForeground.temp, "child-project");
  fs.mkdirSync(deadForegroundChildProject);
  const beforeDeadForegroundChild = process.env.AGENT_MANAGED_TEMP;
  try {
    process.env.AGENT_MANAGED_TEMP = unfinishedForeground.root;
    process.env.AGENT_MANAGED_RUN_BINDING = unfinishedForeground.binding;
    assert.throws(() => managed.createRun(deadForegroundChildProject), /Inherited managed-run lease is not active and validated/u,
      "dead foreground owners must not authorize dependent runs");
  } finally {
    if (beforeDeadForegroundChild === undefined) delete process.env.AGENT_MANAGED_TEMP;
    else process.env.AGENT_MANAGED_TEMP = beforeDeadForegroundChild;
    if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING; else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding;
  }
  assert(!fs.existsSync(managed.managedBase(deadForegroundChildProject)), "rejected dead-parent registration must allocate no child namespace");
  const completedForeground = managed.createRun(foregroundRoot, { processContract: "foreground" });
  assert(completedForeground.finish({ foregroundCompleted: true }).removed, "normal caller-confirmed foreground completion must clean its own scratch");

  const leasesRoot = project("leases");
  const leased = managed.createRun(leasesRoot);
  const leasedChild = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  leased.setChildPid(leasedChild.pid);
  const leasedClosed = new Promise(resolve => leasedChild.once("close", resolve));
  try {
    markStale(leased, true);
    const live = managed.sweep(leasesRoot, { budgetMs: 100 });
    assert(live.skipped.some(item => item.reason === "live-lease"));
  } finally {
    leasedChild.kill();
    await leasedClosed;
  }
  assert(managed.sweep(leasesRoot).removed.includes(leased.id));

  const budgetRoot = project("budget");
  const deferred = managed.createRun(budgetRoot);
  markStale(deferred);
  fs.mkdirSync(path.join(managed.managedBase(budgetRoot), "unowned"));
  const budgetReport = managed.sweep(budgetRoot, { budgetMs: 0 });
  assert(budgetReport.pending.some(item => item.path === deferred.id));
  assert(!budgetReport.pending.some(item => item.path === "unowned"));
  assert(budgetReport.skipped.some(item => item.path === "unowned"));

  const boundedRoot = project("bounded-progress");
  const large = managed.createRun(boundedRoot);
  for (let index = 0; index < 80; index += 1) fs.writeFileSync(path.join(large.temp, `item-${index}.txt`), "x");
  markStale(large);
  const firstBatch = managed.sweep(boundedRoot, { budgetMs: 1000, maxEntries: 2 });
  assert(firstBatch.pending.some(item => item.path === large.id), "bounded cleanup should report deferred work");
  assert(fs.existsSync(ownerPath(large)), "ownership marker was removed before cleanup finished");
  let completed = false;
  for (let attempt = 0; attempt < 100 && !completed; attempt += 1) {
    const next = managed.sweep(boundedRoot, { budgetMs: 1000, maxEntries: 2 });
    completed = next.removed.includes(large.id);
  }
  assert(completed, "repeated bounded cleanup did not make progress through a large directory");

  const claimedRoot = project("cleanup-claim");
  const claimed = managed.createRun(claimedRoot);
  markStale(claimed);
  const claimFile = path.join(managed.managedBase(claimedRoot), `${claimed.id}.cleanup-claim`);
  const claimHolder = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const claimHolderClosed = new Promise(resolve => claimHolder.once("close", resolve));
  try {
    fs.writeFileSync(claimFile, JSON.stringify({ version: 1, id: claimed.id, root: fs.realpathSync(claimedRoot), projectHash: crypto.createHash("sha256").update(fs.realpathSync(claimedRoot), "utf8").digest("hex"), pid: claimHolder.pid, token: "live-test-claim" }));
    const claimReport = managed.sweep(claimedRoot);
    assert(claimReport.busy.some(item => item.path === claimed.id), "concurrent cleanup claim should be busy, not deleted");
    assert(fs.existsSync(ownerPath(claimed)), "live cleanup claim allowed deletion");
    const holderDone = claimHolderClosed;
    claimHolder.kill();
    await holderDone;
  } finally {
    if (claimHolder.exitCode === null && claimHolder.signalCode === null) claimHolder.kill();
    if (claimHolder.exitCode === null && claimHolder.signalCode === null) await claimHolderClosed;
  }
  fs.writeFileSync(claimFile, JSON.stringify({ version: 1, id: claimed.id, root: fs.realpathSync(claimedRoot), projectHash: crypto.createHash("sha256").update(fs.realpathSync(claimedRoot), "utf8").digest("hex"), pid: 2147483647, token: "stale-test-claim" }));
  const staleClaimReport = managed.sweep(claimedRoot);
  assert(staleClaimReport.pending.some(item => item.path === claimed.id), "stale cleanup claim must require visible manual recovery");
  assert(fs.existsSync(ownerPath(claimed)), "stale cleanup claim allowed deletion");
  fs.unlinkSync(claimFile);
  assert(managed.sweep(claimedRoot).removed.includes(claimed.id));

  const launchRoot = project("unresolved-launch");
  const launching = managed.createRun(launchRoot);
  launching.setLaunching(true);
  markStale(launching);
  const launchReport = managed.sweep(launchRoot);
  assert(launchReport.pending.some(item => item.reason === "unresolved-launch-lease"));
  assert(fs.existsSync(ownerPath(launching)));

  const retainedRoot = project("retained");
  const retained = managed.createRun(retainedRoot);
  assert.deepStrictEqual(retained.retain("candidate scratch cleanup unresolved"), { retained: true, reason: "candidate scratch cleanup unresolved" });
  const retainedChildProject = path.join(retained.temp, "child-project");
  fs.mkdirSync(retainedChildProject);
  const beforeRetainedChild = process.env.AGENT_MANAGED_TEMP;
  try {
    process.env.AGENT_MANAGED_TEMP = retained.root;
    process.env.AGENT_MANAGED_RUN_BINDING = retained.binding;
    assert.throws(() => managed.createRun(retainedChildProject), /Inherited managed-run lease is not active and validated/u,
      "a live owner with a different unresolved-retention reason must not authorize dependent runs");
  } finally {
    if (beforeRetainedChild === undefined) delete process.env.AGENT_MANAGED_TEMP;
    else process.env.AGENT_MANAGED_TEMP = beforeRetainedChild;
    if (inheritedManagedBinding === undefined) delete process.env.AGENT_MANAGED_RUN_BINDING; else process.env.AGENT_MANAGED_RUN_BINDING = inheritedManagedBinding;
  }
  assert(!fs.existsSync(managed.managedBase(retainedChildProject)), "rejected retained-parent registration must allocate no child namespace");
  markStale(retained);
  const retainedStatus = managed.status(retainedRoot).find(item => item.id === retained.id);
  assert.strictEqual(retainedStatus.retainedReason, "candidate scratch cleanup unresolved");
  const retainedReport = managed.sweep(retainedRoot);
  assert(retainedReport.pending.some(item => item.path === retained.id && item.reason === "candidate scratch cleanup unresolved"));
  assert(fs.existsSync(ownerPath(retained)), "explicitly retained workspace was deleted");

  const nestedRoot = project("nested-owner");
  const outer = managed.createRun(nestedRoot);
  const nested = path.join(outer.temp, "nested-run");
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, managed.OWNER_FILE), "{invalid nested marker");
  markStale(outer);
  const nestedReport = managed.sweep(nestedRoot);
  assert(nestedReport.errors.length > 0, "outer cleanup should refuse an invalid nested owner");
  assert(fs.existsSync(ownerPath(outer)), "outer owner marker should survive nested cleanup refusal");

  const invalidRoot = project("invalid");
  const invalid = managed.createRun(invalidRoot);
  fs.writeFileSync(ownerPath(invalid), "{bad json");
  fs.mkdirSync(path.join(managed.managedBase(invalidRoot), "unowned"));
  const invalidReport = managed.sweep(invalidRoot);
  assert(invalidReport.skipped.some(item => item.reason === "invalid-owner"));
  assert(fs.existsSync(invalid.root));
  assert(fs.existsSync(path.join(managed.managedBase(invalidRoot), "unowned")));

  await testOwnedLinkCleanup();

  const parentLinkRoot = project("parent-link");
  const realCache = path.join(fixture, "redirected-cache");
  fs.mkdirSync(realCache);
  try {
    const managedRoot = managed.managedBase(parentLinkRoot);
    fs.mkdirSync(path.dirname(managedRoot), { recursive: true });
    fs.symlinkSync(realCache, managedRoot, process.platform === "win32" ? "junction" : "dir");
    const rejected = managed.createRun(parentLinkRoot);
    assert.fail(`symlinked parent was accepted: ${rejected.root}`);
  } catch (error) { assert.match(error.message, /symlink or junction/u); }
  assert.deepStrictEqual(fs.readdirSync(realCache), []);
  process.stdout.write("managed-temp focused tests passed\n");
}

function cleanupFixtures() {
  try {
    for (const root of fixtureProjects) {
      const reportDirectory = reports.reportDirectory(root);
      const expectedReport = path.join(os.homedir(), ".cache", "apt-r", crypto.createHash("sha256").update(fs.realpathSync(root), "utf8").digest("hex").slice(0, 32));
      assert.strictEqual(path.resolve(reportDirectory), path.resolve(expectedReport), "fixture report cleanup must stay within its exact hashed namespace");
      if (fs.existsSync(reportDirectory)) {
        const reportStat = fs.lstatSync(reportDirectory);
        if (!reportStat.isSymbolicLink()) managed.assertNoLinks(reportDirectory);
        fs.rmSync(reportDirectory, { recursive: true, force: true });
      }
      const base = managed.managedBase(root);
      const expected = path.join(os.homedir(), ".cache", "apt-t", crypto.createHash("sha256").update(fs.realpathSync(root), "utf8").digest("hex").slice(0, 32));
      assert.strictEqual(path.resolve(base), path.resolve(expected), "fixture cleanup must stay within its exact hashed namespace");
      if (fs.existsSync(base)) {
        const stat = fs.lstatSync(base);
        if (!stat.isSymbolicLink()) managed.assertNoLinks(base);
        fs.rmSync(base, { recursive: true, force: true });
      }
    }
    fs.rmSync(fixture, { recursive: true, force: true });
  } finally {
    if (originalManagedCacheBase === undefined) delete process.env.APT_MANAGED_CACHE_BASE;
    else process.env.APT_MANAGED_CACHE_BASE = originalManagedCacheBase;
  }
}
main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; }).finally(cleanupFixtures);
