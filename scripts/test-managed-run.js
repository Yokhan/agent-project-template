#!/usr/bin/env node
"use strict";

// Focused lifecycle acceptance for scripts/managed-temp.js. All projects and
// generated files live in disposable fixtures; real tool paths are supplied
// explicitly and never modified.
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const managed = require("./lib/managed-temp.js");
const caches = require("./lib/managed-cache.js");
const reports = require("./lib/managed-run-report.js");
const managedCli = require("./managed-temp.js");

const cli = path.join(__dirname, "managed-temp.js");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-run-accept-"));
const projects = [];
const evidence = { schemaVersion: 1, startedAt: new Date().toISOString(), mode: process.argv.includes("--playwright-only") ? "playwright-browser-delta" : process.argv.includes("--browser-only") ? "browser-cli-delta" : process.argv.includes("--real") ? "real" : "focused", cases: [] };

function project(name) {
  const root = path.join(fixture, name);
  fs.mkdirSync(root, { recursive: true });
  projects.push(root);
  return root;
}
function cliRun(root, argv, extraEnv) {
  return spawnCaptured(process.execPath, [cli, ...argv], { cwd: root, env: extraEnv || process.env });
}
function spawnCaptured(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
function nodeCode(source) { return ["-e", source]; }
function noOwnedState(root, message) {
  assert.deepStrictEqual(managed.status(root), [], `${message}: managed scratch remains`);
  assert(!caches.status().some(item => item.projectRoot === fs.realpathSync(root) && item.active), `${message}: active cache lease remains`);
}
function record(name, result, detail = {}) {
  evidence.cases.push({ name, code: result.code, signal: result.signal, ...detail });
}
function reportFrom(result) {
  const match = result.stderr.match(/managed-run: (\{[^\r\n]+\})/u);
  return match ? JSON.parse(match[1]) : null;
}
function commandFor(options, command, args) { return ["run", ...options, "--", command, ...args]; }
function cacheNamespace(root) {
  const hash = crypto.createHash("sha256").update(fs.realpathSync(root), "utf8").digest("hex").slice(0, 32);
  return path.join(caches.cacheBase(), hash);
}
function removeOwnedNamespaces(root) {
  const namespace = cacheNamespace(root);
  if (fs.existsSync(namespace)) {
    managed.assertNoLinks(namespace);
    fs.rmSync(namespace, { recursive: true, force: false });
  }
  const scratch = managed.managedBase(root);
  if (fs.existsSync(scratch)) {
    managed.assertNoLinks(scratch);
    fs.rmSync(scratch, { recursive: true, force: false });
  }
}
function removeOwnedReports(root) {
  const directory = reports.reportDirectory(root);
  if (!fs.existsSync(directory)) return;
  const expected = path.join(os.homedir(), ".cache", "apt-r", crypto.createHash("sha256").update(fs.realpathSync(root), "utf8").digest("hex").slice(0, 32));
  assert.strictEqual(path.resolve(directory), path.resolve(expected), "report cleanup must stay within the exact fixture hash");
  managed.assertNoLinks(directory);
  fs.rmSync(directory, { recursive: true, force: false });
}
function removeOwnedReport(root, expectedRunId) {
  const directory = reports.reportDirectory(root);
  const file = path.join(directory, "last.json");
  const immutable = reports.reportFile(root, expectedRunId);
  const runs = path.dirname(immutable);
  managed.assertNoLinks(directory);
  managed.assertNoLinks(file);
  managed.assertNoLinks(runs);
  assert.deepStrictEqual(fs.readdirSync(directory).sort(), ["last.json", "runs"], "timeout fixture report namespace has unexpected contents");
  assert.deepStrictEqual(fs.readdirSync(runs), [`${expectedRunId}.json`], "timeout fixture immutable report directory has unexpected contents");
  const report = reports.readReport(root);
  assert.strictEqual(report.runId, expectedRunId, "timeout report belongs to another managed run");
  assert.strictEqual(reports.readReportPath(immutable).runId, expectedRunId);
  fs.unlinkSync(immutable);
  fs.rmdirSync(runs);
  fs.unlinkSync(file);
  fs.rmdirSync(directory);
}
function processIsAlive(pid, processGroup = false) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(processGroup && process.platform !== "win32" ? -pid : pid, 0); return true; }
  catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
}
function writeEvidence() {
  evidence.completedAt = new Date().toISOString();
  const destination = path.resolve(__dirname, "../.session-cache/resource-lifecycle-real.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  return destination;
}
function requireOk(result, label) {
  assert.strictEqual(result.code, 0, `${label} failed (${result.code}):\n${result.stderr}\n${result.stdout}`);
  assert(result.stderr.includes("managed-run:"), `${label} did not emit a bounded cleanup summary`);
}

async function focused() {
  const root = project("focused");
  const sentinel = path.join(root, "source-sentinel.txt");
  fs.writeFileSync(sentinel, "source remains unchanged\n");
  const sentinelHash = crypto.createHash("sha256").update(fs.readFileSync(sentinel)).digest("hex");

  const success = await cliRun(root, commandFor([], process.execPath, nodeCode(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'result.txt'),'owned');fs.writeFileSync(p.join(process.env.TEMP,'temp.txt'),'temporary');console.log(process.env.AGENT_RUN_OUTPUT)")));
  requireOk(success, "default ephemeral success");
  assert.deepStrictEqual(managed.status(root), [], "successful ephemeral run retained scratch");
  const successReport = await cliRun(root, ["report"]);
  const parsedSuccessReport = JSON.parse(successReport.stdout);
  const successMeta = reportFrom(success);
  assert(successMeta?.report && reports.readReportPath(successMeta.report).runId === parsedSuccessReport.runId, "immutable report path was not emitted or readable");
  assert.strictEqual(parsedSuccessReport.exitCode, 0);
  assert.strictEqual(parsedSuccessReport.scratchRemoved, true);
  assert(parsedSuccessReport.cleanup.accounting.observedBytesRemoved > 0, "cleanup report did not measure removed bytes");
  assert(!/source remains unchanged|result\.txt/u.test(successReport.stdout), "bounded report leaked source or artifact contents");
  record("ephemeral-success-and-measured-cleanup", success, { observedBytesRemoved: parsedSuccessReport.cleanup.accounting.observedBytesRemoved });

  const failure = await cliRun(root, commandFor([], process.execPath, nodeCode("process.exit(23)")));
  assert.strictEqual(failure.code, 23, `child exit code was not preserved: ${failure.stderr}`);
  assert.deepStrictEqual(managed.status(root), [], "failed command retained scratch");
  record("child-failure-exit-code-preserved", failure);

  const incompleteCacheReport = { removed: [], retained: [{ bytes: 2048, reason: "budget-exhausted" }], bytesObserved: 2048, bytesFreed: 0,
    filesFreed: 0, bytesRetained: 2048, complete: false, overBudget: true, activeOverBudget: false, reason: "budget-exhausted", elapsedMs: 1 };
  const originalPruneCaches = caches.pruneCaches;
  const successLauncher = async (_command, _args, launchOptions) => {
    await launchOptions.onLaunchAttempt();
    return { code: 0, treeStopped: true, proof: "focused-test-launcher" };
  };
  const housekeepingRoot = project("ephemeral-cache-housekeeping-warning");
  try {
    caches.pruneCaches = () => ({ ...incompleteCacheReport });
    const housekeepingExit = await managedCli.run(housekeepingRoot, process.execPath, [], { launcher: successLauncher });
    const housekeepingReport = reports.readReport(housekeepingRoot);
    assert.strictEqual(housekeepingExit, 0, "unrelated cache housekeeping failure changed a successful ephemeral run to failure");
    assert.strictEqual(housekeepingReport.exitCode, 0);
    assert.strictEqual(housekeepingReport.scratchRemoved, true, "ephemeral owned scratch cleanup did not complete");
    assert.strictEqual(housekeepingReport.cache.complete, false, "incomplete project cache report was hidden");
    assert.strictEqual(housekeepingReport.diagnostics.cacheHousekeeping.blocking, false, "ephemeral cache warning was marked blocking");
    assert.strictEqual(housekeepingReport.diagnostics.cacheHousekeeping.reason, "budget-exhausted");
    assert.strictEqual(housekeepingReport.diagnostics.cacheHousekeeping.remainingBytes, 2048);
    assert.strictEqual(housekeepingReport.diagnostics.cacheHousekeeping.remainingBytesComplete, false);
    record("ephemeral-owned-cleanup-with-nonblocking-cache-housekeeping", { code: housekeepingExit }, { scratchRemoved: true, cacheComplete: false, warning: housekeepingReport.diagnostics.cacheHousekeeping });
  } finally { caches.pruneCaches = originalPruneCaches; }

  const ownCleanupRoot = project("own-cleanup-failure-with-cache-warning");
  const originalCreateRun = managed.createRun;
  try {
    caches.pruneCaches = () => ({ ...incompleteCacheReport });
    managed.createRun = (...args) => {
      const workspace = originalCreateRun(...args);
      const finish = workspace.finish.bind(workspace);
      workspace.finish = options => {
        const result = finish(options);
        return { ...result, removed: false, report: { ...(result.report || {}), removed: false, reason: "injected-own-cleanup-failure" } };
      };
      return workspace;
    };
    const cleanupExit = await managedCli.run(ownCleanupRoot, process.execPath, [], { launcher: successLauncher });
    const cleanupReport = reports.readReport(ownCleanupRoot);
    assert.strictEqual(cleanupExit, 1, "unrelated cache warning masked an owned scratch cleanup failure");
    assert.strictEqual(cleanupReport.scratchRemoved, false);
    assert.strictEqual(cleanupReport.diagnostics.cacheHousekeeping.blocking, true);
    assert.strictEqual(cleanupReport.cache.complete, false);
    record("owned-cleanup-failure-remains-blocking-with-cache-warning", { code: cleanupExit }, { scratchRemoved: false, cacheWarningBlocking: true });
  } finally { caches.pruneCaches = originalPruneCaches; managed.createRun = originalCreateRun; }

  const sharedCacheRoot = project("shared-cache-prune-remains-strict");
  try {
    caches.pruneCaches = () => ({ ...incompleteCacheReport });
    const sharedExit = await managedCli.run(sharedCacheRoot, process.execPath, [], { cache: "shared", launcher: successLauncher });
    const sharedReport = reports.readReport(sharedCacheRoot);
    assert.strictEqual(sharedExit, 1, "shared-cache run ignored an incomplete required cache prune");
    assert.strictEqual(sharedReport.scratchRemoved, true);
    assert.strictEqual(sharedReport.cache.complete, false);
    assert.strictEqual(sharedReport.diagnostics.cacheHousekeeping.blocking, true);
    record("shared-cache-prune-remains-blocking", { code: sharedExit }, { scratchRemoved: true, cacheWarningBlocking: true });
  } finally { caches.pruneCaches = originalPruneCaches; }

  const privateArg = "ARG_PRIVATE_SENTINEL_72d01";
  const privateEnv = "ENV_PRIVATE_SENTINEL_43bb9";
  process.env.MANAGED_TEST_PRIVATE_SENTINEL = privateEnv;
  const originalStderrWrite = process.stderr.write;
  let emitted = "";
  process.stderr.write = function(chunk, ...rest) { emitted += String(chunk); return true; };
  try {
    await managedCli.run(root, process.execPath, ["-e", privateArg], { launcher: async () => { throw new Error(`prelaunch ${privateArg}`); } });
    const prelaunchReport = reports.readReport(root);
    assert.strictEqual(prelaunchReport.diagnostics.phase, "prelaunch-failure");
    assert.strictEqual(prelaunchReport.scratchRemoved, true, "a proven prelaunch failure should clean its run");
    assert(!JSON.stringify(prelaunchReport).includes(privateArg));
    emitted = "";
    await managedCli.run(root, process.execPath, ["-e", privateArg], { launcher: async (_command, _args, launchOptions) => {
      await launchOptions.onLaunchAttempt();
      throw new Error(`supervisor ${privateArg} ${privateEnv}`);
    } });
    const attemptedReport = reports.readReport(root);
    assert.strictEqual(attemptedReport.diagnostics.phase, "termination-unverified");
    assert.strictEqual(attemptedReport.scratchRemoved, false, "a failed supervisor handshake after launch attempt must retain its run");
    assert.strictEqual(attemptedReport.diagnostics.commandBasename, path.basename(process.execPath));
    assert.strictEqual(attemptedReport.diagnostics.argumentCount, 2);
    assert.match(attemptedReport.diagnostics.commandHash, /^[a-f0-9]{64}$/u);
    const attemptedOwner = managed.status(root).find(item => item.id === attemptedReport.runId);
    assert.strictEqual(attemptedOwner.retainedReason, "process-family-termination-unverified");
    assert(!JSON.stringify(attemptedReport).includes(privateArg) && !JSON.stringify(attemptedReport).includes(privateEnv));
    assert(!emitted.includes(privateArg) && !emitted.includes(privateEnv), "terminal diagnostics exposed raw arguments or environment values");
    managed.sweep(root);
    const retained = managed.status(root).find(item => item.id === attemptedReport.runId);
    if (retained) {
      const ownerFile = path.join(managed.managedBase(root), attemptedReport.runId, managed.OWNER_FILE);
      const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
      owner.pid = 2147483647; owner.retainedReason = null; owner.launching = false;
      fs.writeFileSync(ownerFile, JSON.stringify(owner));
      assert(managed.sweep(root).removed.includes(attemptedReport.runId));
    }
    const returnedSupervisorSecret = `RETURNED_SUPERVISOR_${privateArg}`;
    emitted = "";
    await managedCli.run(root, process.execPath, ["-e", privateArg], { launcher: async (_command, _args, launchOptions) => {
      await launchOptions.onLaunchAttempt();
      return { treeStopped: false, code: 0, proof: "supervisor-error", error: returnedSupervisorSecret };
    } });
    const returnedFailureReport = reports.readReport(root);
    assert.strictEqual(returnedFailureReport.scratchRemoved, false, "an unproven returned result must retain the run");
    assert.strictEqual(returnedFailureReport.diagnostics.phase, "termination-unverified");
    assert(returnedFailureReport.diagnostics.supervisorError?.sha256, "returned supervisor error fingerprint was not preserved");
    assert(!JSON.stringify(returnedFailureReport).includes(returnedSupervisorSecret) && !emitted.includes(returnedSupervisorSecret), "returned supervisor diagnostics exposed raw error text");
    const returnedOwnerFile = path.join(managed.managedBase(root), returnedFailureReport.runId, managed.OWNER_FILE);
    const returnedOwner = JSON.parse(fs.readFileSync(returnedOwnerFile, "utf8"));
    returnedOwner.pid = 2147483647; returnedOwner.retainedReason = null; returnedOwner.launching = false;
    fs.writeFileSync(returnedOwnerFile, JSON.stringify(returnedOwner));
    assert(managed.sweep(root).removed.includes(returnedFailureReport.runId));
  } finally {
    process.stderr.write = originalStderrWrite;
    delete process.env.MANAGED_TEST_PRIVATE_SENTINEL;
  }

  const timeoutRoot = project("timeout-only");
  const timeoutPidFile = path.join(timeoutRoot, "timeout-child-pid.txt");
  const timeoutEnv = { ...process.env };
  // This is a separate timeout project but remains bound to the outer managed
  // test run. Its dependent lease is settled by the parent's normal cleanup.
  // Exercise the explicit foreground contract on POSIX only.
  if (process.platform === "win32") delete timeoutEnv.AGENT_MANAGED_PROCESS_CONTRACT;
  else timeoutEnv.AGENT_MANAGED_PROCESS_CONTRACT = "foreground";
  const timeout = await cliRun(timeoutRoot, commandFor(["--timeout-ms", "3000"], process.execPath,
    nodeCode("require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)").concat(timeoutPidFile)), timeoutEnv);
  assert.strictEqual(timeout.code, 124, `timeout result was not reported: ${timeout.stderr}`);
  const timeoutReport = reports.readReport(timeoutRoot);
  assert(timeoutReport, "timeout command did not write its bounded report");
  assert(fs.existsSync(timeoutPidFile), "timeout child did not write its PID marker");
  const childPid = Number(fs.readFileSync(timeoutPidFile, "utf8"));
  fs.unlinkSync(timeoutPidFile);
  assert(Number.isInteger(childPid) && childPid > 0, "timeout child wrote an invalid PID marker");
  assert.strictEqual(timeoutReport.stopReason, "timeout");
  if (process.platform === "win32") {
    assert.strictEqual(timeoutReport.scratchRemoved, true, "Windows timeout must remove scratch after stopping the process tree");
    assert.strictEqual(timeoutReport.process?.treeStopped, true, "Windows timeout must include stopped-tree proof");
    assert.deepStrictEqual(managed.status(timeoutRoot), [], "Windows timeout retained scratch after supervisor stopped it");
    assert(!processIsAlive(childPid), "timed out Windows command process is still alive");
  } else {
    const retained = managed.status(timeoutRoot);
    assert.strictEqual(timeoutReport.scratchRemoved, false, "aborted POSIX foreground runs must retain scratch for recovery");
    assert.strictEqual(timeoutReport.process?.treeStopped, false, "POSIX foreground timeout must not claim whole-tree proof");
    assert.strictEqual(timeoutReport.process?.groupStopped, true, "timeout supervisor did not prove its process group stopped");
    assert.strictEqual(timeoutReport.process?.proof, "owned-process-group-absent");
    assert.strictEqual(retained.length, 1, "POSIX timeout fixture must retain its owned run marker");
    assert.strictEqual(retained[0].active, false, "POSIX timeout retained an active run");
    assert.strictEqual(retained[0].retainedReason, "process-family-termination-unverified");
    assert(!processIsAlive(childPid), "timed out POSIX command process is still alive");
    assert(!processIsAlive(retained[0].childPid), "timed out POSIX host supervisor is still alive");
    assert(!processIsAlive(childPid, true), "timed out POSIX process group is still alive");

    // The production sweep correctly preserves an aborted foreground marker.
    // Once its exact PID/group are independently proven stopped, this fixture
    // owns and removes only its hashed scratch/cache namespace and report.
    const refusal = managed.sweep(timeoutRoot, { budgetMs: 10000 });
    assert(refusal.pending.some(item => item.path === retained[0].id && item.reason === "process-family-termination-unverified"),
      "production sweep must retain the unverified foreground marker");
  }
  // The process is independently proven stopped above on each platform.
  // Remove only this fixture's exact hashed namespaces, including the empty
  // project base Windows leaves after normal run cleanup.
  removeOwnedNamespaces(timeoutRoot);
  assert.deepStrictEqual(managed.status(timeoutRoot), [], "verified timeout fixture teardown left scratch");
  removeOwnedReport(timeoutRoot, timeoutReport.runId);
  assert(!fs.existsSync(managed.managedBase(timeoutRoot)), "timeout scratch namespace remains after fixture teardown");
  assert(!fs.existsSync(cacheNamespace(timeoutRoot)), "timeout cache namespace remains after fixture teardown");
  assert(!fs.existsSync(reports.reportDirectory(timeoutRoot)), "timeout report namespace remains after fixture teardown");
  record("timeout-and-owned-process-stop", timeout, { scratchRetainedForRecovery: process.platform !== "win32", treeStopped: timeoutReport.process?.treeStopped, groupStopped: timeoutReport.process?.groupStopped });

  const rawBuild = await cliRun(root, commandFor([], "vite", ["build"]));
  assert.notStrictEqual(rawBuild.code, 0, "unprofiled Vite build was allowed");
  assert.match(rawBuild.stderr, /PROFILE_REQUIRED/u);
  assert.deepStrictEqual(managed.status(root), [], "rejected raw build left scratch");
  record("known-build-requires-profile", rawBuild);

  const exportDir = path.join(fixture, "exported-build");
  const exportResult = await cliRun(root, commandFor(["--keep-output", exportDir], process.execPath, nodeCode(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'artifact.txt'),'preserved')")));
  requireOk(exportResult, "explicit output export");
  assert.strictEqual(fs.readFileSync(path.join(exportDir, "artifact.txt"), "utf8"), "preserved");
  noOwnedState(root, "explicit output export");
  const overwrite = await cliRun(root, commandFor(["--keep-output", exportDir], process.execPath, nodeCode("process.exit(0)")));
  assert.notStrictEqual(overwrite.code, 0, "existing output destination was overwritten");
  assert.strictEqual(fs.readFileSync(path.join(exportDir, "artifact.txt"), "utf8"), "preserved");
  record("new-output-export-and-no-overwrite", exportResult);

  const cacheScript = "const fs=require('fs'),p=require('path');fs.mkdirSync(process.env.NODE_COMPILE_CACHE,{recursive:true});fs.writeFileSync(p.join(process.env.NODE_COMPILE_CACHE,'proof.bin'),Buffer.alloc(96,7));console.log(process.env.NODE_COMPILE_CACHE)";
  const first = await cliRun(root, commandFor(["--cache", "shared", "--cache-max-bytes", "1048576"], process.execPath, nodeCode(cacheScript)));
  requireOk(first, "shared cache first use");
  const sharedPath = first.stdout.trim().split(/\r?\n/u).at(-1);
  assert(fs.existsSync(path.join(sharedPath, "proof.bin")), "shared cache was not retained");
  const reused = await cliRun(root, commandFor(["--cache", "shared", "--cache-max-bytes", "1048576"], process.execPath, nodeCode(
    "const fs=require('fs'),p=require('path');if(!fs.existsSync(p.join(process.env.NODE_COMPILE_CACHE,'proof.bin')))process.exit(31);fs.writeFileSync(p.join(process.env.NODE_COMPILE_CACHE,'reuse.bin'),'reuse')")));
  requireOk(reused, "shared cache reuse");
  assert.strictEqual(path.resolve(sharedPath), path.resolve(caches.cachePath(root, "node-compile")));
  assert(fs.existsSync(path.join(sharedPath, "reuse.bin")), "reused cache content did not persist");
  const plateau = await cliRun(root, commandFor(["--cache", "shared", "--cache-max-bytes", "1048576"], process.execPath, nodeCode(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.NODE_COMPILE_CACHE,'reuse.bin'),'reuse')")));
  requireOk(plateau, "shared cache plateau");
  const cacheStatus = await cliRun(root, ["status"]);
  const cacheRows = JSON.parse(cacheStatus.stdout).caches;
  assert.strictEqual(cacheRows.length, 2, "shared npm and Node compile caches should be stable across runs");
  assert(cacheRows.every(item => !item.active && !item.uncertain), "completed shared cache lease is still active or uncertain");
  const pruned = await cliRun(root, ["cache-prune", "--cache-max-bytes", "0", "--cache-max-age-ms", String(7 * 86400000)]);
  assert.strictEqual(pruned.code, 0, `bounded quota prune failed: ${pruned.stderr}`);
  const pruneReport = JSON.parse(pruned.stdout).cache;
  assert(pruneReport.bytesFreed >= 96, "quota eviction did not report measured freed bytes");
  assert(!fs.existsSync(sharedPath), "idle over-budget cache survived explicit prune");
  record("shared-cache-reuse-plateau-and-bounded-eviction", pruned, { bytesFreed: pruneReport.bytesFreed, stableCacheKinds: cacheRows.map(item => item.kind).sort() });

  const stopFile = path.join(fixture, "release-first-cache-user");
  const concurrentScript = "const fs=require('fs'),p=require('path'),stop=process.argv[1],file=p.join(process.env.NODE_COMPILE_CACHE,'concurrent.bin');fs.writeFileSync(file,'shared');const end=Date.now()+20000;const timer=setInterval(()=>{if(fs.existsSync(stop)){clearInterval(timer);process.exit(0)}if(Date.now()>end){clearInterval(timer);process.exit(32)}},25)";
  const concurrentPromise = cliRun(root, commandFor(["--cache", "shared", "--cache-max-bytes", "1048576", "--timeout-ms", "25000"], process.execPath, [...nodeCode(concurrentScript), stopFile]));
  let active = false;
  const activeDeadline = Date.now() + 5000;
  while (Date.now() < activeDeadline) {
    const state = await cliRun(root, ["status"]);
    if (JSON.parse(state.stdout).caches.some(item => item.kind === "node-compile" && item.active)) { active = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  let concurrencyFailure = null, overlapping = null;
  try {
    assert(active, "could not observe the first shared cache lease while its command was running");
    overlapping = await cliRun(root, commandFor(["--cache", "shared", "--cache-max-bytes", "1048576"], process.execPath, nodeCode(
      "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.NODE_COMPILE_CACHE,'overlap.bin'),'second')")));
    assert.strictEqual(overlapping.code, 0, `overlapping cache use failed: ${overlapping.stderr}`);
    const whileFirstActive = caches.status().find(item => item.projectRoot === fs.realpathSync(root) && item.kind === "node-compile");
    assert(whileFirstActive?.active, "second run removed or released a cache still leased by the first process");
  } catch (error) { concurrencyFailure = error; }
  finally { fs.writeFileSync(stopFile, "release\n"); }
  const concurrent = await concurrentPromise;
  if (concurrencyFailure) throw concurrencyFailure;
  requireOk(concurrent, "first concurrent cache user");
  assert(fs.existsSync(path.join(caches.cachePath(root, "node-compile"), "concurrent.bin")), "concurrent cache contents were lost");
  noOwnedState(root, "concurrent shared cache users");
  record("concurrent-shared-cache-lease-survival", overlapping, { firstRunCode: concurrent.code, activePreserved: true });

  assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(sentinel)).digest("hex"), sentinelHash, "source sentinel changed");
  noOwnedState(root, "focused scenarios");
}

function parseRealArgs(argv) {
  const result = {};
  for (let index = argv.indexOf("--real") + 1; index < argv.length; index++) {
    const key = argv[index].replace(/^--/u, "");
    if (!key || argv[index] === "--real" || result[key] !== undefined || !argv[index + 1]) throw new Error(`Invalid real acceptance option: ${argv[index]}`);
    result[key] = argv[++index];
  }
  for (const key of ["vite", "tsc", "cargo", "browser"]) if (!result[key]) throw new Error(`Real acceptance requires --${key} PATH`);
  return result;
}
function parseBrowserOnly(argv) {
  const index = argv.indexOf("--browser-only");
  const browser = index >= 0 ? argv[index + 1] : null;
  if (!browser || !fs.existsSync(browser)) throw new Error("Browser-only acceptance requires --browser-only PATH to an installed Chromium executable");
  return browser;
}
function parsePlaywrightOnly(argv) {
  const index = argv.indexOf("--playwright-only");
  const modulePath = index >= 0 ? argv[index + 1] : null;
  const browser = argv[index + 2];
  if (!modulePath || !browser || !fs.existsSync(modulePath) || !fs.existsSync(browser)) {
    throw new Error("Playwright-only acceptance requires --playwright-only MODULE_PATH BROWSER_PATH");
  }
  return { modulePath, browser };
}
async function repeated(root, name, buildArgs, outputPaths, verifyResult) {
  const runs = [];
  for (let index = 0; index < 3; index++) {
    const result = await cliRun(root, buildArgs(index));
    requireOk(result, `${name} pass ${index + 1}`);
    if (verifyResult) verifyResult(result);
    for (const output of outputPaths) assert(!fs.existsSync(path.join(root, output)), `${name} left ${output} in source tree`);
    noOwnedState(root, `${name} pass ${index + 1}`);
    const report = reportFrom(result);
    assert(report && report.scratchRemoved, `${name} did not report scratch cleanup`);
    runs.push({ pass: index + 1, code: result.code, observedBytesRemoved: report.observedBytesRemoved, cacheBytesFreed: report.cacheBytesFreed, cacheBytesRetained: report.cacheBytesRetained });
  }
  record(name, { code: 0 }, { runs });
}
async function realBrowser(root, browser) {
  if (!fs.existsSync(browser)) throw new Error(`Missing installed browser executable: ${browser}`);
  const page = path.join(root, "browser.html");
  fs.writeFileSync(page, "<!doctype html><html><head><title>managed</title></head><body>ok</body></html>\n");
  const browserArgs = ["--profile", "browser", "--cache", "shared", "--timeout-ms", "30000"];
  await repeated(root, "real-chromium-headless-profile", () => commandFor(browserArgs, browser,
    ["--headless=new", "--no-sandbox", "--no-first-run", "--disable-background-networking", "--virtual-time-budget=1000", "--timeout=10000", "--dump-dom", require("url").pathToFileURL(page).href]), [], result => {
      assert.match(result.stdout, /<title>managed<\/title>/u, "headless Chromium did not render the local fixture");
    });
  noOwnedState(root, "real browser profile passes");
}
async function realPlaywright(root, modulePath, browser) {
  if (!fs.existsSync(modulePath) || !fs.existsSync(browser)) throw new Error("Playwright module or browser executable is missing");
  const sourcePath = path.join(root, "playwright-source-sentinel.txt");
  fs.writeFileSync(sourcePath, "browser fixture source remains unchanged\n");
  const sourceHash = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
  const script = [
    "const {chromium}=require(process.argv[1]);",
    "(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[2],args:['--disable-background-networking']});try{const page=await browser.newPage();await page.setContent('<!doctype html><html><head><title>managed playwright</title></head><body><main data-ready=\"yes\">owned</main></body></html>');const result=await page.evaluate(()=>({title:document.title,ready:document.querySelector('main')?.dataset.ready,text:document.querySelector('main')?.textContent}));if(result.title!=='managed playwright'||result.ready!=='yes'||result.text!=='owned')throw new Error('Unexpected rendered DOM: '+JSON.stringify(result));const screenshot=await page.screenshot({type:'png'});if(screenshot.length<100)throw new Error('Rendered screenshot buffer is unexpectedly small');console.log(JSON.stringify({title:result.title,ready:result.ready,screenshotBytes:screenshot.length}));}finally{await browser.close()}})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1});",
  ].join("");
  await repeated(root, "real-playwright-browser-render-and-close", () => commandFor(["--timeout-ms", "30000"], process.execPath, ["-e", script, modulePath, browser]), [], result => {
    const rendered = JSON.parse(result.stdout.trim());
    assert.strictEqual(rendered.title, "managed playwright");
    assert.strictEqual(rendered.ready, "yes");
    assert(rendered.screenshotBytes >= 100);
  });
  assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"), sourceHash, "Playwright modified the fixture source");
  noOwnedState(root, "Playwright browser passes");
}
async function real() {
  const paths = parseRealArgs(process.argv);
  for (const key of ["vite", "tsc", "cargo", "browser"]) if (!fs.existsSync(paths[key])) throw new Error(`Missing installed ${key} executable: ${paths[key]}`);
  const root = project("real-tools");
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><html><head><title>managed fixture</title></head><body><script type=module src=/main.js></script></body></html>\n");
  fs.writeFileSync(path.join(root, "main.js"), "document.body.dataset.ready='yes';\n");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "main.ts"), "export const answer: number = 42;\n");
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2020", module: "ESNext", strict: true, rootDir: "src" }, include: ["src/**/*.ts"] }, null, 2));
  const cargo = path.join(root, "cargo-fixture");
  fs.mkdirSync(path.join(cargo, "src"), { recursive: true });
  fs.writeFileSync(path.join(cargo, "Cargo.toml"), "[package]\nname = \"managed_acceptance\"\nversion = \"0.1.0\"\nedition = \"2021\"\n");
  fs.writeFileSync(path.join(cargo, "src", "main.rs"), "fn main(){println!(\"managed\");}\n");
  const sourceHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "main.js"))).digest("hex");

  await repeated(root, "real-vite-build", () => commandFor(["--profile", "vite", "--cache", "shared"], process.execPath, [paths.vite, "build"]), ["dist"], result => {
    assert.match(result.stdout, /built in/u, "Vite did not complete a real build");
  });
  await repeated(root, "real-typescript-compile", () => commandFor(["--profile", "tsc", "--cache", "shared"], process.execPath, [paths.tsc, "--project", root]), ["dist", "tsconfig.tsbuildinfo"], result => {
    assert.strictEqual(result.code, 0);
  });
  const traceCli = await cliRun(root, commandFor(["--profile", "tsc"], process.execPath, [paths.tsc, "--generateTrace", path.join(root, "trace-out"), "--project", root]));
  assert.notStrictEqual(traceCli.code, 0, "case-insensitive TypeScript trace option was allowed");
  assert(!fs.existsSync(path.join(root, "trace-out")), "rejected trace option created source output");
  const traceConfig = path.join(root, "trace-config");
  fs.mkdirSync(traceConfig);
  fs.writeFileSync(path.join(traceConfig, "tsconfig.json"), JSON.stringify({ compilerOptions: { generateTrace: "trace" }, files: ["../src/main.ts"] }));
  const traceConfigResult = await cliRun(root, commandFor(["--profile", "tsc"], process.execPath, [paths.tsc, "--project", traceConfig]));
  assert.notStrictEqual(traceConfigResult.code, 0, "TypeScript config trace output was allowed");
  record("typescript-trace-output-rejected", traceConfigResult);

  await repeated(cargo, "real-cargo-offline-build", () => commandFor(["--profile", "cargo", "--cache", "shared"], paths.cargo,
    ["build", "--offline", "--manifest-path", path.join(cargo, "Cargo.toml")]), ["target"], result => assert.match(result.stdout + result.stderr, /Finished/u));

  await realBrowser(root, paths.browser);
  assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "main.js"))).digest("hex"), sourceHash, "real build modified source fixture");
  const finalStatus = await cliRun(root, ["status"]);
  assert.deepStrictEqual(JSON.parse(finalStatus.stdout).runs, [], "real acceptance left a managed scratch run");
  record("real-source-integrity-and-final-status", finalStatus);
}

