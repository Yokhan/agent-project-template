"use strict";

// Focused safety tests for the managed-temp API and CLI. All fixtures are disposable.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { performance } = require("perf_hooks");
const { spawn } = require("child_process");
const { Worker } = require("worker_threads");
const managed = require("./lib/managed-temp.js");
const reports = require("./lib/managed-run-report.js");
const ownershipApi = require("./lib/managed-run-ownership.js");
const { exportBuild, run: runManaged } = require("./managed-temp.js");

const observationSourceFiles = ["scripts/test-managed-temp.js", "scripts/managed-temp.js", "scripts/lib/managed-temp.js"];
function observationSourceHashes() {
  const repositoryRoot = path.resolve(__dirname, "..");
  return Object.fromEntries(observationSourceFiles.map(relative => [
    relative,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(repositoryRoot, relative))).digest("hex"),
  ]));
}

const cli = path.join(__dirname, "managed-temp.js");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-temp-test-"));
const originalManagedCacheBase = process.env.APT_MANAGED_CACHE_BASE;
process.env.APT_MANAGED_CACHE_BASE = path.join(fixture, "managed-cache");
const fixtureProjects = new Set();
const strictObservationEvidence = {
  directory: path.join(__dirname, "..", ".session-cache", `strict-observation-tests-${new Date().toISOString().replace(/[:.]/gu, "-")}-${process.pid}`),
  cases: [],
};
const liveObservationEvidence = {
  directory: path.join(__dirname, "..", ".session-cache", `live-observation-tests-${new Date().toISOString().replace(/[:.]/gu, "-")}-${process.pid}`),
  cases: [],
  sourceHashesBefore: observationSourceHashes(),
};
const scanEnvelopeEvidence = {
  directory: path.join(__dirname, "..", ".session-cache", `scan-envelope-tests-${new Date().toISOString().replace(/[:.]/gu, "-")}-${process.pid}`),
  cases: [],
  sourceHashesBefore: observationSourceHashes(),
};
const workerObservationEvidence = {
  directory: path.join(__dirname, "..", ".session-cache", `r11-worker-tests-${new Date().toISOString().replace(/[:.]/gu, "-")}-${process.pid}`),
  cases: [],
  sourceHashesBefore: null,
};
let activeObservationEvidence = strictObservationEvidence;
let strictObservationFailure = null;
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
    { name: "junction", create: markerPath => { fs.symlinkSync(outside, markerPath, "junction"); return true; }, remove: markerPath => fs.unlinkSync(markerPath) },
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

function managedRunResult(result) {
  const line = result.stderr.split(/\r?\n/u).find(entry => entry.startsWith("managed-run: "));
  assert(line, `managed run summary missing: ${result.stderr}`);
  const summary = JSON.parse(line.slice("managed-run: ".length));
  return { summary, report: reports.readReportPath(summary.report) };
}

function recordStrictObservationCase(name, summary, report, syntheticBoundary = false) {
  const observation = report.workObservation;
  const entry = {
    name,
    syntheticBoundary,
    runId: summary?.runId || report.runId || null,
    outerExitCode: summary?.exitCode ?? report.exitCode ?? null,
    scratchRemoved: summary?.scratchRemoved ?? report.scratchRemoved ?? null,
    stopReason: report.stopReason || null,
    process: report.process ? {
      commandExitCode: report.process.commandExitCode ?? null,
      treeStopped: report.process.treeStopped === true,
      groupStopped: report.process.groupStopped === true,
      supervision: report.process.supervision || null,
      proof: report.process.proof || null,
      rootInJob: report.process.rootInJob ?? null,
      killOnClose: report.process.killOnClose ?? null,
    } : null,
    cleanup: report.cleanup?.accounting ? {
      observedBytesRemoved: report.cleanup.accounting.observedBytesRemoved,
      observedFilesRemoved: report.cleanup.accounting.observedFilesRemoved,
      observedBytesRemaining: report.cleanup.accounting.observedBytesRemaining,
      observedFilesRemaining: report.cleanup.accounting.observedFilesRemaining,
      remainingComplete: report.cleanup.accounting.remainingComplete,
    } : null,
    workObservation: observation ? {
      mode: observation.mode,
      samples: observation.samples,
      completeSamples: observation.completeSamples,
      incompleteSamples: observation.incompleteSamples,
      last: observation.last,
      lastPeriodic: observation.lastPeriodic ?? null,
      final: observation.final,
      failureReason: observation.failureReason,
      exportObservation: report.exportObservation || null,
      coverage: observation.coverage,
    } : null,
  };
  activeObservationEvidence.cases.push(entry);
  return entry;
}

function recordDirectObservation(name, observed, options) {
  activeObservationEvidence.cases.push({
    name,
    syntheticBoundary: true,
    observerOptions: options,
    workObservation: { bytes: observed.bytes, files: observed.files, complete: observed.complete, reason: observed.reason || null },
  });
}

function writeStrictObservationReceipt(error = null) {
  if (!process.argv.includes("--strict-observation-only") && !process.argv.includes("--strict-threshold-export-only") &&
      !process.argv.includes("--live-observation-only") && !process.argv.includes("--live-timeout-only")) return;
  fs.mkdirSync(activeObservationEvidence.directory, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    status: error ? "failed" : "passed",
    error: error ? String(error.stack || error.message || error).slice(0, 2000) : null,
    sourceHashesBefore: activeObservationEvidence.sourceHashesBefore || observationSourceHashes(),
    sourceHashesAtReceipt: observationSourceHashes(),
    cases: activeObservationEvidence.cases,
  };
  const file = path.join(activeObservationEvidence.directory, "receipt.json");
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`strict-observation-receipt: ${file}\n`);
}

function writeScanEnvelopeReceipt(error = null) {
  if (!process.argv.includes("--scan-envelope-only")) return;
  fs.mkdirSync(scanEnvelopeEvidence.directory, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    status: error ? "failed" : "passed",
    error: error ? String(error.stack || error.message || error).slice(0, 2000) : null,
    sourceHashesBefore: scanEnvelopeEvidence.sourceHashesBefore,
    sourceHashesAtReceipt: observationSourceHashes(),
    inputIdentity: scanEnvelopeEvidence.inputIdentity || null,
    cases: scanEnvelopeEvidence.cases,
  };
  const file = path.join(scanEnvelopeEvidence.directory, "receipt.json");
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`scan-envelope-receipt: ${file}\n`);
}

function workerObservationSourceHashes() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const relativeFiles = [
    "scripts/test-managed-temp.js",
    "scripts/managed-temp.js",
    "scripts/lib/managed-temp.js",
    "scripts/lib/managed-observation-worker.js",
  ];
  return Object.fromEntries(relativeFiles.map(relative => [
    relative,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(repositoryRoot, relative))).digest("hex"),
  ]));
}

function writeR11WorkerReceipt(error = null) {
  if (!process.argv.includes("--r11-worker-observation-only")) return;
  fs.mkdirSync(workerObservationEvidence.directory, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    status: error ? "failed" : "passed",
    error: error ? String(error.stack || error.message || error).slice(0, 2500) : null,
    sourceHashesBefore: workerObservationEvidence.sourceHashesBefore,
    sourceHashesAtReceipt: workerObservationSourceHashes(),
    cases: workerObservationEvidence.cases,
  };
  const file = path.join(workerObservationEvidence.directory, "receipt.json");
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`r11-worker-receipt: ${file}\n`);
}

function recordR11WorkerCase(name, result, { simulated = false, events = [], extra = {} } = {}) {
  const report = result?.report;
  const entry = {
    name,
    simulated,
    runId: result?.summary?.runId || report?.runId || null,
    exitCode: result?.exitCode ?? null,
    scratchRemoved: report?.scratchRemoved ?? null,
    stopReason: report?.stopReason || null,
    output: report?.output || null,
    limits: report?.limits || null,
    workObservation: report?.workObservation ? {
      mode: report.workObservation.mode,
      executor: report.workObservation.executor,
      scanBudgetMs: report.workObservation.scanBudgetMs,
      maxAgeMs: report.workObservation.maxAgeMs,
      last: report.workObservation.last,
      lastPeriodic: report.workObservation.lastPeriodic || null,
      final: report.workObservation.final,
      exportObservation: report.exportObservation || null,
      worker: report.workObservation.worker || null,
      coverage: report.workObservation.coverage,
    } : null,
    process: simulated ? null : report?.process || null,
    cleanup: report?.cleanup || null,
    events,
    ...extra,
  };
  workerObservationEvidence.cases.push(entry);
  return entry;
}

function createVirtualObservationTiming() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const dueTimers = () => [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
  const timing = {
    now: () => now,
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { at: now + Math.max(0, delay), callback });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  return {
    timing,
    now: () => now,
    advance(milliseconds, { fireDue = true } = {}) {
      now += milliseconds;
      if (!fireDue) return;
      for (;;) {
        const due = dueTimers()[0];
        if (!due) break;
        timers.delete(due[0]);
        due[1].callback();
      }
    },
    fireDue() {
      for (;;) {
        const due = dueTimers()[0];
        if (!due) break;
        timers.delete(due[0]);
        due[1].callback();
      }
    },
  };
}

function workerModeOptions(workerFactory, overrides = {}) {
  return {
    "work-observation": "strict",
    "work-observation-executor": "worker",
    "work-observation-budget-ms": 10000,
    "work-observation-max-age-ms": 15000,
    "work-observation-max-entries": 100000,
    "process-contract": "contained",
    "max-work-bytes": 4 * 1024 ** 3,
    "min-free-bytes": 2 * 1024 ** 3,
    "timeout-ms": 40000,
    observationWorkerFactory: workerFactory,
    ...overrides,
  };
}

function assertWorkerMode(report, label) {
  const observation = report.workObservation;
  assert(observation, `${label}: missing workObservation`);
  assert.strictEqual(observation.mode, "strict");
  assert.strictEqual(observation.executor, "worker");
  assert.strictEqual(observation.scanBudgetMs, 10000);
  assert.strictEqual(observation.maxAgeMs, 15000);
  assert.strictEqual(report.limits.maxWorkBytes, 4 * 1024 ** 3);
  assert.strictEqual(report.limits.minFreeBytes, 2 * 1024 ** 3);
}

