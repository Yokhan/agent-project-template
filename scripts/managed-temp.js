#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const managed = require("./lib/managed-temp.js");
const caches = require("./lib/managed-cache.js");
const { launchOwned } = require("./lib/managed-process.js");
const { prepareProfile, PROFILES } = require("./lib/managed-run-profiles.js");
const reports = require("./lib/managed-run-report.js");

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
  const allowed = new Set(["process-contract", "profile", "cache", "cache-max-bytes", "cache-max-age-ms", "max-work-bytes", "min-free-bytes", "timeout-ms", "keep-output", "budget-ms"]), options = {};
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
function exportBuild(source, destination, runRoot) {
  const target = path.resolve(destination);
  managed.assertNoLinks(target, { allowMissing: true });
  if (fs.existsSync(target)) throw new Error("keep-output destination must not already exist");
  if (target === runRoot || target.startsWith(runRoot + path.sep)) throw new Error("keep-output must be outside the disposable run");
  managed.assertNoLinks(path.dirname(target));
  const observed = managed.observeTree(source, { budgetMs: 5000, maxEntries: 250000 });
  if (!observed.complete) throw new Error(`Cannot export an unverified output tree: ${observed.reason}`);
  // Atomic transfer avoids orphaning partial copies after ENOSPC/interruption.
  // Cross-volume export is deliberately refused instead of falling back to copy.
  try { fs.renameSync(source, target); }
  catch (error) { if (error.code === "EXDEV") throw new Error("keep-output requires a destination on the same volume as managed scratch"); throw error; }
  return target;
}
async function run(root, command, args, options = {}) {
  command = resolveCommand(command);
  const limits = cacheOptions(options, root);
  const maxWork = number(options["max-work-bytes"], 10 * 1024 ** 3, "max-work-bytes");
  const minFree = number(options["min-free-bytes"], 2 * 1024 ** 3, "min-free-bytes");
  const timeout = number(options["timeout-ms"], options.profile === "browser" ? 60000 : 0, "timeout-ms");
  const profile = options.profile || "test";
  const processContract = options["process-contract"] || (profile === "test" && process.env.AGENT_MANAGED_PROCESS_CONTRACT === "foreground" ? "foreground" : "contained");
  if (!["foreground", "contained"].includes(processContract)) throw new Error("process-contract must be contained or foreground");
  if (processContract === "foreground" && !["test", "command"].includes(profile)) throw new Error("foreground contract is limited to explicitly trusted test/command adapters");
  const limited = process.platform !== "win32" && processContract === "foreground";
  const workspace = managed.createRun(root, { label: profile, processContract: limited ? "foreground" : "contained" }), leases = [], controller = new AbortController();
  let exitCode = 1, started = false, stopped = false, result = null, failure = null;
  let receivedSignal = null, stopReason = null, timer = null, monitor = null, exported = null;
  let prepared, cleanup, cacheReport;
  const abort = reason => { if (!stopReason) stopReason = reason; controller.abort(); };
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
    const observe = () => {
      try {
        const stat = fs.statfsSync(workspace.temp);
        if (minFree && stat.bavail * stat.bsize < minFree) abort("minimum-free-space");
        if (maxWork && managed.observeTree(workspace.root, { budgetMs: 100, maxEntries: 10000 }).bytes >= maxWork) abort("observed-work-budget");
      } catch (error) { failure ||= error.message; abort("usage-observation-failed"); }
    };
    observe();
    if (controller.signal.aborted) throw new Error(`Command not started: ${stopReason}`);
    monitor = setInterval(observe, 5000);
    if (timeout) timer = setTimeout(() => abort("timeout"), timeout);
    workspace.setLaunching(true);
    result = await launchOwned(prepared.command, prepared.args, { cwd: root, env: prepared.env, signal: controller.signal, processContract: limited ? "foreground" : undefined,
      async onSpawn({ pid, hostPid }) {
        workspace.setChildPid(hostPid || pid);
        if (!limited) for (const lease of leases) await retryBusy(() => lease.bindSupervisor(hostPid || pid));
        // The supervisor cannot resume the command until this callback returns.
        started = true;
      } });
    exitCode = receivedSignal ? signalCode(receivedSignal) : stopReason === "timeout" ? 124 : stopReason ? 1 : result.signal ? signalCode(result.signal) : (result.code ?? 1);
    stopped = result.treeStopped || limited && result.groupStopped && !result.aborted && !result.error && result.code !== null;
    if (!stopped) throw new Error("Owned process family did not confirm termination; retaining resources");
    workspace.setChildPid(null);
    if (result.error) throw new Error(`Process supervisor failed: ${result.error}`);
    if (exitCode === 0 && options["keep-output"]) exported = exportBuild(prepared.paths.build, options["keep-output"], workspace.root);
  } catch (error) { failure = error.message; process.stderr.write(`managed-temp: ${failure}\n`); }
  finally {
    clearInterval(monitor); clearTimeout(timer);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.removeListener(signal, forward);
    const safe = stopped || !started;
    if (safe) {
      try { workspace.setChildPid(null); } catch (error) { failure ||= error.message; }
      for (const lease of leases) {
        try { const released = await retryBusy(() => lease.release()); if (!released.released) failure ||= `cache lease retained: ${released.reason}`; }
        catch (error) { failure ||= error.message; }
      }
      try { cleanup = workspace.finish({ foregroundCompleted: limited }); } catch (error) { failure ||= error.message; }
    } else {
      try { workspace.retain("process-family-termination-unverified"); } catch (error) { failure ||= error.message; }
    }
    try { cacheReport = await retryBusy(() => caches.pruneCaches(limits)); } catch (error) { failure ||= error.message; }
    if (!cleanup?.removed || failure || (cacheReport?.overBudget && !cacheReport.activeOverBudget) || (cacheReport && !cacheReport.complete && cacheReport.reason !== "operation-in-progress")) { if (exitCode === 0) exitCode = 1; }
    try {
      const reportFile = reports.writeReport(root, { completedAt: new Date().toISOString(), runId: workspace.id, profile: options.profile || "test", cacheMode: options.cache || "ephemeral", exitCode,
        processContract, process: result && { treeStopped: result.treeStopped, groupStopped: result.groupStopped, cleanupBasis: result.cleanupBasis, supervision: result.supervision, rootInJob: result.rootInJob, killOnClose: result.killOnClose, proof: result.proof, aborted: result.aborted }, stopReason, failure, output: exported, scratchRemoved: cleanup?.removed === true,
        cleanup: cleanup?.report || cleanup || { retained: true, reason: "process-family-termination-unverified" }, cache: cacheReport,
        limits: { maxWorkBytes: maxWork, minFreeBytes: minFree, cacheMaxBytes: limits.maxBytes, cacheMaxAgeMs: limits.maxAgeMs } });
      process.stderr.write(`managed-run: ${JSON.stringify({ runId: workspace.id, exitCode, scratchRemoved: cleanup?.removed === true,
        observedBytesRemoved: cleanup?.report?.accounting?.observedBytesRemoved ?? null, cacheBytesFreed: cacheReport?.bytesFreed ?? null, cacheBytesRetained: cacheReport?.bytesRetained ?? null, report: reportFile })}\n`);
    } catch (error) { process.stderr.write(`managed-temp: report failed: ${error.message}\n`); if (exitCode === 0) exitCode = 1; }
  }
  return exitCode;
}
async function main(argv) {
  const root = path.resolve(process.cwd()), [action, ...rest] = argv;
  if (["--help", "help"].includes(action)) {
    process.stdout.write(`Usage: managed-temp.js <run|sweep|cache-prune|status|report>\n  run [--profile ${PROFILES.join("|")}] [--cache ephemeral|shared] [--keep-output NEW_DIRECTORY] [--timeout-ms N] [--max-work-bytes N] [--min-free-bytes N] [--cache-max-bytes N] [--cache-max-age-ms N] -- <executable> [args...]\n  sweep|cache-prune [--budget-ms N] [--cache-max-bytes N] [--cache-max-age-ms N]\nOwned temporary outputs are discarded after the owned process family stops. Shared owned caches default to 10 GiB/project and 7 idle days; active caches are preserved. Work/free-space limits are sampled, not OS quotas. Generic commands must direct custom outputs into AGENT_RUN_OUTPUT/AGENT_RUN_COPY_DIR/AGENT_RUN_ARCHIVE_DIR/AGENT_RUN_LOG_DIR; arbitrary filesystem writes are not sandboxed.\n`);
    process.stdout.write("  --process-contract contained|foreground: strict Windows family supervision by default. POSIX foreground is an explicit caller contract for trusted test/command adapters; interruption retains scratch and never claims full-family proof.\n");
  } else if (action === "run") {
    const separator = rest.indexOf("--");
    if (separator < 0 || !rest[separator + 1]) throw new Error("Usage: managed-temp.js run [options] -- <executable> [args...]");
    process.exitCode = await run(root, rest[separator + 1], rest.slice(separator + 2), optionsFrom(rest.slice(0, separator)));
  } else if (action === "sweep" || action === "cache-prune") {
    const options = optionsFrom(rest), cache = await retryBusy(() => caches.pruneCaches(cacheOptions(options, root)));
    const report = action === "sweep" ? { ...managed.sweep(root, { budgetMs: number(options["budget-ms"], 1000, "budget-ms") }), cache } : { cache };
    print(report);
    if (report.errors?.length || report.pending?.length || cache.overBudget || (!cache.complete && cache.reason !== "operation-in-progress")) process.exitCode = 1;
  } else if (action === "status") print({ runs: managed.status(root), caches: caches.status().filter(item => item.projectRoot === fs.realpathSync.native(root)), lastReport: reports.readReport(root) });
  else if (action === "report") print(reports.readReport(root));
  else throw new Error("Usage: managed-temp.js <run|sweep|cache-prune|status|report>");
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`managed-temp: ${error.message}\n`); process.exitCode = 2; });
module.exports = { main, run, exportBuild };
