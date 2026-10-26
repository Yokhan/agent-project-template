#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const managed = require("./lib/managed-temp.js");
const caches = require("./lib/managed-cache.js");
const { launchOwned } = require("./lib/managed-process.js");
const { ObservationWorkerController } = require("./lib/managed-observation-worker.js");
const { prepareProfile, PROFILES } = require("./lib/managed-run-profiles.js");
const reports = require("./lib/managed-run-report.js");
const { performance } = require("perf_hooks");
const SAFE_DIAGNOSTIC_ERROR_CODES = new Set([
  "PROFILE_REQUIRED", "RUN_FAILURE", "SUPERVISOR_ERROR", "EACCES", "EAGAIN", "EBUSY", "EEXIST", "EFAULT", "EINTR", "EINVAL", "EIO",
  "EISDIR", "ELOOP", "EMFILE", "ENAMETOOLONG", "ENFILE", "ENOENT", "ENOSPC", "ENOTDIR", "ENOTEMPTY", "ENOTSUP", "ENXIO", "EOPNOTSUPP",
  "EPIPE", "EPERM", "EROFS", "ETXTBSY", "EXDEV", "UNKNOWN",
]);

function print(value) { process.stdout.write(JSON.stringify(value, null, 2) + "\n"); }
function resolveCommand(command) {
  if (process.platform !== "win32" || command.toLowerCase() !== "bash") return command;
  const candidates = [path.join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe"), path.join(process.env.LOCALAPPDATA || "", "Programs/Git/bin/bash.exe"), path.join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Git/bin/bash.exe")];
  const found = candidates.find(file => path.isAbsolute(file) && fs.existsSync(file));
  if (!found) throw new Error("Git Bash is required to run bash commands on Windows");
  return found;
}
function signalCode(signal) { return 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[signal] || 1); }
function number(value, fallback, name) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${name} must be a non-negative integer`);
  return result;
}
function optionsFrom(args) {
  const allowed = new Set(["process-contract", "profile", "cache", "cache-max-bytes", "cache-max-age-ms", "max-work-bytes", "min-free-bytes", "timeout-ms", "keep-output", "budget-ms", "work-observation", "work-observation-budget-ms", "work-observation-max-entries", "work-observation-executor", "work-observation-max-age-ms", "request-state", "report-path", "expected-sha256", "pid"]), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/u, "");
    if (!args[i].startsWith("--") || !allowed.has(key) || args[i + 1] === undefined || options[key] !== undefined) throw new Error(`Invalid or repeated managed option: ${args[i]}`);
    options[key] = args[i + 1];
  }
  return options;
}
function cacheOptions(options, root) {
  return { projectRoot: root, maxBytes: number(options["cache-max-bytes"], caches.DEFAULT_MAX_BYTES, "cache-max-bytes"), maxAgeMs: number(options["cache-max-age-ms"], caches.DEFAULT_MAX_AGE_MS, "cache-max-age-ms"), budgetMs: number(options["budget-ms"], 1000, "budget-ms") };
}
function workObservationOptions(options) {
  const mode = options["work-observation"] ?? "best-effort";
  if (!new Set(["strict", "best-effort"]).has(mode)) throw new Error("work-observation must be strict or best-effort");
  const executor = options["work-observation-executor"] ?? "inline";
  if (!new Set(["inline", "worker"]).has(executor)) throw new Error("work-observation-executor must be inline or worker");
  const strict = mode === "strict";
  const scanBudgetMs = number(options["work-observation-budget-ms"], strict ? 1000 : 100, "work-observation-budget-ms");
  const scanMaxEntries = number(options["work-observation-max-entries"], strict ? 100000 : 10000, "work-observation-max-entries");
  if (scanBudgetMs < 1) throw new Error("work-observation-budget-ms must be a positive safe integer");
  if (scanMaxEntries < 1) throw new Error("work-observation-max-entries must be a positive safe integer");
  if (executor === "worker") {
    if (!strict) throw new Error("worker observation executor requires strict mode");
    if (options["work-observation-budget-ms"] === undefined || scanBudgetMs !== 10000) throw new Error("worker observation requires explicit --work-observation-budget-ms 10000");
    if (options["work-observation-max-age-ms"] === undefined || number(options["work-observation-max-age-ms"], 0, "work-observation-max-age-ms") !== 15000) throw new Error("worker observation requires explicit --work-observation-max-age-ms 15000");
    if (scanMaxEntries !== 100000) throw new Error("worker observation requires the 100000-entry cap");
    return { mode, executor, scanBudgetMs, scanMaxEntries, maxAgeMs: 15000 };
  }
  if (options["work-observation-max-age-ms"] !== undefined) throw new Error("--work-observation-max-age-ms requires worker executor");
  return { mode, executor, scanBudgetMs, scanMaxEntries, maxAgeMs: null };
}
function observationTiming(options, executor) {
  if (executor !== "worker") {
    if (options.observationTiming !== undefined || options.observationWorkerFactory !== undefined) throw new Error("observation timing and worker factory are programmatic worker-mode dependencies");
    return null;
  }
  if (options.observationWorkerFactory !== undefined && typeof options.observationWorkerFactory !== "function") throw new Error("observationWorkerFactory must be a function");
  const injected = options.observationTiming;
  if (injected === undefined) return {
    now: () => performance.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: timer => clearTimeout(timer),
  };
  if (!injected || typeof injected !== "object" || Array.isArray(injected) ||
      Object.keys(injected).length !== 3 || !["now", "setTimeout", "clearTimeout"].every(key => Object.hasOwn(injected, key)) ||
      typeof injected.now !== "function" || typeof injected.setTimeout !== "function" || typeof injected.clearTimeout !== "function") {
    throw new Error("observationTiming requires exactly now, setTimeout and clearTimeout functions");
  }
  return injected;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retryBusy(operation) {
  const deadline = Date.now() + 1500;
  while (true) {
    try {
      const result = operation();
      if (result?.reason === "operation-in-progress" && Date.now() < deadline) { await pause(25); continue; }
      return result;
    } catch (error) {
      if (!error.message.endsWith("operation-in-progress") || Date.now() >= deadline) throw error;
      await pause(25);
    }
  }
}
function resolveExportTarget(source, destination, runRoot) {
  const target = path.resolve(destination);
  managed.assertNoLinks(target, { allowMissing: true });
  if (fs.existsSync(target)) throw new Error("keep-output destination must not already exist");
  if (target === runRoot || target.startsWith(runRoot + path.sep)) throw new Error("keep-output must be outside the disposable run");
  managed.assertNoLinks(path.dirname(target));
  return target;
}
function moveVerifiedBuild(source, destination, runRoot) {
  const target = resolveExportTarget(source, destination, runRoot);
  // Atomic transfer avoids orphaning partial copies after ENOSPC/interruption.
  // Cross-volume export is deliberately refused instead of falling back to copy.
  try { fs.renameSync(source, target); }
  catch (error) { if (error.code === "EXDEV") throw new Error("keep-output requires a destination on the same volume as managed scratch"); throw error; }
  return target;
}
function exportBuild(source, destination, runRoot, options = {}) {
  const target = resolveExportTarget(source, destination, runRoot);
  const budgetMs = options.budgetMs ?? 5000;
  const maxEntries = options.maxEntries ?? 250000;
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1 ||
      options.maxBytes !== undefined && (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0)) {
    throw new Error("Invalid bounded keep-output observation options");
  }
  const observed = managed.observeTree(source, { budgetMs, maxEntries, verifyStable: options.verifyStable === true });
  if (typeof options.onObservation === "function") options.onObservation(observed);
  if (!observed.complete) throw new Error(`Cannot export an unverified output tree: ${observed.reason}`);
  if (options.maxBytes && observed.bytes >= options.maxBytes) throw new Error("Cannot export output at or above the observed-work byte budget");
  return moveVerifiedBuild(source, target, runRoot);
}
function safeError(error) {
  const message = String(error?.message || error || "");
  const knownCode = /matching managed build profile/iu.test(message) ? "PROFILE_REQUIRED"
    : /matching managed build profile|explicit .* profile/iu.test(message) ? "PROFILE_REQUIRED" : null;
  return { code: typeof error?.code === "string" && /^[A-Z0-9_-]{1,40}$/iu.test(error.code) ? error.code : knownCode || "RUN_FAILURE",
    length: Buffer.byteLength(message), sha256: crypto.createHash("sha256").update(message).digest("hex") };
}
function commandDiagnostics(command, args, phase, result, error) {
  const raw = [String(command), ...args.map(String)].join("\0");
  return {
    commandBasename: path.basename(String(command)).slice(0, 120),
    commandHash: crypto.createHash("sha256").update(raw).digest("hex"),
    argumentCount: args.length,
    phase,
    ...(Number.isSafeInteger(result?.code) && result.code >= 0 && result.code <= 0xffffffff ? { commandExitCode: result.code } : {}),
    ...(typeof result?.proof === "string" ? { proof: result.proof.slice(0, 80) } : {}),
    ...(error ? { supervisorError: safeError(error) } : {}),
  };
}
function cacheHousekeepingDiagnostics(cacheReport, cacheError, blocking) {
  if (!cacheError && (!cacheReport || cacheReport.complete && !cacheReport.overBudget)) return null;
  const rawReason = cacheError ? safeError(cacheError).code : cacheReport?.reason || (cacheReport?.overBudget ? "cache-budget-exceeded" : "cache-prune-incomplete");
  const reason = typeof rawReason === "string" && /^[A-Z0-9_-]{1,80}$/iu.test(rawReason) ? rawReason : "cache-prune-incomplete";
  const diagnostic = { blocking, reason };
  if (Number.isSafeInteger(cacheReport?.bytesRetained) && cacheReport.bytesRetained >= 0) {
    diagnostic.remainingBytes = cacheReport.bytesRetained;
    diagnostic.remainingBytesComplete = cacheReport.complete === true;
  }
  return diagnostic;
}
function safeDiagnosticCode(value) {
  if (typeof value !== "string") return null;
  const normalized = ["SIGINT", "SIGTERM", "SIGHUP"].includes(value) ? value.toLowerCase() : value;
  if (/^[a-f0-9]{32,}$/iu.test(normalized) || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(normalized)) return null;
  if (/^[A-Z][A-Z0-9_]{1,39}$/u.test(normalized)) {
    return SAFE_DIAGNOSTIC_ERROR_CODES.has(normalized) ? normalized.toLowerCase().replaceAll("_", "-") : null;
  }
  return /^[a-z][a-z0-9-]{0,63}$/u.test(normalized) ? normalized : null;
}
function safeDiagnosticError(value) {
  const code = typeof value?.code === "string" ? value.code.toUpperCase() : null;
  return {
    code: code && SAFE_DIAGNOSTIC_ERROR_CODES.has(code) ? code.toLowerCase().replaceAll("_", "-") : "run-failure",
    length: Number.isSafeInteger(value?.length) && value.length >= 0 ? value.length : null,
    sha256: typeof value?.sha256 === "string" && /^[a-f0-9]{64}$/iu.test(value.sha256) ? value.sha256.toLowerCase() : null,
  };
}
function countDiagnosticReasons(items, selectReason, limit = 8) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const reason = safeDiagnosticCode(selectReason(item)) || "unclassified";
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  const sorted = [...counts].sort(([left], [right]) => left.localeCompare(right));
  return {
    counts: Object.fromEntries(sorted.slice(0, limit)),
    omittedKinds: Math.max(0, sorted.length - limit),
  };
}
function cleanupFailureDiagnostics(cleanup) {
  const report = cleanup?.report || {};
  const accounting = report.accounting || cleanup?.accounting || {};
  const errors = Array.isArray(report.errors) ? report.errors : [];
  return {
    removed: cleanup?.removed === true,
    reason: safeDiagnosticCode(cleanup?.reason || report.reason),
    accounting: {
      observedBytesRemoved: Number.isSafeInteger(accounting.observedBytesRemoved) ? accounting.observedBytesRemoved : null,
      observedFilesRemoved: Number.isSafeInteger(accounting.observedFilesRemoved) ? accounting.observedFilesRemoved : null,
      observedBytesRemaining: Number.isSafeInteger(accounting.observedBytesRemaining) ? accounting.observedBytesRemaining : null,
      observedFilesRemaining: Number.isSafeInteger(accounting.observedFilesRemaining) ? accounting.observedFilesRemaining : null,
      remainingComplete: accounting.remainingComplete === true,
      reason: safeDiagnosticCode(accounting.reason),
    },
    counts: {
      removed: Array.isArray(report.removed) ? report.removed.length : 0,
      busy: Array.isArray(report.busy) ? report.busy.length : 0,
      skipped: Array.isArray(report.skipped) ? report.skipped.length : 0,
      pending: Array.isArray(report.pending) ? report.pending.length : 0,
      errors: errors.length,
    },
    reasons: {
      busy: countDiagnosticReasons(report.busy, item => item?.reason),
      skipped: countDiagnosticReasons(report.skipped, item => item?.reason),
      pending: countDiagnosticReasons(report.pending, item => item?.reason),
      errors: countDiagnosticReasons(errors, item => {
        const match = typeof item?.error === "string" ? item.error.match(/^([A-Z][A-Z0-9_]{1,39}):/u) : null;
        return match && SAFE_DIAGNOSTIC_ERROR_CODES.has(match[1]) ? match[1].toLowerCase().replaceAll("_", "-") : null;
      }),
    },
  };
}
function managedFailureDiagnostics({ exitCode, launchAttempted, stopped, result, stopReason, failure, cleanup, cacheHousekeeping, cachePruneFailure, nonblockingCacheHousekeeping, diagnostics }) {
  const failureKinds = [];
  if (launchAttempted && !stopped) failureKinds.push("process-termination-unconfirmed");
  if (stopped && !cleanup?.removed) failureKinds.push("scratch-cleanup-incomplete");
  if (cachePruneFailure && !nonblockingCacheHousekeeping) failureKinds.push("blocking-cache-housekeeping");
  if (failure) failureKinds.push("captured-run-failure");
  if (result && (result.code !== 0 || result.signal)) failureKinds.push("command-exit-nonzero");
  if (!failureKinds.length && exitCode !== 0) failureKinds.push("unclassified-run-failure");
  return {
    exitCode,
    failureKinds,
    stopReason: safeDiagnosticCode(stopReason),
    failure: failure ? safeDiagnosticError(safeError(failure)) : null,
    process: result ? {
      commandExitCode: Number.isSafeInteger(result.code) ? result.code : null,
      treeStopped: result.treeStopped === true,
      groupStopped: result.groupStopped === true,
      cleanupBasis: safeDiagnosticCode(result.cleanupBasis),
      supervision: safeDiagnosticCode(result.supervision),
      rootInJob: typeof result.rootInJob === "boolean" ? result.rootInJob : null,
      killOnClose: typeof result.killOnClose === "boolean" ? result.killOnClose : null,
      proof: safeDiagnosticCode(result.proof),
      aborted: result.aborted === true,
    } : null,
    diagnostics: {
      phase: safeDiagnosticCode(diagnostics?.phase),
      commandExitCode: Number.isSafeInteger(diagnostics?.commandExitCode) ? diagnostics.commandExitCode : null,
      proof: safeDiagnosticCode(diagnostics?.proof),
      supervisorError: diagnostics?.supervisorError ? safeDiagnosticError(diagnostics.supervisorError) : null,
    },
    scratchRemoved: cleanup?.removed === true,
    cleanup: cleanupFailureDiagnostics(cleanup),
    cacheHousekeeping: cacheHousekeeping ? {
      blocking: cacheHousekeeping.blocking === true,
      reason: safeDiagnosticCode(cacheHousekeeping.reason),
      remainingBytes: Number.isSafeInteger(cacheHousekeeping.remainingBytes) ? cacheHousekeeping.remainingBytes : null,
      remainingBytesComplete: cacheHousekeeping.remainingBytesComplete === true,
    } : null,
  };
}
function writeFailureDiagnostics(value) {
  const serialized = JSON.stringify(value);
  const omittedReasonKinds = Object.values(value.cleanup.reasons).reduce((sum, group) => sum + group.omittedKinds, 0);
  const prefix = "managed-run-diagnostic: ";
  const fits = candidate => Buffer.byteLength(`${prefix}${candidate}\n`) <= 4096;
  let line = fits(serialized) ? serialized : JSON.stringify({
    exitCode: value.exitCode,
    failureKinds: value.failureKinds,
    stopReason: value.stopReason,
    failure: value.failure,
    process: value.process,
    scratchRemoved: value.scratchRemoved,
    cleanup: { removed: value.cleanup.removed, reason: value.cleanup.reason, counts: value.cleanup.counts, omittedReasonKinds },
    cacheHousekeeping: value.cacheHousekeeping,
    truncated: true,
  });
  if (!fits(line)) {
    line = JSON.stringify({ exitCode: value.exitCode, failureKinds: value.failureKinds, scratchRemoved: value.scratchRemoved, truncated: true });
  }
  process.stderr.write(`${prefix}${line}\n`);
}
async function run(root, command, args, options = {}) {
  const workScanLimits = workObservationOptions(options);
  const timing = observationTiming(options, workScanLimits.executor);
  const runStartedAt = timing ? timing.now() : null;
  command = resolveCommand(command);
  const limits = cacheOptions(options, root);
  const maxWork = number(options["max-work-bytes"], 10 * 1024 ** 3, "max-work-bytes");
  const minFree = number(options["min-free-bytes"], 2 * 1024 ** 3, "min-free-bytes");
  if (workScanLimits.mode === "strict" && maxWork < 1) throw new Error("max-work-bytes must be a positive safe integer in strict work-observation mode");
  const timeout = number(options["timeout-ms"], options.profile === "browser" ? 60000 : 0, "timeout-ms");
  const profile = options.profile || "test";
  const processContract = options["process-contract"] || (profile === "test" && process.env.AGENT_MANAGED_PROCESS_CONTRACT === "foreground" ? "foreground" : "contained");
  if (!["foreground", "contained"].includes(processContract)) throw new Error("process-contract must be contained or foreground");
  if (processContract === "foreground" && !["test", "command"].includes(profile)) throw new Error("foreground contract is limited to explicitly trusted test/command adapters");
  if (workScanLimits.executor === "worker") {
    const workerMaxWork = 4 * 1024 ** 3;
    const workerMinFree = 2 * 1024 ** 3;
    if (process.platform !== "win32") throw new Error("worker observation executor requires Windows contained process supervision");
    if (processContract !== "contained") throw new Error("worker observation executor requires the contained process contract");
    if (timeout < 1 || timeout > 1800000) throw new Error("worker observation executor requires --timeout-ms from 1 through 1800000");
    if (options["max-work-bytes"] === undefined || maxWork < 1 || maxWork > workerMaxWork) throw new Error("worker observation executor requires explicit --max-work-bytes from 1 through 4294967296");
    if (minFree < workerMinFree) throw new Error("worker observation executor requires --min-free-bytes of at least 2147483648");
  }
  const limited = process.platform !== "win32" && processContract === "foreground";
  const workspace = managed.createRun(root, { label: profile, processContract: limited ? "foreground" : "contained", requestStatePath: options["request-state"] }), leases = [], controller = new AbortController();
  const workObservation = { ...workScanLimits, samples: 0, completeSamples: 0, incompleteSamples: 0, last: null, lastPeriodic: null, final: null, failureReason: null, coverage: "sampled-owned-run-tree" };
  if (workScanLimits.executor === "worker") workObservation.worker = {
    status: "idle", observationId: null, phase: null, lastResultStatus: null, failureKind: null,
    dispatchStartElapsedMs: null, deadlineElapsedMs: null, coverageAgeMs: null,
    lastCompleteStartElapsedMs: null, scanSettled: true, settled: false, exitCode: null, skippedTicks: 0,
  };
  let exportObservation = null;
  if (workspace.ownership?.confidence !== "exact") process.stderr.write("managed-temp: run has observed/session-only ownership; pass --request-state for exact request attribution\n");
  let exitCode = 1, launchAttempted = false, stopped = false, result = null, failure = null;
  let receivedSignal = null, stopReason = null, timer = null, monitor = null, floorTimer = null, freshnessTimer = null, exported = null;
  let prepared, cleanup, cacheReport, cachePruneError = null;
  let observationWorker = null, lastCompleteObservationStart = null, activeObservation = null;
  let producerStopped = false, workerProcessSettled = workScanLimits.executor !== "worker";
  const updateWorkerTelemetry = () => {
    if (!observationWorker) return;
    const state = observationWorker.snapshot(runStartedAt);
    state.lastCompleteStartElapsedMs = lastCompleteObservationStart === null ? null : Math.max(0, lastCompleteObservationStart - runStartedAt);
    state.coverageAgeMs = lastCompleteObservationStart === null ? null : Math.max(0, timing.now() - lastCompleteObservationStart);
    workObservation.worker = state;
  };
  const abort = reason => {
    if (!stopReason) stopReason = reason;
    controller.abort();
    observationWorker?.cancelActive();
  };
  const recordObservedSample = (phase, observed, { exportTree = false, intentionalCancel = false, observationId = null, dispatchStartAt = null, deadlineAt = null, observationStatus = null } = {}) => {
    const scanKind = workScanLimits.mode !== "strict" ? "best-effort" : phase === "periodic" && !exportTree ? "live" : "stable";
    const sample = {
      phase,
      scanKind,
      bytes: Number.isSafeInteger(observed.bytes) && observed.bytes >= 0 ? observed.bytes : null,
      files: Number.isSafeInteger(observed.files) && observed.files >= 0 ? observed.files : null,
      complete: observed.complete === true,
      reason: observed.complete === true ? null : typeof observed.reason === "string" ? observed.reason.slice(0, 80) : "unsafe-or-unreadable-entry",
      transientMissingEntries: Number.isSafeInteger(observed.transientMissingEntries) && observed.transientMissingEntries >= 0 ? observed.transientMissingEntries : 0,
      elapsedMs: Number.isFinite(observed.elapsedMs) && observed.elapsedMs >= 0 ? observed.elapsedMs : null,
      entriesExamined: Number.isSafeInteger(observed.entriesExamined) && observed.entriesExamined >= 0 ? observed.entriesExamined : null,
      exhaustedBy: observed.exhaustedBy === "time" || observed.exhaustedBy === "entries" ? observed.exhaustedBy : null,
    };
    if (workScanLimits.executor === "worker") Object.assign(sample, {
      observationId,
      observationStatus: observationStatus || (observed.complete === true ? "complete" : observed.reason === "cancelled" ? "cancelled" : "incomplete"),
      dispatchStartElapsedMs: dispatchStartAt === null ? null : Math.max(0, dispatchStartAt - runStartedAt),
      deadlineElapsedMs: deadlineAt === null ? null : Math.max(0, deadlineAt - runStartedAt),
    });
    workObservation.samples += 1;
    if (sample.complete) workObservation.completeSamples += 1;
    else {
      workObservation.incompleteSamples += 1;
      if (!intentionalCancel && !workObservation.failureReason) workObservation.failureReason = { phase, reason: sample.reason };
    }
    workObservation.last = sample;
    if (phase === "periodic") workObservation.lastPeriodic = sample;
    if (phase === "final") workObservation.final = sample;
    if (exportTree) exportObservation = sample;
    if (workScanLimits.mode === "strict" && !intentionalCancel) {
      if (!sample.complete) abort("work-observation-incomplete");
      else if (maxWork && sample.bytes >= maxWork) abort("observed-work-budget");
    } else if (maxWork && observed.bytes >= maxWork) abort("observed-work-budget");
    if (workScanLimits.executor === "worker" && !intentionalCancel && !sample.complete) observationWorker?.markRunFailure(sample.reason);
    return observed;
  };
  const recordWorkObservation = (phase, { exportTree = false } = {}) => {
    const strictScanOptions = workScanLimits.mode !== "strict" ? {} : phase === "periodic" && !exportTree ? { allowTransientMissing: true } : { verifyStable: true };
    const observed = managed.observeTree(exportTree ? prepared.paths.build : workspace.root, {
      budgetMs: workScanLimits.scanBudgetMs,
      maxEntries: workScanLimits.scanMaxEntries,
      ...strictScanOptions,
    });
    return recordObservedSample(phase, observed, { exportTree });
  };
  const scheduleFreshness = () => {
    if (!observationWorker || lastCompleteObservationStart === null || producerStopped || controller.signal.aborted) return;
    timing.clearTimeout(freshnessTimer);
    const expiresAt = lastCompleteObservationStart + workScanLimits.maxAgeMs;
    freshnessTimer = timing.setTimeout(() => {
      if (!producerStopped && !controller.signal.aborted && timing.now() >= expiresAt) {
        if (!workObservation.failureReason) workObservation.failureReason = { phase: observationWorker.state.phase || "periodic", reason: "observation-stale" };
        if (workObservation.worker) workObservation.worker.failureKind = "observation-stale";
        observationWorker.markRunFailure("observation-stale");
        abort("work-observation-incomplete");
        updateWorkerTelemetry();
      }
    }, Math.max(0, expiresAt - timing.now()));
  };
  if (workScanLimits.executor === "worker") {
    observationWorker = new ObservationWorkerController({
      runId: workspace.id,
      runStartedAt,
      timing,
      workerFactory: options.observationWorkerFactory,
      onFailure(kind) {
        if (workObservation.worker) workObservation.worker.failureKind = kind;
        if (!workObservation.failureReason) workObservation.failureReason = { phase: observationWorker?.state.phase || "prelaunch", reason: kind };
        abort("work-observation-incomplete");
        updateWorkerTelemetry();
      },
    });
    updateWorkerTelemetry();
  }
  const recordWorkerObservation = async (phase, { exportTree = false, intentionalCancel = false } = {}) => {
    if (!observationWorker || observationWorker.stickyFailure || observationWorker.exited) return null;
    if (observationWorker.busy) { observationWorker.noteSkippedTick(); updateWorkerTelemetry(); return null; }
    const scanKind = phase === "periodic" && !exportTree ? "live" : "stable";
    const scanRoot = exportTree ? prepared.paths.build : workspace.root;
    let request;
    try { request = observationWorker.observe({ phase: exportTree ? "export" : phase, root: scanRoot, scanKind, budgetMs: workScanLimits.scanBudgetMs, maxEntries: workScanLimits.scanMaxEntries }); }
    catch { abort("work-observation-incomplete"); updateWorkerTelemetry(); return null; }
    const dispatchState = observationWorker.snapshot(runStartedAt);
    const dispatchStartAt = runStartedAt + dispatchState.dispatchStartElapsedMs;
    const deadlineAt = runStartedAt + dispatchState.deadlineElapsedMs;
    updateWorkerTelemetry();
    const work = (async () => {
      try {
        const observed = await request;
        const intentional = intentionalCancel || producerStopped && observed.reason === "cancelled";
        if (observed.status === "complete" && (phase === "prelaunch" || phase === "periodic") && !intentional) {
          const freshnessDeadline = lastCompleteObservationStart === null ? dispatchStartAt + workScanLimits.maxAgeMs : lastCompleteObservationStart + workScanLimits.maxAgeMs;
          if (timing.now() >= freshnessDeadline || timing.now() >= dispatchStartAt + workScanLimits.maxAgeMs) {
            const rejected = { ...observed, complete: false, reason: "freshness-expired" };
            if (!workObservation.failureReason) workObservation.failureReason = { phase, reason: "observation-stale" };
            observationWorker.markRunFailure("observation-stale");
            recordObservedSample(phase, rejected, { exportTree, observationId: observed.observationId, dispatchStartAt, deadlineAt, observationStatus: "rejected" });
            abort("work-observation-incomplete");
            return rejected;
          }
        }
        recordObservedSample(phase, observed, {
          exportTree, intentionalCancel: intentional, observationId: observed.observationId,
          dispatchStartAt, deadlineAt, observationStatus: observed.status,
        });
        if (observed.status === "complete" && (phase === "prelaunch" || phase === "periodic") && !intentional) {
          lastCompleteObservationStart = dispatchStartAt;
          scheduleFreshness();
        }
        return observed;
      } catch {
        updateWorkerTelemetry();
        return null;
      } finally { updateWorkerTelemetry(); }
    })();
    activeObservation = work;
    work.finally(() => { if (activeObservation === work) activeObservation = null; });
    return work;
  };
  const forward = signal => { receivedSignal ||= signal; abort(signal); };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, forward);
  try {
    const shared = new Map();
    if (options.cache === "shared") {
      for (const kind of ["npm-cache", "node-compile", ...(options.profile === "cargo" ? ["cargo-home"] : [])]) {
        const lease = await retryBusy(() => caches.acquireCache(root, kind, { ...limits, runRoot: workspace.root }));
        leases.push(lease); shared.set(kind, lease.path);
      }
    }
    prepared = prepareProfile(workspace, { profile: options.profile || "test", command, args, cwd: root, cacheMode: options.cache || "ephemeral", getCache: kind => shared.get(kind) });
    if (limited) prepared.env.AGENT_MANAGED_PROCESS_CONTRACT = "foreground";
    else delete prepared.env.AGENT_MANAGED_PROCESS_CONTRACT;
    const checkFreeSpace = () => {
      try {
        const stat = fs.statfsSync(workspace.temp);
        if (minFree && stat.bavail * stat.bsize < minFree) abort("minimum-free-space");
        return !controller.signal.aborted;
      } catch (error) { failure ||= error; abort("usage-observation-failed"); return false; }
    };
    const observeInline = phase => { if (checkFreeSpace()) recordWorkObservation(phase); };
    const observeWorkerTick = () => {
      if (producerStopped) { checkFreeSpace(); return; }
      if (!checkFreeSpace() || controller.signal.aborted) return;
      if (observationWorker.busy) { observationWorker.noteSkippedTick(); updateWorkerTelemetry(); return; }
      void recordWorkerObservation("periodic");
    };
    if (workScanLimits.executor === "worker") {
      floorTimer = setInterval(() => { checkFreeSpace(); }, 1000);
      if (!checkFreeSpace()) throw new Error(`Command not started: ${stopReason || "minimum-free-space"}`);
      const initialObservation = await recordWorkerObservation("prelaunch");
      if (!initialObservation?.complete || controller.signal.aborted) throw new Error(`Command not started: ${stopReason || "work-observation-incomplete"}`);
    } else observeInline("prelaunch");
    if (controller.signal.aborted) throw new Error(`Command not started: ${stopReason}`);
    monitor = setInterval(workScanLimits.executor === "worker" ? observeWorkerTick : () => observeInline("periodic"), 5000);
    if (timeout) timer = setTimeout(() => abort("timeout"), timeout);
    const launcher = typeof options.launcher === "function" ? options.launcher : launchOwned;
    result = await launcher(prepared.command, prepared.args, { cwd: root, env: prepared.env, signal: controller.signal, processContract: limited ? "foreground" : undefined,
      onLaunchAttempt() {
        workspace.setPhase("supervisor-launch-attempted");
        workspace.setLaunching(true);
        launchAttempted = true;
      },
      async onSpawn({ pid, hostPid }) {
        workspace.setChildPid(hostPid || pid);
        if (!limited) for (const lease of leases) await retryBusy(() => lease.bindSupervisor(hostPid || pid));
        // The supervisor cannot resume the command until this callback returns.
      } });
    exitCode = receivedSignal ? signalCode(receivedSignal) : stopReason === "timeout" ? 124 : stopReason ? 1 : result.signal ? signalCode(result.signal) : (result.code ?? 1);
    stopped = result.treeStopped || limited && result.groupStopped && !result.aborted && !result.error && result.code !== null;
    if (!stopped) { abort("process-termination-unconfirmed"); throw new Error("Owned process family did not confirm termination; retaining resources"); }
    producerStopped = true;
    clearTimeout(timer); timer = null;
    if (workScanLimits.executor === "worker") { timing.clearTimeout(freshnessTimer); freshnessTimer = null; }
    workspace.setChildPid(null);
    if (workScanLimits.mode === "strict") {
      if (workScanLimits.executor === "worker") {
        const join = await observationWorker.cancelAndJoin();
        updateWorkerTelemetry();
        if (!join.settled) {
          workerProcessSettled = false;
          if (!workObservation.failureReason) workObservation.failureReason = { phase: "final", reason: "scanner-unsettled" };
          abort("work-observation-incomplete");
        } else if (!join.reusable && !observationWorker.stickyFailure) {
          workerProcessSettled = true;
          if (!workObservation.failureReason) workObservation.failureReason = { phase: "final", reason: "scanner-unavailable" };
          abort("work-observation-incomplete");
        }
        if (activeObservation) await activeObservation;
        let exportTarget = null;
        if (join.reusable && !observationWorker.stickyFailure) {
          const finalObservation = await recordWorkerObservation("final");
          if (!finalObservation?.complete || maxWork && finalObservation.bytes >= maxWork) {
            exitCode = receivedSignal ? signalCode(receivedSignal) : stopReason === "timeout" ? 124 : 1;
          }
          if (exitCode === 0 && options["keep-output"]) {
            try {
              exportTarget = resolveExportTarget(prepared.paths.build, options["keep-output"], workspace.root);
              const exportResult = await recordWorkerObservation("export", { exportTree: true });
              if (!exportResult?.complete || maxWork && exportResult.bytes >= maxWork) exitCode = 1;
            } catch (error) { failure ||= error; exitCode = 1; }
          }
        }
        const close = await observationWorker.terminateAndJoin();
        workerProcessSettled = close.settled;
        updateWorkerTelemetry();
        if (!close.settled) {
          if (!workObservation.failureReason) workObservation.failureReason = { phase: "export", reason: "scanner-unsettled" };
          abort("work-observation-incomplete");
          exitCode = receivedSignal ? signalCode(receivedSignal) : stopReason === "timeout" ? 124 : 1;
        }
        if (receivedSignal) exitCode = signalCode(receivedSignal);
        else if (stopReason === "timeout") exitCode = 124;
        else if (stopReason) exitCode = 1;
        if (close.settled && exitCode === 0 && exportTarget && stopped && !controller.signal.aborted && !observationWorker.stickyFailure && !observationWorker.runFailureKind) {
          exported = moveVerifiedBuild(prepared.paths.build, exportTarget, workspace.root);
        }
      } else {
        const finalObservation = recordWorkObservation("final");
        if (!finalObservation.complete || maxWork && finalObservation.bytes >= maxWork) {
          exitCode = receivedSignal ? signalCode(receivedSignal) : stopReason === "timeout" ? 124 : 1;
        }
      }
    }
    if (result.error) throw Object.assign(new Error("Process supervisor failed"), { code: "SUPERVISOR_ERROR", supervisorMessage: result.error });
    if (workScanLimits.executor !== "worker" && exitCode === 0 && options["keep-output"]) exported = exportBuild(prepared.paths.build, options["keep-output"], workspace.root,
      workScanLimits.mode === "strict" ? {
        budgetMs: workScanLimits.scanBudgetMs,
        maxEntries: workScanLimits.scanMaxEntries,
        maxBytes: maxWork,
        verifyStable: true,
        onObservation: observed => recordObservedSample("export", observed, { exportTree: true }),
      } : undefined);
  } catch (error) { failure = error; process.stderr.write(`managed-temp: run failed (${safeDiagnosticError(safeError(error)).code.toUpperCase().replaceAll("-", "_")})\n`); }
  finally {
    clearInterval(monitor); clearInterval(floorTimer); clearTimeout(timer);
    if (workScanLimits.executor === "worker") timing.clearTimeout(freshnessTimer);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.removeListener(signal, forward);
    if (observationWorker && !workerProcessSettled) {
      if (observationWorker.busy) observationWorker.cancelActive();
      const join = await observationWorker.cancelAndJoin();
      if (activeObservation) await activeObservation;
      if (join.settled && join.reusable) {
        const close = await observationWorker.terminateAndJoin();
        workerProcessSettled = close.settled;
      } else workerProcessSettled = join.settled;
      updateWorkerTelemetry();
    }
    if (!workerProcessSettled) {
      if (!workObservation.failureReason) workObservation.failureReason = { phase: "cleanup", reason: "scanner-unsettled" };
      abort("work-observation-incomplete");
      failure ||= Object.assign(new Error("Observation worker termination was not confirmed"), { code: "WORKER_UNSETTLED" });
      if (exitCode === 0) exitCode = 1;
    }
    const phase = stopped ? "termination-confirmed" : launchAttempted ? "termination-unverified" : "prelaunch-failure";
    const diagnostics = commandDiagnostics(command, args, phase, result, result?.error || failure?.supervisorMessage || failure);
    try { workspace.setDiagnostics(diagnostics); } catch (error) { failure ||= error; }
    const safe = (stopped || !launchAttempted) && workerProcessSettled;
    if (safe) {
      try { workspace.setChildPid(null); } catch (error) { failure ||= error.message; }
      for (const lease of leases) {
        try { const released = await retryBusy(() => lease.release()); if (!released.released) failure ||= `cache lease retained: ${released.reason}`; }
        catch (error) { failure ||= error.message; }
      }
      try { cleanup = workspace.finish({ foregroundCompleted: limited }); } catch (error) { failure ||= error.message; }
    } else {
      try { workspace.retain(workerProcessSettled ? "process-family-termination-unverified" : "observation-worker-unsettled"); } catch (error) { failure ||= error; }
    }
    try { cacheReport = await retryBusy(() => caches.pruneCaches(limits)); } catch (error) { cachePruneError = error; }
    const cacheIssue = Boolean(cachePruneError || cacheReport && (!cacheReport.complete || cacheReport.overBudget));
    const nonblockingCacheHousekeeping = cacheIssue && options.cache !== "shared" && cleanup?.removed === true && !failure;
    const cachePruneFailure = Boolean(cachePruneError || cacheReport && (!cacheReport.complete || cacheReport.overBudget && (options.cache === "shared" || !cacheReport.activeOverBudget)));
    const cacheHousekeeping = cacheHousekeepingDiagnostics(cacheReport, cachePruneError, !nonblockingCacheHousekeeping);
    if (cachePruneError && !nonblockingCacheHousekeeping) failure ||= cachePruneError;
    if (!cleanup?.removed || failure || cachePruneFailure && !nonblockingCacheHousekeeping) { if (exitCode === 0) exitCode = 1; }
    try {
      if (cacheHousekeeping) diagnostics.cacheHousekeeping = cacheHousekeeping;
      const reportFile = reports.writeReport(root, { completedAt: new Date().toISOString(), runId: workspace.id, profile: options.profile || "test", cacheMode: options.cache || "ephemeral", exitCode,
        ownership: workspace.ownership, diagnostics, processContract, process: result && { commandExitCode: result.code, treeStopped: result.treeStopped, groupStopped: result.groupStopped, cleanupBasis: result.cleanupBasis, supervision: result.supervision, rootInJob: result.rootInJob, killOnClose: result.killOnClose, proof: result.proof, aborted: result.aborted }, stopReason, failure: failure ? safeError(failure) : null, output: exported, scratchRemoved: cleanup?.removed === true,
        cleanup: cleanup?.report || cleanup || { retained: true, reason: "process-family-termination-unverified" }, cache: cacheReport,
        workObservation, ...(exportObservation ? { exportObservation } : {}),
        limits: { maxWorkBytes: maxWork, minFreeBytes: minFree, cacheMaxBytes: limits.maxBytes, cacheMaxAgeMs: limits.maxAgeMs } });
      process.stderr.write(`managed-run: ${JSON.stringify({ runId: workspace.id, exitCode, scratchRemoved: cleanup?.removed === true,
        observedBytesRemoved: cleanup?.report?.accounting?.observedBytesRemoved ?? null, cacheBytesFreed: cacheReport?.bytesFreed ?? null, cacheBytesRetained: cacheReport?.bytesRetained ?? null,
        cacheHousekeeping, report: reportFile })}\n`);
      if (exitCode !== 0) writeFailureDiagnostics(managedFailureDiagnostics({ exitCode, launchAttempted, stopped, result, stopReason, failure, cleanup, cacheHousekeeping, cachePruneFailure, nonblockingCacheHousekeeping, diagnostics }));
    } catch (error) { process.stderr.write(`managed-temp: report failed: ${error.message}\n`); if (exitCode === 0) exitCode = 1; }
    if (!workerProcessSettled) observationWorker?.unrefAfterRetention();
  }
  return exitCode;
}
async function main(argv) {
  const root = path.resolve(process.cwd()), [action, ...rest] = argv;
  if (["--help", "help"].includes(action)) {
    process.stdout.write(`Usage: managed-temp.js <run|sweep|cache-prune|cache-recover|status|report>\n  run [--profile ${PROFILES.join("|")}] [--request-state LEDGER] [--cache ephemeral|shared] [--keep-output NEW_DIRECTORY] [--timeout-ms N] [--max-work-bytes N] [--min-free-bytes N] [--work-observation strict|best-effort] [--work-observation-executor inline|worker] [--work-observation-budget-ms N] [--work-observation-max-age-ms N] [--work-observation-max-entries N] [--cache-max-bytes N] [--cache-max-age-ms N] -- <executable> [args...]\n  sweep|cache-prune [--budget-ms N] [--cache-max-bytes N] [--cache-max-age-ms N]\n  cache-recover --expected-sha256 SHA256 --pid PID\n  report [--report-path IMMUTABLE_REPORT_JSON]\nWork observation defaults to best-effort inline (100ms/10,000 entries); strict inline defaults to 1,000ms/100,000 entries. Worker executor requires strict mode, explicit 10,000ms scan and 15,000ms freshness values, the 100,000-entry cap, Windows contained supervision, a 1–1,800,000ms timeout, an explicit work cap up to 4 GiB, and at least 2 GiB free space. A parent-thread free-space probe is scheduled every 1,000ms while worker mode runs. Worker mode uses one worker and skips overlapping periodic ticks; its deadlines and freshness are cooperative event-loop limits, not hard real-time guarantees. Strict periodic checks use bounded live traversal; prelaunch/final/export checks use stable metadata scans. Coverage is sampled, not an atomic snapshot, OS quota, or security sandbox.\nOwned temporary outputs are discarded after the owned process family stops. Shared owned caches default to 10 GiB/project and 7 idle days; active caches are preserved. Work/free-space limits are sampled, not OS quotas. Generic commands must direct custom outputs into AGENT_RUN_OUTPUT/AGENT_RUN_COPY_DIR/AGENT_RUN_ARCHIVE_DIR/AGENT_RUN_LOG_DIR; arbitrary filesystem writes are not sandboxed.\n`);
    process.stdout.write("  --process-contract contained|foreground: strict Windows family supervision by default. POSIX foreground is an explicit caller contract for trusted test/command adapters; interruption retains scratch and never claims full-family proof.\n");
  } else if (action === "run") {
    const separator = rest.indexOf("--");
    if (separator < 0 || !rest[separator + 1]) throw new Error("Usage: managed-temp.js run [options] -- <executable> [args...]");
    process.exitCode = await run(root, rest[separator + 1], rest.slice(separator + 2), optionsFrom(rest.slice(0, separator)));
  } else if (action === "cache-recover") {
    const options = optionsFrom(rest);
    if (!options["expected-sha256"] || !options.pid || !/^[1-9][0-9]*$/u.test(options.pid)) throw new Error("cache-recover requires --expected-sha256 SHA256 --pid PID");
    print(caches.recoverLegacyClaim(options["expected-sha256"], Number(options.pid)));
  } else if (action === "sweep" || action === "cache-prune") {
    const options = optionsFrom(rest), cache = await retryBusy(() => caches.pruneCaches(cacheOptions(options, root)));
    const report = action === "sweep" ? { ...managed.sweep(root, { budgetMs: number(options["budget-ms"], 1000, "budget-ms") }), cache } : { cache };
    print(report);
    if (report.errors?.length || report.pending?.length || cache.overBudget || (!cache.complete && cache.reason !== "operation-in-progress")) process.exitCode = 1;
  } else if (action === "status") print({ runs: managed.status(root), caches: caches.status().filter(item => item.projectRoot === fs.realpathSync.native(root)), lastReport: reports.readReport(root) });
  else if (action === "report") {
    const options = optionsFrom(rest);
    print(options["report-path"] ? reports.readReportPath(options["report-path"]) : reports.readReport(root));
  }
  else throw new Error("Usage: managed-temp.js <run|sweep|cache-prune|cache-recover|status|report>");
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`managed-temp: ${error.message}\n`); process.exitCode = 2; });
module.exports = { main, run, exportBuild };