function assertWorkerSettled(report, label) {
  assert.strictEqual(report.workObservation.worker?.settled, true, `${label}: Worker exit was not confirmed`);
  assert.strictEqual(report.workObservation.worker?.scanSettled, true, `${label}: active scan was not settled`);
  assert(Number.isInteger(report.workObservation.worker?.exitCode), `${label}: Worker exit code is missing`);
}

function assertNoOverlappingScanRequests(events, label) {
  let inFlight = 0;
  let maximum = 0;
  for (const event of events) {
    if (event.direction === "request") {
      inFlight += 1;
      maximum = Math.max(maximum, inFlight);
    } else if (event.direction === "message" && event.type === "result") inFlight = Math.max(0, inFlight - 1);
  }
  assert(maximum <= 1, `${label}: overlapping scans observed (${maximum})`);
  return maximum;
}

function resultForWorkerRequest(request, overrides = {}) {
  return {
    type: "result",
    version: 1,
    runId: request.runId,
    observationId: request.observationId,
    phase: request.phase,
    scanKind: request.scanKind,
    status: "incomplete",
    complete: false,
    bytes: 0,
    files: 0,
    reason: "budget-exhausted",
    transientMissingEntries: 0,
    elapsedMs: 0,
    entriesExamined: 0,
    exhaustedBy: "time",
    ...overrides,
  };
}

function controlledWorkerFactory(behavior, virtualTime, events) {
  return (entryPath, workerOptions) => {
    assert(path.isAbsolute(entryPath), "worker factory did not receive a trusted absolute production entry path");
    const workerData = workerOptions.workerData;
    class ControlledWorker extends EventEmitter {
      constructor() {
        super();
        this.terminated = false;
        setImmediate(() => this.emit("message", { type: "ready", version: 1, runId: workerData.runId }));
      }
      postMessage(request) {
        if (request?.type !== "scan") return;
        events.push({ direction: "request", phase: request.phase, scanKind: request.scanKind, observationId: request.observationId, atMs: virtualTime.now() });
        if (behavior === "malformed") {
          setImmediate(() => this.emit("message", resultForWorkerRequest(request, { runId: "00000000-0000-4000-8000-000000000000" })));
        } else if (behavior === "worker-error") {
          setImmediate(() => this.emit("error", new Error("controlled worker error")));
        } else if (behavior === "late-result") {
          setImmediate(() => {
            virtualTime.advance(10001, { fireDue: false });
            this.emit("message", resultForWorkerRequest(request));
            virtualTime.fireDue();
          });
        } else if (behavior === "invalid-complete-counter") {
          setImmediate(() => this.emit("message", resultForWorkerRequest(request, {
            status: "complete", complete: true, reason: null, bytes: 0, files: 0,
            entriesExamined: 100001, exhaustedBy: null,
          })));
        } else if (behavior === "pending-deadline" || behavior === "unsettled-retain") {
          setImmediate(() => virtualTime.advance(10001));
        }
      }
      terminate() {
        if (behavior === "unsettled-retain") {
          setImmediate(() => virtualTime.advance(10001));
          return new Promise(() => {});
        }
        return new Promise(resolve => setImmediate(() => { this.emit("exit", 0); resolve(0); }));
      }
    }
    return new ControlledWorker();
  };
}

function tracedWorkerFactory({ preloadPath = null, events = [] } = {}) {
  return (entryPath, workerOptions) => {
    assert(path.isAbsolute(entryPath), "worker factory did not receive a trusted absolute production entry path");
    const options = { ...workerOptions };
    if (preloadPath) options.execArgv = [...(options.execArgv || []), "--require", preloadPath];
    const worker = new Worker(entryPath, options);
    const originalPostMessage = worker.postMessage.bind(worker);
    let inFlight = 0;
    let maxInFlight = 0;
    worker.postMessage = message => {
      if (message?.type === "scan") {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        events.push({ direction: "request", phase: message.phase, scanKind: message.scanKind, observationId: message.observationId, atMs: performance.now() });
      }
      return originalPostMessage(message);
    };
    worker.on("message", message => {
      if (message?.type === "result") inFlight = Math.max(0, inFlight - 1);
      events.push({ direction: "message", type: message?.type || null, phase: message?.phase || null,
        scanKind: message?.scanKind || null, status: message?.status || null, observationId: message?.observationId || null,
        complete: message?.complete ?? null, reason: message?.reason || null, elapsedMs: message?.elapsedMs ?? null,
        entriesExamined: message?.entriesExamined ?? null, exhaustedBy: message?.exhaustedBy ?? null, atMs: performance.now() });
    });
    worker.on("error", error => events.push({ direction: "error", name: error.name, code: error.code || null, atMs: performance.now() }));
    worker.on("exit", exitCode => events.push({ direction: "exit", exitCode, maxInFlight, atMs: performance.now() }));
    return worker;
  };
}

function lateCancelAckWorkerFactory(virtualTime, events, onPeriodicRequest) {
  return (entryPath, workerOptions) => {
    assert(path.isAbsolute(entryPath), "worker factory did not receive a trusted absolute production entry path");
    const rawWorker = new Worker(entryPath, workerOptions);
    const relay = new EventEmitter();
    const originalPostMessage = rawWorker.postMessage.bind(rawWorker);
    const cancelBuffer = workerOptions.workerData.cancelBuffer;
    const cancelView = cancelBuffer instanceof Int32Array ? cancelBuffer : new Int32Array(cancelBuffer);
    let periodicResult = null;
    let lateAckSent = false;
    const pollCancellation = () => {
      if (lateAckSent) return;
      if (Atomics.load(cancelView, 0) === 1 && periodicResult) {
        lateAckSent = true;
        virtualTime.advance(10001, { fireDue: false });
        relay.emit("message", {
          ...periodicResult,
          status: "cancelled",
          complete: false,
          reason: "cancelled",
          exhaustedBy: null,
        });
        virtualTime.fireDue();
        return;
      }
      setImmediate(pollCancellation);
    };
    rawWorker.on("message", message => {
      if (message?.type === "result" && message.phase === "periodic") {
        periodicResult = message;
        events.push({ direction: "held-real-periodic-result", status: message.status, observationId: message.observationId, atMs: performance.now() });
        return;
      }
      events.push({ direction: "message", type: message?.type || null, phase: message?.phase || null, status: message?.status || null, atMs: performance.now() });
      relay.emit("message", message);
    });
    rawWorker.on("error", error => { events.push({ direction: "error", name: error.name, atMs: performance.now() }); relay.emit("error", error); });
    rawWorker.on("exit", code => { events.push({ direction: "exit", exitCode: code, atMs: performance.now() }); relay.emit("exit", code); });
    relay.postMessage = message => {
      if (message?.type === "scan" && message.phase === "periodic") {
        events.push({ direction: "request", phase: message.phase, observationId: message.observationId, atMs: performance.now() });
        onPeriodicRequest();
        setImmediate(pollCancellation);
      }
      return originalPostMessage(message);
    };
    relay.terminate = () => rawWorker.terminate();
    return relay;
  };
}

function writeSlowWorkerPreload(delayMsByPeriodicScan) {
  fs.mkdirSync(workerObservationEvidence.directory, { recursive: true });
  const eventPath = path.join(workerObservationEvidence.directory, `slow-worker-events-${process.pid}.jsonl`);
  const preloadPath = path.join(workerObservationEvidence.directory, `slow-worker-preload-${process.pid}.cjs`);
  const preload = [
    "'use strict';",
    "const fs = require('fs');",
    "const { parentPort } = require('worker_threads');",
    `const eventPath = ${JSON.stringify(eventPath)};`,
    `const delayMsByPeriodicScan = ${JSON.stringify(delayMsByPeriodicScan)};`,
    "let delayNextPeriodicLstat = false;",
    "let periodicScanCount = 0;",
    "let currentDelayMs = 0;",
    "const record = event => fs.appendFileSync(eventPath, JSON.stringify({ event, at: Number(process.hrtime.bigint()) / 1e6 }) + '\\n');",
    "parentPort.on('message', message => { if (message?.type === 'scan' && message.phase === 'periodic') { periodicScanCount += 1; currentDelayMs = delayMsByPeriodicScan[Math.min(periodicScanCount - 1, delayMsByPeriodicScan.length - 1)]; delayNextPeriodicLstat = currentDelayMs > 0; record('periodic-scan-' + periodicScanCount + '-requested'); } });",
    "const originalLstatSync = fs.lstatSync;",
    "fs.lstatSync = function (...args) { if (delayNextPeriodicLstat) { delayNextPeriodicLstat = false; record('periodic-' + periodicScanCount + '-lstat-delay-started'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, currentDelayMs); record('periodic-' + periodicScanCount + '-lstat-delay-ended'); } return originalLstatSync.apply(this, args); };",
  ].join("\n");
  fs.writeFileSync(preloadPath, `${preload}\n`, { flag: "wx" });
  return { eventPath, preloadPath };
}

async function runProgrammaticWorker(root, command, args, options) {
  let stderr = "";
  const originalWrite = process.stderr.write;
  process.stderr.write = function (chunk, encoding, callback) {
    stderr += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
    if (typeof encoding === "function") encoding();
    else if (typeof callback === "function") callback();
    return true;
  };
  let exitCode;
  try { exitCode = await runManaged(root, command, args, options); }
  finally { process.stderr.write = originalWrite; }
  const line = stderr.split(/\r?\n/u).find(entry => entry.startsWith("managed-run: "));
  assert(line, `programmatic managed run summary missing: ${stderr}`);
  const summary = JSON.parse(line.slice("managed-run: ".length));
  return { exitCode, summary, report: reports.readReportPath(summary.report), stderr };
}