async function cleanup() {
  for (const root of projects) {
    try {
      const prune = await cliRun(root, ["cache-prune", "--cache-max-bytes", "0", "--cache-max-age-ms", "0", "--budget-ms", "5000"]);
      if (prune.code !== 0) throw new Error(`cache prune failed: ${prune.stderr}\n${prune.stdout}`);
      const sweep = await cliRun(root, ["sweep", "--budget-ms", "5000"]);
      if (sweep.code !== 0) throw new Error(`scratch sweep failed: ${sweep.stderr}\n${sweep.stdout}`);
      const status = await cliRun(root, ["status"]);
      const parsed = JSON.parse(status.stdout);
      if (parsed.runs.length || parsed.caches.length) throw new Error(`fixture still owns resources: ${JSON.stringify({ runs: parsed.runs.length, caches: parsed.caches.length })}`);
      removeOwnedNamespaces(root);
      removeOwnedReports(root);
    } catch (error) {
      evidence.cleanupError = `${error.message}`;
      throw error;
    }
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}

(async () => {
  let primaryError;
  try {
    if (process.argv.includes("--browser-only")) await realBrowser(project("real-browser"), parseBrowserOnly(process.argv));
    else if (process.argv.includes("--playwright-only")) {
      const inputs = parsePlaywrightOnly(process.argv);
      await realPlaywright(project("real-playwright"), inputs.modulePath, inputs.browser);
    }
    else {
      await focused();
      if (process.argv.includes("--real")) await real();
    }
  } catch (error) { primaryError = error; evidence.failure = error.stack || error.message; }
  try { await cleanup(); }
  catch (error) { primaryError ||= error; evidence.cleanupFailure = error.stack || error.message; }
  const evidencePath = writeEvidence();
  if (primaryError) {
    process.stderr.write(`managed-run-acceptance: ${primaryError.stack || primaryError.message}\nevidence: ${evidencePath}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`managed-run-acceptance: ${evidence.cases.length} cases recorded\nevidence: ${evidencePath}\n`);
  }
})().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