function strictCliArgs(code, options = {}) {
  const args = [
    "run",
    "--work-observation", options.mode || "strict",
    "--work-observation-budget-ms", String(options.budgetMs ?? 1000),
    "--work-observation-max-entries", String(options.maxEntries ?? 1000),
    "--max-work-bytes", String(options.maxWorkBytes ?? 1024 * 1024),
  ];
  if (options.minFreeBytes !== undefined) args.push("--min-free-bytes", String(options.minFreeBytes));
  if (options.timeoutMs !== undefined) args.push("--timeout-ms", String(options.timeoutMs));
  if (options.keepOutput) args.push("--keep-output", options.keepOutput);
  args.push("--", process.execPath, "-e", code);
  return args;
}

async function testStrictThresholdExport() {
  fs.mkdirSync(strictObservationEvidence.directory, { recursive: true });
  const thresholdRoot = project("observation-threshold-export");
  const thresholdExport = path.join(fixture, "observation-threshold-export-target");
  const thresholdCap = 1024 * 1024;
  const threshold = await runCli(thresholdRoot, strictCliArgs(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'over-cap.bin'),Buffer.alloc(2*1024*1024,7))",
    { maxEntries: 100, maxWorkBytes: thresholdCap, keepOutput: thresholdExport },
  ));
  const thresholdResult = managedRunResult(threshold);
  const thresholdReport = thresholdResult.report;
  recordStrictObservationCase("strict-threshold-breach-blocks-export", thresholdResult.summary, thresholdReport);
  assert.strictEqual(threshold.code, 1, threshold.stderr);
  assertObservationShape(thresholdReport.workObservation, "strict");
  assert.strictEqual(thresholdReport.stopReason, "observed-work-budget");
  assert(thresholdReport.workObservation.final?.complete, "threshold rejection must retain a complete final sample");
  assert(thresholdReport.process?.treeStopped, "over-cap child did not stop before the final observation");
  assert(thresholdReport.workObservation.final.bytes >= thresholdCap,
    `threshold report did not show observed bytes at/above cap: ${JSON.stringify(thresholdReport.workObservation.final)}`);
  assert.strictEqual(thresholdReport.output, null, "over-cap workspace reported exported output");
  assert(!fs.existsSync(thresholdExport), "strict observed-work-budget allowed keep-output export");
}

function assertObservationShape(observation, mode) {
  assert(observation, "workObservation report is missing");
  assert.strictEqual(observation.mode, mode);
  assert(Number.isSafeInteger(observation.scanBudgetMs) && observation.scanBudgetMs > 0);
  assert(Number.isSafeInteger(observation.scanMaxEntries) && observation.scanMaxEntries > 0);
  assert(Number.isSafeInteger(observation.samples) && observation.samples > 0);
  assert.strictEqual(observation.completeSamples + observation.incompleteSamples, observation.samples);
  for (const sample of [observation.last, observation.final].filter(Boolean)) {
    assert(typeof sample.phase === "string");
    assert(Number.isSafeInteger(sample.bytes) && Number.isSafeInteger(sample.files));
    assert(typeof sample.complete === "boolean");
    assert(Number.isSafeInteger(sample.transientMissingEntries) && sample.transientMissingEntries >= 0);
    assert.strictEqual(sample.scanKind, mode === "best-effort" ? "best-effort" : "stable");
  }
  if (observation.lastPeriodic) {
    assert.strictEqual(observation.lastPeriodic.phase, "periodic");
    assert.strictEqual(observation.lastPeriodic.scanKind, mode === "best-effort" ? "best-effort" : "live");
    assert(Number.isSafeInteger(observation.lastPeriodic.transientMissingEntries) && observation.lastPeriodic.transientMissingEntries >= 0);
  }
  assert.strictEqual(observation.coverage, "sampled-owned-run-tree");
}

function assertOwnedTermination(summary, report, context) {
  assert.strictEqual(summary.scratchRemoved, true, `${context}: managed summary did not confirm scratch removal`);
  assert.strictEqual(report.scratchRemoved, true, `${context}: report did not confirm scratch removal`);
  assert.strictEqual(report.process?.treeStopped, true, `${context}: Windows Job did not confirm the owned process tree stopped`);
  assert.strictEqual(report.process?.rootInJob, true, `${context}: root process was not proven inside its Windows Job`);
  assert.strictEqual(report.process?.killOnClose, true, `${context}: Windows Job kill-on-close was not proven`);
  assert.match(report.process?.proof || "", /job-active-processes:0;root-in-job:True;root-stopped:True;kill-on-close:True/u,
    `${context}: missing zero-active-process Job proof`);
  assert.strictEqual(report.cleanup?.accounting?.remainingComplete, true, `${context}: cleanup accounting is incomplete`);
  assert.strictEqual(report.cleanup.accounting.observedBytesRemaining, 0, `${context}: owned scratch bytes remain`);
  assert.strictEqual(report.cleanup.accounting.observedFilesRemaining, 0, `${context}: owned scratch files remain`);
  assert.deepStrictEqual(report.cleanup.pending, [], `${context}: cleanup left pending entries`);
  assert.deepStrictEqual(report.cleanup.errors, [], `${context}: cleanup reported errors`);
  assert.deepStrictEqual(report.cleanup.busy, [], `${context}: cleanup reported busy entries`);
}

async function testStrictWorkObservation() {
  fs.mkdirSync(strictObservationEvidence.directory, { recursive: true });
  const defaultRoot = project("observation-default-best-effort");
  const defaultRun = await runCli(defaultRoot, ["run", "--", process.execPath, "-e", "process.exit(0)"]);
  assert.strictEqual(defaultRun.code, 0, defaultRun.stderr);
  const defaultResult = managedRunResult(defaultRun);
  const defaultReport = defaultResult.report;
  recordStrictObservationCase("default-best-effort", defaultResult.summary, defaultReport);
  assertObservationShape(defaultReport.workObservation, "best-effort");
  assert.strictEqual(defaultReport.workObservation.scanBudgetMs, 100);
  assert.strictEqual(defaultReport.workObservation.scanMaxEntries, 10000);

  const strictMissingCapRoot = project("observation-strict-missing-byte-cap");
  const strictMissingCapMarker = path.join(strictMissingCapRoot, "child-ran.txt");
  const strictMissingCap = await runCli(strictMissingCapRoot, [
    "run", "--work-observation", "strict", "--max-work-bytes", "0", "--",
    process.execPath, "-e", "require('fs').writeFileSync(require('path').join(process.cwd(),'child-ran.txt'),'yes')",
  ]);
  const strictMissingCapSummaryLine = strictMissingCap.stderr.split(/\r?\n/u).find(entry => entry.startsWith("managed-run: "));
  strictObservationEvidence.cases.push({
    name: "strict-zero-byte-cap-prelaunch-rejection",
    outerExitCode: strictMissingCap.code,
    childLaunched: fs.existsSync(strictMissingCapMarker),
    managedRunSummary: strictMissingCapSummaryLine ? JSON.parse(strictMissingCapSummaryLine.slice("managed-run: ".length)) : null,
  });
  assert.strictEqual(strictMissingCap.code, 2, strictMissingCap.stderr);
  assert(!fs.existsSync(strictMissingCapMarker), "strict mode without a positive byte cap launched the command");

  const successRoot = project("observation-strict-below-cap");
  const successExport = path.join(fixture, "observation-success-export");
  const success = await runCli(successRoot, strictCliArgs(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'artifact.txt'),'strict-owned')",
    { keepOutput: successExport, maxEntries: 100 },
  ));
  assert.strictEqual(success.code, 0, success.stderr);
  const successResult = managedRunResult(success);
  const successObservation = successResult.report.workObservation;
  recordStrictObservationCase("strict-below-cap-and-export", successResult.summary, successResult.report);
  assertObservationShape(successObservation, "strict");
  assert.strictEqual(successObservation.scanBudgetMs, 1000);
  assert.strictEqual(successObservation.scanMaxEntries, 100);
  assert(successObservation.completeSamples >= 2 && successObservation.incompleteSamples === 0,
    `strict success samples were not complete: ${JSON.stringify(successObservation)}`);
  assert(successObservation.final?.complete, "strict successful run is missing its final post-stop observation");
  assert.strictEqual(successResult.report.stopReason, null);
  assert.strictEqual(successResult.report.output, successExport);
  assert.strictEqual(fs.readFileSync(path.join(successExport, "artifact.txt"), "utf8"), "strict-owned");

  await testStrictThresholdExport();

  const entriesRoot = project("observation-entry-cap");
  for (let index = 0; index < 4; index += 1) fs.writeFileSync(path.join(entriesRoot, `input-${index}.txt`), "fixture\n");
  const entriesMarker = path.join(entriesRoot, "child-ran.txt");
  const entryCap = await runCli(entriesRoot, strictCliArgs(
    "require('fs').writeFileSync(require('path').join(process.cwd(),'child-ran.txt'),'yes')",
    { maxEntries: 1 },
  ));
  assert.strictEqual(entryCap.code, 1, entryCap.stderr);
  const entryResult = managedRunResult(entryCap);
  const entryReport = entryResult.report;
  recordStrictObservationCase("strict-max-entry-incomplete", entryResult.summary, entryReport);
  assertObservationShape(entryReport.workObservation, "strict");
  assert.strictEqual(entryReport.stopReason, "work-observation-incomplete");
  assert(entryReport.workObservation.incompleteSamples > 0, "entry cap did not produce an incomplete observation");
  assert(entryReport.workObservation.last?.reason, "incomplete report omitted the observer's actual reason");
  assert.strictEqual(entryReport.workObservation.failureReason?.reason, entryReport.workObservation.last.reason);
  assert.strictEqual(entryReport.workObservation.final, null, "prelaunch refusal must not invent a post-stop final sample");
  assert(!fs.existsSync(entriesMarker), "strict entry-cap refusal launched the command");

  // Controlled clock seam: the CLI entry-cap case above exercises the real wrapper;
  // this seam deterministically covers elapsed-budget exhaustion without a slow tree.
  const budgetRoot = project("observation-budget-seam");
  fs.writeFileSync(path.join(budgetRoot, "one.txt"), "one\n");
  const originalNow = Date.now;
  let clockCalls = 0;
  let budgetObservation;
  try {
    Date.now = () => clockCalls++ === 0 ? 100 : 10000;
    budgetObservation = managed.observeTree(budgetRoot, { budgetMs: 1, maxEntries: 100, verifyStable: true });
  } finally { Date.now = originalNow; }
  assert(!budgetObservation.complete && budgetObservation.reason === "budget-exhausted",
    `controlled elapsed-budget fixture did not report the actual incomplete reason: ${JSON.stringify(budgetObservation)}`);
  recordDirectObservation("strict-observer-elapsed-budget-seam", budgetObservation, { budgetMs: 1, maxEntries: 100, verifyStable: true });

  const changeRoot = project("observation-tree-change-seam");
  fs.writeFileSync(path.join(changeRoot, "initial.txt"), "initial\n");
  const originalOpenDir = fs.opendirSync;
  let rootDirectoryReads = 0;
  let injectedMembershipChange = false;
  let changedObservation;
  try {
    fs.opendirSync = function (target, ...args) {
      if (path.resolve(String(target)) === path.resolve(changeRoot) && ++rootDirectoryReads === 2) {
        injectedMembershipChange = true;
        fs.writeFileSync(path.join(changeRoot, "added-during-scan.txt"), "changed\n");
      }
      return originalOpenDir.call(this, target, ...args);
    };
    changedObservation = managed.observeTree(changeRoot, { budgetMs: 1000, maxEntries: 100, verifyStable: true });
  } finally { fs.opendirSync = originalOpenDir; }
  assert(injectedMembershipChange, "tree-change seam did not run during the stable verification pass");
  assert(!changedObservation.complete && changedObservation.reason === "tree-changed-during-observation",
    `stable observer missed a controlled membership change: ${JSON.stringify(changedObservation)}`);
  recordDirectObservation("strict-observer-tree-change-seam", changedObservation, { budgetMs: 1000, maxEntries: 100, verifyStable: true });

  const linkedRoot = project("observation-final-link-rejection");
  const linkedOutside = project("observation-final-link-target");
  const linkedExport = path.join(fixture, "observation-linked-export");
  const outsideBefore = fileManifest(linkedOutside);
  const linkedCode = `const fs=require('fs'),p=require('path');const output=process.env.AGENT_RUN_OUTPUT;fs.writeFileSync(p.join(output,'artifact.txt'),'must not export');fs.symlinkSync(${JSON.stringify(linkedOutside)},p.join(output,'late-link'),process.platform==='win32'?'junction':'dir')`;
  const linked = await runCli(linkedRoot, strictCliArgs(linkedCode, { maxEntries: 100, keepOutput: linkedExport }));
  assert.strictEqual(linked.code, 1, linked.stderr);
  const linkedResult = managedRunResult(linked);
  const linkedReport = linkedResult.report;
  recordStrictObservationCase("strict-final-link-rejection-blocks-export", linkedResult.summary, linkedReport);
  assertObservationShape(linkedReport.workObservation, "strict");
  assert.strictEqual(linkedReport.stopReason, "work-observation-incomplete");
  assert.strictEqual(linkedReport.workObservation.final?.complete, false);
  assert.strictEqual(linkedReport.workObservation.final?.reason, "linked-entry");
  assert.strictEqual(linkedReport.workObservation.failureReason?.reason, "linked-entry");
  assert(linkedReport.process?.treeStopped, "link rejection final sample was not taken after process-family stop");
  assert(!fs.existsSync(linkedExport), "strict final incomplete workspace was exported");
  assert.deepStrictEqual(fileManifest(linkedOutside), outsideBefore, "link rejection altered its external target");

  if (process.platform === "win32") {
    const timeoutRoot = project("observation-timeout-tree-stop");
    const pidsFile = path.join(timeoutRoot, "owned-family-pids.json");
    const childCode = `const fs=require('fs'),cp=require('child_process');const child=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidsFile)},JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000)`;
    const timeout = await runCli(timeoutRoot, strictCliArgs(childCode, { maxEntries: 100, maxWorkBytes: 1024 * 1024, timeoutMs: 6000 }));
    const timeoutResult = managedRunResult(timeout);
    const timeoutReport = timeoutResult.report;
    recordStrictObservationCase("strict-timeout-owned-family-stop", timeoutResult.summary, timeoutResult.report);
    assert.strictEqual(timeout.code, 124, timeout.stderr);
    assertObservationShape(timeoutReport.workObservation, "strict");
    assert.strictEqual(timeoutReport.stopReason, "timeout");
    assert.strictEqual(timeoutReport.process?.treeStopped, true, "strict timeout lacks Windows Job tree-stop proof");
    assert(timeoutReport.workObservation.samples >= 3,
      "long strict run did not record prelaunch, periodic, and final observations");
    assert(timeoutReport.workObservation.final?.complete, "strict timeout omitted its complete final post-stop sample");
    const ownedPids = JSON.parse(fs.readFileSync(pidsFile, "utf8"));
    assert.strictEqual(ownedPids.length, 2);
    await waitForPidsStopped(ownedPids);
  }

  process.stdout.write("strict work-observation focused tests passed\n");
}

function stableBudgetObservationFixture() {
  const root = project("live-observation-stable-budget-seam");
  fs.writeFileSync(path.join(root, "input.txt"), "stable elapsed-budget seam\n");
  const originalNow = Date.now;
  let calls = 0;
  let observed;
  try {
    Date.now = () => calls++ === 0 ? 100 : 10000;
    observed = managed.observeTree(root, { budgetMs: 1, maxEntries: 100000, verifyStable: true });
  } finally { Date.now = originalNow; }
  assert(!observed.complete && observed.reason === "budget-exhausted",
    `controlled stable elapsed-budget seam returned the wrong reason: ${JSON.stringify(observed)}`);
  recordDirectObservation("strict-stable-time-budget-seam", observed, { budgetMs: 1, maxEntries: 100000, verifyStable: true });
}

async function testLiveTimeoutFamily() {
  fs.mkdirSync(liveObservationEvidence.directory, { recursive: true });
  const timeoutRoot = project("live-observation-timeout-family");
  const pidsFile = path.join(timeoutRoot, "owned-family-pids.json");
  const childCode = `const fs=require('fs'),p=require('path'),cp=require('child_process');const output=process.env.AGENT_RUN_OUTPUT;const child=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidsFile)},JSON.stringify([process.pid,child.pid]));setInterval(()=>fs.appendFileSync(p.join(output,'alive.log'),'x'),50)`;
  const timeout = await runCli(timeoutRoot, strictCliArgs(childCode, {
    budgetMs: 1000, maxEntries: 100000, maxWorkBytes: 4 * 1024 * 1024,
    timeoutMs: 6500,
  }));
  const timeoutResult = managedRunResult(timeout);
  const timeoutEvidence = recordStrictObservationCase("live-timeout-owned-descendant-family", timeoutResult.summary, timeoutResult.report);
  assert.strictEqual(timeout.code, 124, timeout.stderr);
  assertOwnedTermination(timeoutResult.summary, timeoutResult.report, "live timeout family stop");
  assertObservationShape(timeoutResult.report.workObservation, "strict");
  assert.strictEqual(timeoutResult.report.stopReason, "timeout");
  assert(timeoutResult.report.workObservation.samples >= 3, "timeout run omitted its periodic or final sample");
  assert(timeoutResult.report.workObservation.lastPeriodic?.complete, "timeout live periodic sample incomplete");
  assert.strictEqual(timeoutResult.report.workObservation.lastPeriodic?.scanKind, "live");
  assert.strictEqual(timeoutResult.report.workObservation.lastPeriodic?.transientMissingEntries, 0);
  assert(timeoutResult.report.workObservation.final?.complete, "timeout final stable sample incomplete");
  assert.strictEqual(timeoutResult.report.workObservation.final?.scanKind, "stable");
  const ownedPids = JSON.parse(fs.readFileSync(pidsFile, "utf8"));
  assert.strictEqual(ownedPids.length, 2);
  await waitForPidsStopped(ownedPids);
  timeoutEvidence.ownedPids = ownedPids;
  timeoutEvidence.ownedPidsStopped = true;
  assert.deepStrictEqual(liveObservationEvidence.sourceHashesBefore, observationSourceHashes(),
    "owned observation source files changed during the live acceptance run");
}

async function testLiveObservation() {
  fs.mkdirSync(liveObservationEvidence.directory, { recursive: true });
  if (process.platform !== "win32") throw new Error("live observation acceptance requires Windows Job Object containment");
  stableBudgetObservationFixture();

  const successRoot = project("live-observation-churn-success");
  const successExport = path.join(fixture, "live-observation-success-export");
  const successCode = `const fs=require('fs'),p=require('path');const out=process.env.AGENT_RUN_OUTPUT;const churn=p.join(out,'churn');fs.mkdirSync(churn,{recursive:true});fs.writeFileSync(p.join(out,'payload-2m.bin'),Buffer.alloc(2*1024*1024,7));const names=Array.from({length:500},(_,i)=>p.join(churn,'item-'+i+'.tmp'));for(const name of names)fs.writeFileSync(name,'x');const log=p.join(out,'append.log');let index=0;const pulse=setInterval(()=>{const name=names[index++%names.length];try{fs.unlinkSync(name)}catch(error){if(error.code!=='ENOENT')throw error}setTimeout(()=>fs.writeFileSync(name,'x'),50);fs.appendFileSync(log,'x')},2);setTimeout(()=>{clearInterval(pulse);setTimeout(()=>{for(const name of names)fs.writeFileSync(name,'x');fs.appendFileSync(log,'settled\\n');process.exit(0)},75)},6800)`;
  const success = await runCli(successRoot, strictCliArgs(successCode, {
    budgetMs: 1000, maxEntries: 100000, maxWorkBytes: 4 * 1024 * 1024,
    timeoutMs: 12000, keepOutput: successExport,
  }));
  const successResult = managedRunResult(success);
  const successEvidence = recordStrictObservationCase("live-churn-2m-below-cap-stable-export", successResult.summary, successResult.report);
  successEvidence.outputTarget = successExport;
  successEvidence.outputTargetExists = fs.existsSync(successExport);
  assert.strictEqual(success.code, 0, success.stderr);
  assertOwnedTermination(successResult.summary, successResult.report, "live churn success");
  assertObservationShape(successResult.report.workObservation, "strict");
  assert(successResult.report.workObservation.samples >= 3, "live success did not record prelaunch, periodic, and final samples");
  const successPeriodic = successResult.report.workObservation.lastPeriodic;
  assert(successPeriodic?.complete, `live periodic sample incomplete: ${JSON.stringify(successPeriodic)}`);
  assert.strictEqual(successPeriodic.scanKind, "live");
  assert(successPeriodic.transientMissingEntries > 0,
    `continuous create/delete fixture did not exercise safely vanished entries: ${JSON.stringify(successPeriodic)}`);
  assert.strictEqual(successResult.report.workObservation.final?.scanKind, "stable");
  assert(successResult.report.workObservation.final?.complete, "live success final stable observation incomplete");
  assert.strictEqual(successResult.report.exportObservation?.scanKind, "stable");
  assert(successResult.report.exportObservation?.complete, "live success export was not protected by a complete stable scan");
  assert.strictEqual(successResult.report.output, successExport);
  assert(fs.existsSync(path.join(successExport, "payload-2m.bin")), "stable export lost the live materialization payload");

  const overRoot = project("live-observation-periodic-over-cap");
  const overExport = path.join(fixture, "live-observation-over-cap-export");
  const overPidsFile = path.join(overRoot, "owned-pids.json");
  const overCode = `const fs=require('fs'),p=require('path'),cp=require('child_process');const out=process.env.AGENT_RUN_OUTPUT;fs.writeFileSync(p.join(out,'payload-6m.bin'),Buffer.alloc(6*1024*1024,9));const descendant=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(overPidsFile)},JSON.stringify([process.pid,descendant.pid]));setInterval(()=>fs.appendFileSync(p.join(out,'alive.log'),'x'),50)`;
  const over = await runCli(overRoot, strictCliArgs(overCode, {
    budgetMs: 1000, maxEntries: 100000, maxWorkBytes: 4 * 1024 * 1024,
    timeoutMs: 12000, keepOutput: overExport,
  }));
  const overResult = managedRunResult(over);
  const overEvidence = recordStrictObservationCase("live-periodic-over-cap-blocks-export", overResult.summary, overResult.report);
  overEvidence.outputTarget = overExport;
  overEvidence.outputTargetExists = fs.existsSync(overExport);
  assert.strictEqual(over.code, 1, over.stderr);
  assertOwnedTermination(overResult.summary, overResult.report, "live over-cap stop");
  assertObservationShape(overResult.report.workObservation, "strict");
  observerTelemetry(overResult.report.workObservation.final, "CLI overbudget final sample");
  assert.strictEqual(overResult.report.stopReason, "observed-work-budget");
  assert.strictEqual(overResult.report.workObservation.failureReason, null);
  const overPeriodic = overResult.report.workObservation.lastPeriodic;
  assert(overPeriodic?.complete, `over-cap periodic sample incomplete: ${JSON.stringify(overPeriodic)}`);
  assert.strictEqual(overPeriodic.scanKind, "live");
  assert(overPeriodic.bytes >= 4 * 1024 * 1024, "periodic scan did not measure work at/above the cap");
  assert.strictEqual(overResult.report.workObservation.final?.scanKind, "stable");
  assert(overResult.report.workObservation.final?.complete, "over-cap final sample should remain complete");
  assert.strictEqual(overResult.report.output, null);
  assert(!fs.existsSync(overExport), "live periodic byte breach allowed keep-output export");
  const overPids = JSON.parse(fs.readFileSync(overPidsFile, "utf8"));
  assert.strictEqual(overPids.length, 2);
  await waitForPidsStopped(overPids);
  overEvidence.ownedPids = overPids;
  overEvidence.ownedPidsStopped = true;

  const entryRoot = project("live-observation-periodic-entry-incomplete");
  const entryExport = path.join(fixture, "live-observation-entry-export");
  const entryCode = `const fs=require('fs'),p=require('path');const out=process.env.AGENT_RUN_OUTPUT;for(let i=0;i<500;i++)fs.writeFileSync(p.join(out,'entry-'+i+'.tmp'),'x');setInterval(()=>fs.appendFileSync(p.join(out,'alive.log'),'x'),50)`;
  const entry = await runCli(entryRoot, strictCliArgs(entryCode, {
    budgetMs: 1000, maxEntries: 128, maxWorkBytes: 4 * 1024 * 1024,
    timeoutMs: 12000, keepOutput: entryExport,
  }));
  const entryResult = managedRunResult(entry);
  const entryEvidence = recordStrictObservationCase("live-periodic-entry-incomplete", entryResult.summary, entryResult.report);
  entryEvidence.outputTarget = entryExport;
  entryEvidence.outputTargetExists = fs.existsSync(entryExport);
  assert.strictEqual(entry.code, 1, entry.stderr);
  assertOwnedTermination(entryResult.summary, entryResult.report, "live entry-limit stop");
  assert.strictEqual(entryResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(entryResult.report.workObservation.failureReason?.phase, "periodic");
  assert.strictEqual(entryResult.report.workObservation.failureReason?.reason, "budget-exhausted");
  assert.strictEqual(entryResult.report.workObservation.lastPeriodic?.scanKind, "live");
  assert.strictEqual(entryResult.report.workObservation.lastPeriodic?.complete, false);
  assert.strictEqual(entryResult.report.output, null);
  assert(!fs.existsSync(entryExport), "live entry-limit incomplete workspace was exported");

  const unsafeRoot = project("live-observation-periodic-unsafe-link");
  const unsafeTarget = project("live-observation-unsafe-link-target");
  fs.writeFileSync(path.join(unsafeTarget, "sentinel.txt"), "external target preserved\n");
  const unsafeBefore = fileManifest(unsafeTarget);
  const unsafeExport = path.join(fixture, "live-observation-unsafe-export");
  const unsafeCode = `const fs=require('fs'),p=require('path');const out=process.env.AGENT_RUN_OUTPUT;fs.writeFileSync(p.join(out,'artifact.txt'),'unsafe link fixture');fs.symlinkSync(${JSON.stringify(unsafeTarget)},p.join(out,'external-link'),process.platform==='win32'?'junction':'dir');setInterval(()=>fs.appendFileSync(p.join(out,'alive.log'),'x'),50)`;
  const unsafe = await runCli(unsafeRoot, strictCliArgs(unsafeCode, {
    budgetMs: 1000, maxEntries: 100000, maxWorkBytes: 4 * 1024 * 1024,
    timeoutMs: 12000, keepOutput: unsafeExport,
  }));
  const unsafeResult = managedRunResult(unsafe);
  const unsafeEvidence = recordStrictObservationCase("live-periodic-unsafe-link-blocks-export", unsafeResult.summary, unsafeResult.report);
  unsafeEvidence.outputTarget = unsafeExport;
  unsafeEvidence.outputTargetExists = fs.existsSync(unsafeExport);
  assert.strictEqual(unsafe.code, 1, unsafe.stderr);
  assertOwnedTermination(unsafeResult.summary, unsafeResult.report, "live unsafe-link stop");
  assert.strictEqual(unsafeResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(unsafeResult.report.workObservation.failureReason?.phase, "periodic");
  assert.strictEqual(unsafeResult.report.workObservation.failureReason?.reason, "linked-entry");
  observerTelemetry(unsafeResult.report.workObservation.final, "CLI unsafe-link final sample");
  assert.strictEqual(unsafeResult.report.workObservation.lastPeriodic?.scanKind, "live");
  assert.strictEqual(unsafeResult.report.workObservation.lastPeriodic?.complete, false);
  assert.strictEqual(unsafeResult.report.workObservation.final?.scanKind, "stable");
  assert.strictEqual(unsafeResult.report.workObservation.final?.reason, "linked-entry");
  assert.strictEqual(unsafeResult.report.output, null);
  assert(!fs.existsSync(unsafeExport), "live unsafe link allowed keep-output export");
  assert.deepStrictEqual(fileManifest(unsafeTarget), unsafeBefore, "live unsafe link modified its external target");

  await testLiveTimeoutFamily();

  process.stdout.write("live work-observation focused tests passed\n");
}

function observerTelemetry(observed, label) {
  assert(Number.isFinite(observed.elapsedMs) && observed.elapsedMs >= 0, `${label}: elapsedMs is not finite and monotonic`);
  assert(Number.isSafeInteger(observed.entriesExamined) && observed.entriesExamined >= 0,
    `${label}: entriesExamined is not a safe cumulative count`);
  assert(observed.exhaustedBy === null || observed.exhaustedBy === "time" || observed.exhaustedBy === "entries",
    `${label}: invalid exhaustion cause ${observed.exhaustedBy}`);
}

function scanEnvelopeCandidate(env = process.env) {
  const supplied = env.MANAGED_TEMP_SCAN_ENVELOPE_INPUT;
  if (typeof supplied !== "string" || supplied.trim() === "") {
    throw new Error("scan-envelope acceptance requires MANAGED_TEMP_SCAN_ENVELOPE_INPUT to name the immutable acceptance input directory");
  }
  const candidate = path.resolve(supplied);
  let realCandidate;
  try { realCandidate = fs.realpathSync(candidate); }
  catch (error) {
    throw new Error(`MANAGED_TEMP_SCAN_ENVELOPE_INPUT cannot be resolved: ${candidate} (${error.code || error.message})`);
  }
  let stat;
  try { stat = fs.statSync(realCandidate); }
  catch (error) {
    throw new Error(`MANAGED_TEMP_SCAN_ENVELOPE_INPUT cannot be inspected: ${realCandidate} (${error.code || error.message})`);
  }
  if (!stat.isDirectory()) throw new Error(`MANAGED_TEMP_SCAN_ENVELOPE_INPUT must name a directory: ${realCandidate}`);
  return realCandidate;
}

function testScanEnvelopeInputValidation() {
  assert.throws(() => scanEnvelopeCandidate({}), /MANAGED_TEMP_SCAN_ENVELOPE_INPUT to name/u);
  assert.throws(() => scanEnvelopeCandidate({ MANAGED_TEMP_SCAN_ENVELOPE_INPUT: "   " }), /MANAGED_TEMP_SCAN_ENVELOPE_INPUT to name/u);
  assert.throws(() => scanEnvelopeCandidate({ MANAGED_TEMP_SCAN_ENVELOPE_INPUT: path.join(fixture, "missing-scan-envelope-input") }), /cannot be resolved/u);
  const file = path.join(fixture, "scan-envelope-input-file.txt");
  fs.writeFileSync(file, "not a directory\n");
  assert.throws(() => scanEnvelopeCandidate({ MANAGED_TEMP_SCAN_ENVELOPE_INPUT: file }), /must name a directory/u);
  const directory = project("scan-envelope-input-directory");
  assert.strictEqual(scanEnvelopeCandidate({ MANAGED_TEMP_SCAN_ENVELOPE_INPUT: directory }), fs.realpathSync(directory));
  process.stdout.write("scan-envelope input validation passed\n");
}

async function testScanEnvelope() {
  if (process.platform !== "win32") throw new Error("scan-envelope acceptance requires the Windows managed process supervisor");
  fs.mkdirSync(scanEnvelopeEvidence.directory, { recursive: true });
  const candidate = scanEnvelopeCandidate();
  const candidateRealPath = fs.realpathSync(candidate);
  const manifestHash = manifest => crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const inputBefore = fileManifest(candidate);
  const inputIdentityBefore = manifestHash(inputBefore);
  assert.strictEqual(inputBefore.length, 957, "acceptance input file count differs from the measured immutable source");

  const stableOptions = { budgetMs: 1000, maxEntries: 100000, verifyStable: true };
  const stable = managed.observeTree(candidate, stableOptions);
  observerTelemetry(stable, "real immutable stable scan");
  scanEnvelopeEvidence.cases.push({
    name: "immutable-release-candidate-stable-default-envelope",
    inputPath: candidateRealPath,
    inputManifestSha256: inputIdentityBefore,
    options: stableOptions,
    observed: stable,
  });
  assert(stable.complete, `real source stable scan incomplete: ${JSON.stringify(stable)}`);
  assert.strictEqual(stable.files, 957);
  assert.strictEqual(stable.bytes, 40677455);
  assert.strictEqual(stable.exhaustedBy, null);
  assert(stable.entriesExamined < stableOptions.maxEntries, "stable source scan approached the configured entry cap");

  const liveOptions = { budgetMs: 1000, maxEntries: 100000, allowTransientMissing: true };
  const live = managed.observeTree(candidate, liveOptions);
  observerTelemetry(live, "real immutable live scan");
  scanEnvelopeEvidence.cases.push({
    name: "immutable-release-candidate-live-default-envelope",
    inputPath: candidateRealPath,
    inputManifestSha256: inputIdentityBefore,
    options: liveOptions,
    observed: live,
  });
  assert(live.complete, `real source live scan incomplete: ${JSON.stringify(live)}`);
  assert.strictEqual(live.files, 957);
  assert.strictEqual(live.bytes, 40677455);
  assert.strictEqual(live.exhaustedBy, null);
  assert(live.entriesExamined < liveOptions.maxEntries, "live source scan approached the configured entry cap");
  assert(Number.isSafeInteger(live.transientMissingEntries) && live.transientMissingEntries >= 0);

  const inputAfter = fileManifest(candidate);
  const inputIdentityAfter = manifestHash(inputAfter);
  assert.strictEqual(inputIdentityAfter, inputIdentityBefore, "read-only candidate input changed during observation");
  scanEnvelopeEvidence.inputIdentity = {
    path: candidateRealPath,
    manifestSha256Before: inputIdentityBefore,
    manifestSha256After: inputIdentityAfter,
    files: inputAfter.length,
    observedBytes: stable.bytes,
    unchanged: true,
  };

  const timeRoot = project("scan-envelope-time-exhaustion");
  fs.writeFileSync(path.join(timeRoot, "payload.txt"), "elapsed cause\n");
  const originalNow = Date.now;
  let clockCalls = 0;
  let timeExhaustion;
  try {
    Date.now = () => clockCalls++ === 0 ? 100 : 10000;
    timeExhaustion = managed.observeTree(timeRoot, { budgetMs: 1, maxEntries: 100000, verifyStable: true });
  } finally { Date.now = originalNow; }
  observerTelemetry(timeExhaustion, "controlled time exhaustion");
  scanEnvelopeEvidence.cases.push({ name: "controlled-stable-time-exhaustion", options: { budgetMs: 1, maxEntries: 100000, verifyStable: true }, observed: timeExhaustion });
  assert.strictEqual(timeExhaustion.complete, false);
  assert.strictEqual(timeExhaustion.reason, "budget-exhausted");
  assert.strictEqual(timeExhaustion.exhaustedBy, "time", "time exhaustion was conflated with entry exhaustion");

  const entryRoot = project("scan-envelope-entry-exhaustion");
  for (let index = 0; index < 6; index += 1) fs.writeFileSync(path.join(entryRoot, `entry-${index}.txt`), "entry cause\n");
  const entryOptions = { budgetMs: 1000, maxEntries: 2, verifyStable: true };
  const entryExhaustion = managed.observeTree(entryRoot, entryOptions);
  observerTelemetry(entryExhaustion, "controlled entry exhaustion");
  scanEnvelopeEvidence.cases.push({ name: "controlled-stable-entry-exhaustion", options: entryOptions, observed: entryExhaustion });
  assert.strictEqual(entryExhaustion.complete, false);
  assert.strictEqual(entryExhaustion.reason, "budget-exhausted");
  assert.strictEqual(entryExhaustion.exhaustedBy, "entries", "entry exhaustion was conflated with elapsed-time exhaustion");

  const overRoot = project("scan-envelope-cli-byte-budget");
  const overExport = path.join(fixture, "scan-envelope-overbudget-export");
  const overCap = 1024 * 1024;
  const over = await runCli(overRoot, strictCliArgs(
    "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'over-cap.bin'),Buffer.alloc(2*1024*1024,5))",
    { budgetMs: 1000, maxEntries: 100000, maxWorkBytes: overCap, minFreeBytes: 1, keepOutput: overExport },
  ));
  const overResult = managedRunResult(over);
  const overCase = recordStrictObservationCase("scan-envelope-cli-byte-budget-minfree-owned-cleanup", overResult.summary, overResult.report);
  overCase.outputTarget = overExport;
  overCase.outputTargetExists = fs.existsSync(overExport);
  assert.strictEqual(over.code, 1, over.stderr);
  assertOwnedTermination(overResult.summary, overResult.report, "scan-envelope byte budget");
  assertObservationShape(overResult.report.workObservation, "strict");
  assert.strictEqual(overResult.report.stopReason, "observed-work-budget");
  assert.strictEqual(overResult.report.limits.maxWorkBytes, overCap);
  assert.strictEqual(overResult.report.limits.minFreeBytes, 1);
  assert(overResult.report.workObservation.final.complete);
  assert(overResult.report.workObservation.final.bytes >= overCap);
  assert.strictEqual(overResult.report.output, null);
  assert(!fs.existsSync(overExport), "overbudget CLI run exported the observed workspace");

  const unsafeRoot = project("scan-envelope-cli-unsafe-link");
  const unsafeTarget = project("scan-envelope-cli-unsafe-target");
  fs.writeFileSync(path.join(unsafeTarget, "sentinel.txt"), "external target must remain unchanged\n");
  const unsafeBefore = fileManifest(unsafeTarget);
  const unsafeExport = path.join(fixture, "scan-envelope-unsafe-export");
  const unsafe = await runCli(unsafeRoot, strictCliArgs(
    `const fs=require('fs'),p=require('path');const out=process.env.AGENT_RUN_OUTPUT;fs.writeFileSync(p.join(out,'artifact.txt'),'must not export');fs.symlinkSync(${JSON.stringify(unsafeTarget)},p.join(out,'external-link'),process.platform==='win32'?'junction':'dir')`,
    { budgetMs: 1000, maxEntries: 100000, maxWorkBytes: 4 * 1024 * 1024, minFreeBytes: 1, keepOutput: unsafeExport },
  ));
  const unsafeResult = managedRunResult(unsafe);
  const unsafeCase = recordStrictObservationCase("scan-envelope-cli-reparse-denial-owned-cleanup", unsafeResult.summary, unsafeResult.report);
  unsafeCase.outputTarget = unsafeExport;
  unsafeCase.outputTargetExists = fs.existsSync(unsafeExport);
  assert.strictEqual(unsafe.code, 1, unsafe.stderr);
  assertOwnedTermination(unsafeResult.summary, unsafeResult.report, "scan-envelope unsafe link");
  assert.strictEqual(unsafeResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(unsafeResult.report.workObservation.failureReason?.reason, "linked-entry");
  assert.strictEqual(unsafeResult.report.limits.minFreeBytes, 1);
  assert.strictEqual(unsafeResult.report.output, null);
  assert(!fs.existsSync(unsafeExport), "unsafe linked workspace was exported");
  assert.deepStrictEqual(fileManifest(unsafeTarget), unsafeBefore, "unsafe link refusal changed the external sentinel");

  assert.deepStrictEqual(scanEnvelopeEvidence.sourceHashesBefore, observationSourceHashes(),
    "assigned source files changed during scan-envelope acceptance");
  process.stdout.write("scan-envelope focused acceptance passed\n");
}

async function testR11WorkerObservation() {
  if (process.platform !== "win32") throw new Error("r11 worker acceptance requires Windows Job Object containment");
  fs.mkdirSync(workerObservationEvidence.directory, { recursive: true });
  workerObservationEvidence.sourceHashesBefore = workerObservationSourceHashes();

  for (const policyCase of [
    { name: "worker-foreground-policy-rejected-before-admission", overrides: { "process-contract": "foreground" }, pattern: /contained/u },
    { name: "worker-zero-runtime-rejected-before-admission", overrides: { "timeout-ms": 0 }, pattern: /timeout|positive|runtime/u },
    { name: "worker-over-maximum-runtime-rejected-before-admission", overrides: { "timeout-ms": 1800001 }, pattern: /timeout|1800000|runtime/u },
    { name: "worker-over-4gib-work-budget-rejected-before-admission", overrides: { "max-work-bytes": 4 * 1024 ** 3 + 1 }, pattern: /work|4.?GiB|budget/u },
    { name: "worker-below-2gib-minfree-rejected-before-admission", overrides: { "min-free-bytes": 2 * 1024 ** 3 - 1 }, pattern: /free|minimum/u },
  ]) {
    const root = project(`r11-policy-${policyCase.name}`);
    const base = managed.managedBase(root);
    const events = [];
    let factoryCalls = 0;
    const options = workerModeOptions((entryPath, workerOptions) => {
      factoryCalls += 1;
      return tracedWorkerFactory({ events })(entryPath, workerOptions);
    }, policyCase.overrides);
    let failure = null;
    try { await runManaged(root, process.execPath, ["-e", "process.exit(0)"], options); }
    catch (error) { failure = error; }
    workerObservationEvidence.cases.push({
      name: policyCase.name,
      simulated: true,
      rejected: Boolean(failure),
      error: failure ? String(failure.message || failure) : null,
      workerFactoryCalls: factoryCalls,
      cacheBaseCreated: fs.existsSync(base),
      process: null,
    });
    assert(failure, `${policyCase.name}: unsafe worker policy was admitted`);
    assert.match(String(failure.message || failure), policyCase.pattern);
    assert.strictEqual(factoryCalls, 0, `${policyCase.name}: Worker factory ran before policy rejection`);
    assert(!fs.existsSync(base), `${policyCase.name}: managed workspace was created before policy rejection`);
  }

  const slowRoot = project("r11-worker-slow-live-and-cancel");
  const slowExport = path.join(fixture, "r11-worker-slow-export");
  const preload = writeSlowWorkerPreload([6000, 3000]);
  const slowEvents = [];
  const slowCode = "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(process.env.AGENT_RUN_OUTPUT,'worker-artifact.bin'),Buffer.alloc(1024*1024,6));setTimeout(()=>process.exit(0),16200)";
  const freeSpaceProbes = [];
  const originalStatfsSync = fs.statfsSync;
  let slowResult;
  fs.statfsSync = function (...args) {
    const startedAt = performance.now();
    try { return originalStatfsSync.apply(this, args); }
    finally { freeSpaceProbes.push({ atMs: performance.now(), elapsedMs: performance.now() - startedAt }); }
  };
  try {
    slowResult = await runProgrammaticWorker(slowRoot, process.execPath, ["-e", slowCode], workerModeOptions(
      tracedWorkerFactory({ preloadPath: preload.preloadPath, events: slowEvents }),
      { "keep-output": slowExport },
    ));
  } finally { fs.statfsSync = originalStatfsSync; }
  const preloadEvents = fs.readFileSync(preload.eventPath, "utf8").trim().split(/\r?\n/u).map(line => JSON.parse(line));
  const slowEvidence = recordR11WorkerCase("real-worker-slow-live-complete-skip-tick-cancel-final-export", slowResult, {
    events: slowEvents,
    extra: { preloadEvents, freeSpaceProbes, outputTarget: slowExport, outputTargetExists: fs.existsSync(slowExport) },
  });
  assert.strictEqual(slowResult.exitCode, 0, slowResult.stderr);
  assertOwnedTermination(slowResult.summary, slowResult.report, "r11 slow worker producer");
  assertWorkerMode(slowResult.report, "r11 slow worker producer");
  assert.strictEqual(slowResult.report.limits.maxWorkBytes, 4 * 1024 ** 3);
  assert.strictEqual(slowResult.report.limits.minFreeBytes, 2 * 1024 ** 3);
  assert.strictEqual(slowResult.report.output, slowExport);
  assert(fs.existsSync(path.join(slowExport, "worker-artifact.bin")), "worker mode final/export lost producer output");
  assert.strictEqual(slowResult.report.workObservation.final?.phase, "final");
  assert.strictEqual(slowResult.report.workObservation.final?.scanKind, "stable");
  assert.strictEqual(slowResult.report.workObservation.final?.complete, true);
  assert.strictEqual(slowResult.report.exportObservation?.scanKind, "stable");
  assert.strictEqual(slowResult.report.exportObservation?.complete, true);
  assertWorkerSettled(slowResult.report, "r11 slow worker producer");
  const periodicRequests = slowEvents.filter(event => event.direction === "request" && event.phase === "periodic");
  const periodicResults = slowEvents.filter(event => event.direction === "message" && event.type === "result" && event.phase === "periodic");
  assert.strictEqual(periodicRequests.length, 2, `expected two scheduled live requests (t=5,t=15), got ${periodicRequests.length}`);
  assert.strictEqual(periodicResults.length, 2, "one periodic Worker result/cancel acknowledgement is missing");
  assert.strictEqual(periodicResults[0].status, "complete", "first slow live observer did not complete successfully");
  assert(Number.isFinite(periodicResults[0].elapsedMs) && periodicResults[0].elapsedMs > 2000 && periodicResults[0].elapsedMs < 10000,
    `first actual worker scan did not exceed the old deadline while remaining inside 10s: ${periodicResults[0].elapsedMs}`);
  assert.strictEqual(periodicResults[1].status, "cancelled", "normal producer exit did not cancel the active second live scan");
  assert(freeSpaceProbes.length >= 10, `expected repeated 1s parent-thread free-space probes during the 16s run; observed ${freeSpaceProbes.length}`);
  for (let index = 0; index < periodicRequests.length; index += 1) {
    assert(freeSpaceProbes.some(probe => probe.atMs > periodicRequests[index].atMs && probe.atMs < periodicResults[index].atMs),
      `parent-thread free-space probe did not run during slow live scan ${index + 1}`);
  }
  for (const [index, minimumDelay] of [[1, 5000], [2, 2000]]) {
    const started = preloadEvents.find(event => event.event === `periodic-${index}-lstat-delay-started`);
    const ended = preloadEvents.find(event => event.event === `periodic-${index}-lstat-delay-ended`);
    assert(started && ended, `actual Worker fs-preload delay ${index} was not observed`);
    assert(ended.at - started.at >= minimumDelay, `actual Worker fs delay ${index} was shorter than its required bound`);
  }
  assert(periodicRequests[1].atMs - periodicRequests[0].atMs > 8000,
    "a scan appears queued behind the first in-flight scan instead of waiting for the next 5s tick");
  assert.strictEqual(assertNoOverlappingScanRequests(slowEvents, "r11 actual slow worker"), 1);
  assert(slowResult.report.workObservation.worker?.skippedTicks >= 1, "busy 5s tick was not reported as skipped");
  assert.strictEqual(slowResult.report.workObservation.lastPeriodic?.observationStatus, "cancelled");
  assert.strictEqual(slowResult.report.workObservation.worker?.failureKind || null, null);
  assert(Number.isFinite(slowResult.report.workObservation.worker?.dispatchStartElapsedMs));
  assert(Number.isFinite(slowResult.report.workObservation.worker?.deadlineElapsedMs));
  assert.strictEqual(slowResult.report.workObservation.worker.deadlineElapsedMs - slowResult.report.workObservation.worker.dispatchStartElapsedMs, 10000);
  assert(Number.isFinite(slowResult.report.workObservation.worker?.coverageAgeMs));
  assert(slowResult.report.workObservation.worker.coverageAgeMs <= 15000, "worker accepted completion outside the configured freshness window");
  assert.strictEqual(slowEvidence.outputTargetExists, true);

  const timeRoot = project("r11-worker-virtual-deadline");
  const timeClock = createVirtualObservationTiming();
  const deadlineEvents = [];
  const deadlineExport = path.join(fixture, "r11-worker-deadline-export");
  const deadlineResult = await runProgrammaticWorker(timeRoot, process.execPath,
    ["-e", `require('fs').writeFileSync(${JSON.stringify(path.join(timeRoot, "must-not-run.txt"))},'bad')`],
    workerModeOptions(controlledWorkerFactory("pending-deadline", timeClock, deadlineEvents), {
      observationTiming: timeClock.timing,
      "keep-output": deadlineExport,
    }));
  const deadlineEvidence = recordR11WorkerCase("simulated-pending-observation-deadline", deadlineResult, { simulated: true, events: deadlineEvents });
  deadlineEvidence.retainedManagedPath = managed.managedBase(timeRoot);
  assert.notStrictEqual(deadlineResult.exitCode, 0);
  assertWorkerMode(deadlineResult.report, "simulated pending deadline");
  assert.strictEqual(deadlineResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(deadlineResult.report.workObservation.worker?.failureKind, "worker-deadline");
  assert.strictEqual(deadlineResult.report.output, null);
  assert(!fs.existsSync(deadlineExport));
  assert(!fs.existsSync(path.join(timeRoot, "must-not-run.txt")), "pending worker deadline launched producer");
  assertWorkerSettled(deadlineResult.report, "simulated pending deadline");

  const lateRoot = project("r11-worker-virtual-late-result");
  const lateClock = createVirtualObservationTiming();
  const lateEvents = [];
  const lateExport = path.join(fixture, "r11-worker-late-export");
  const lateResult = await runProgrammaticWorker(lateRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(controlledWorkerFactory("late-result", lateClock, lateEvents), {
      observationTiming: lateClock.timing,
      "keep-output": lateExport,
    }));
  recordR11WorkerCase("simulated-late-result-after-dispatch-deadline", lateResult, { simulated: true, events: lateEvents });
  assert.notStrictEqual(lateResult.exitCode, 0);
  assert.strictEqual(lateResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(lateResult.report.workObservation.worker?.failureKind, "worker-result-late");
  assert.strictEqual(lateResult.report.output, null);
  assert(!fs.existsSync(lateExport));
  assertWorkerSettled(lateResult.report, "simulated late result");

  const lateCancelRoot = project("r11-worker-late-cancel-ack");
  const lateCancelClock = createVirtualObservationTiming();
  const lateCancelEvents = [];
  const lateCancelExport = path.join(fixture, "r11-worker-late-cancel-export");
  let resolveLateCancelPeriodic;
  const lateCancelPeriodic = new Promise(resolve => { resolveLateCancelPeriodic = resolve; });
  const lateCancelResult = await runProgrammaticWorker(lateCancelRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(lateCancelAckWorkerFactory(lateCancelClock, lateCancelEvents, resolveLateCancelPeriodic), {
      observationTiming: lateCancelClock.timing,
      "keep-output": lateCancelExport,
      launcher: async (_command, _args, lifecycle) => {
        lifecycle.onLaunchAttempt();
        await lateCancelPeriodic;
        return { code: 0, signal: null, treeStopped: true };
      },
    }));
  recordR11WorkerCase("simulated-cancel-ack-after-original-deadline-from-real-observer-result", lateCancelResult, { simulated: true, events: lateCancelEvents });
  assert.notStrictEqual(lateCancelResult.exitCode, 0);
  assert.strictEqual(lateCancelResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(lateCancelResult.report.workObservation.worker?.failureKind, "worker-result-late");
  assert.notStrictEqual(lateCancelResult.report.workObservation.worker?.lastResultStatus, "cancelled",
    "late cancellation acknowledgement was accepted as settled policy coverage");
  assert.strictEqual(lateCancelResult.report.output, null);
  assert(!fs.existsSync(lateCancelExport));
  assertWorkerSettled(lateCancelResult.report, "simulated late cancellation acknowledgement");

  const invalidCountRoot = project("r11-worker-invalid-complete-counter");
  const invalidCountClock = createVirtualObservationTiming();
  const invalidCountEvents = [];
  const invalidCountMarker = path.join(invalidCountRoot, "must-not-run.txt");
  const invalidCountResult = await runProgrammaticWorker(invalidCountRoot, process.execPath,
    ["-e", `require('fs').writeFileSync(${JSON.stringify(invalidCountMarker)},'bad')`],
    workerModeOptions(controlledWorkerFactory("invalid-complete-counter", invalidCountClock, invalidCountEvents), {
      observationTiming: invalidCountClock.timing,
    }));
  recordR11WorkerCase("simulated-invalid-complete-over-entry-cap-rejected", invalidCountResult, { simulated: true, events: invalidCountEvents });
  assert.notStrictEqual(invalidCountResult.exitCode, 0);
  assert.strictEqual(invalidCountResult.report.stopReason, "work-observation-incomplete");
  assert.notStrictEqual(invalidCountResult.report.workObservation.worker?.lastResultStatus, "complete",
    "out-of-budget complete response was accepted");
  assert(!fs.existsSync(invalidCountMarker), "invalid entry counter launched producer");
  assertWorkerSettled(invalidCountResult.report, "simulated invalid complete counter");

  const malformedRoot = project("r11-worker-malformed-response");
  const malformedClock = createVirtualObservationTiming();
  const malformedEvents = [];
  const malformedResult = await runProgrammaticWorker(malformedRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(controlledWorkerFactory("malformed", malformedClock, malformedEvents), { observationTiming: malformedClock.timing }));
  recordR11WorkerCase("simulated-malformed-mismatched-worker-response", malformedResult, { simulated: true, events: malformedEvents });
  assert.notStrictEqual(malformedResult.exitCode, 0);
  assert.strictEqual(malformedResult.report.stopReason, "work-observation-incomplete");
  assert(malformedResult.report.workObservation.worker?.failureKind, "malformed response did not retain a terminal worker failure");
  assertWorkerSettled(malformedResult.report, "simulated malformed response");

  const errorRoot = project("r11-worker-error-response");
  const errorClock = createVirtualObservationTiming();
  const errorEvents = [];
  const errorResult = await runProgrammaticWorker(errorRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(controlledWorkerFactory("worker-error", errorClock, errorEvents), { observationTiming: errorClock.timing }));
  recordR11WorkerCase("simulated-worker-error-before-producer", errorResult, { simulated: true, events: errorEvents });
  assert.notStrictEqual(errorResult.exitCode, 0);
  assert.strictEqual(errorResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(errorResult.report.workObservation.worker?.failureKind, "worker-error");
  assertWorkerSettled(errorResult.report, "simulated worker error");

  const staleRoot = project("r11-worker-virtual-stale-coverage");
  const staleClock = createVirtualObservationTiming();
  const staleEvents = [];
  const staleExport = path.join(fixture, "r11-worker-stale-export");
  const staleResult = await runProgrammaticWorker(staleRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(tracedWorkerFactory({ events: staleEvents }), {
      observationTiming: staleClock.timing,
      "keep-output": staleExport,
      launcher: async (_command, _args, lifecycle) => {
        lifecycle.onLaunchAttempt();
        staleClock.advance(16000);
        return { code: 0, signal: null, treeStopped: true };
      },
    }));
  recordR11WorkerCase("simulated-stale-coverage-before-stable-final", staleResult, { simulated: true, events: staleEvents });
  assert.notStrictEqual(staleResult.exitCode, 0);
  assert.strictEqual(staleResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(staleResult.report.workObservation.worker?.failureKind, "observation-stale");
  assert.strictEqual(staleResult.report.output, null);
  assert(!fs.existsSync(staleExport));
  assertWorkerSettled(staleResult.report, "simulated stale coverage");

  const unconfirmedRoot = path.join(workerObservationEvidence.directory, "unconfirmed-retained-project");
  fs.mkdirSync(unconfirmedRoot, { recursive: true });
  const unknownClock = createVirtualObservationTiming();
  const unknownEvents = [];
  const unknownExport = path.join(fixture, "r11-worker-unconfirmed-export");
  const unknownResult = await runProgrammaticWorker(unconfirmedRoot, process.execPath, ["-e", "process.exit(0)"],
    workerModeOptions(controlledWorkerFactory("unsettled-retain", unknownClock, unknownEvents), {
      observationTiming: unknownClock.timing,
      "keep-output": unknownExport,
    }));
  const unknownEvidence = recordR11WorkerCase("simulated-unconfirmed-scanner-retains-owned-run", unknownResult, { simulated: true, events: unknownEvents });
  unknownEvidence.projectRoot = unconfirmedRoot;
  unknownEvidence.retainedManagedPath = managed.managedBase(unconfirmedRoot);
  assert.notStrictEqual(unknownResult.exitCode, 0);
  assert.strictEqual(unknownResult.report.scratchRemoved, false);
  assert.strictEqual(unknownResult.report.workObservation.worker?.status, "unsettled");
  assert.strictEqual(unknownResult.report.workObservation.worker?.settled, false);
  assert.strictEqual(unknownResult.report.workObservation.worker?.scanSettled, false);
  assert.strictEqual(unknownResult.report.output, null);
  assert(!fs.existsSync(unknownExport));

  const linkRoot = project("r11-worker-known-link-refusal");
  const linkTarget = project("r11-worker-known-link-target");
  fs.writeFileSync(path.join(linkTarget, "sentinel.txt"), "worker link target preserved\n");
  const linkBefore = fileManifest(linkTarget);
  const linkExport = path.join(fixture, "r11-worker-link-export");
  const linkEvents = [];
  const linkCode = `const fs=require('fs'),p=require('path');const out=process.env.AGENT_RUN_OUTPUT;fs.writeFileSync(p.join(out,'artifact.txt'),'must refuse link');fs.symlinkSync(${JSON.stringify(linkTarget)},p.join(out,'external-link'),process.platform==='win32'?'junction':'dir')`;
  const linkResult = await runProgrammaticWorker(linkRoot, process.execPath, ["-e", linkCode],
    workerModeOptions(tracedWorkerFactory({ events: linkEvents }), { "keep-output": linkExport }));
  recordR11WorkerCase("real-worker-contained-producer-known-link-refusal", linkResult, { events: linkEvents, extra: { outputTarget: linkExport, outputTargetExists: fs.existsSync(linkExport) } });
  assert.strictEqual(linkResult.exitCode, 1);
  assertOwnedTermination(linkResult.summary, linkResult.report, "r11 known link refusal");
  assertWorkerMode(linkResult.report, "r11 known link refusal");
  assert.strictEqual(linkResult.report.stopReason, "work-observation-incomplete");
  assert.strictEqual(linkResult.report.workObservation.final?.reason, "linked-entry");
  assert.strictEqual(linkResult.report.output, null);
  assert(!fs.existsSync(linkExport));
  assertWorkerSettled(linkResult.report, "r11 known link refusal");
  assert.deepStrictEqual(fileManifest(linkTarget), linkBefore);

  assert.deepStrictEqual(workerObservationEvidence.sourceHashesBefore, workerObservationSourceHashes(),
    "worker acceptance source files changed during the run");
  process.stdout.write("r11 worker-observation focused acceptance passed\n");
}

async function main() {
  if (process.argv.includes("--r11-worker-observation-only")) { activeObservationEvidence = workerObservationEvidence; await testR11WorkerObservation(); return; }
  if (process.argv.includes("--scan-envelope-input-validation-only")) { testScanEnvelopeInputValidation(); return; }
  if (process.argv.includes("--scan-envelope-only")) { activeObservationEvidence = scanEnvelopeEvidence; await testScanEnvelope(); return; }
  if (process.argv.includes("--strict-threshold-export-only")) { await testStrictThresholdExport(); return; }
  if (process.argv.includes("--strict-observation-only")) { await testStrictWorkObservation(); return; }
  if (process.argv.includes("--live-timeout-only")) { activeObservationEvidence = liveObservationEvidence; await testLiveTimeoutFamily(); return; }
  if (process.argv.includes("--live-observation-only")) { activeObservationEvidence = liveObservationEvidence; await testLiveObservation(); return; }
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
main().catch(error => { strictObservationFailure = error; process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; }).finally(() => {
  try { writeStrictObservationReceipt(strictObservationFailure); }
  catch (error) { process.stderr.write(`strict observation receipt failed: ${error.message}\n`); process.exitCode = 1; }
  try { writeScanEnvelopeReceipt(strictObservationFailure); }
  catch (error) { process.stderr.write(`scan envelope receipt failed: ${error.message}\n`); process.exitCode = 1; }
  try { writeR11WorkerReceipt(strictObservationFailure); }
  catch (error) { process.stderr.write(`r11 worker receipt failed: ${error.message}\n`); process.exitCode = 1; }
  cleanupFixtures();
});
