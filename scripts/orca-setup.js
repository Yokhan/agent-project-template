#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RECEIPT_RELATIVE = ".session-cache/orca-setup/latest.json";
const HOOK_FILES = [
  ".codex/hooks.json",
  "scripts/codex-hooks.js",
  ".claude/hooks/deny-sensitive-paths.sh",
  ".claude/hooks/pre-edit-safety.sh",
  ".claude/hooks/pre-bash-safety.sh",
];
const REQUIRED_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "Stop"];
const ROUTER_FILES = ["package.json", "package-lock.json", "tsconfig.json", "src/index.ts"];
const PREPARE_TIMEOUT_MS = 180 * 1000;
const CACHE_PROBE_ADAPTER = [
  "const cp=require('node:child_process')",
  "const [npmCommand,prefixText,routerRoot,planText]=process.argv.slice(1)",
  "const prefix=JSON.parse(prefixText)",
  "const plan=JSON.parse(planText)",
  "const steps=[];if(plan.install)steps.push(['install',['ci','--ignore-scripts']]);if(plan.build)steps.push(['build',['run','build']])",
  "for(const [phase,args] of steps){",
  "process.stdout.write(`ORCA_ROUTER_PHASE=${phase}\\n`)",
  "const result=cp.spawnSync(npmCommand,[...prefix,'--prefix',routerRoot,...args],{cwd:routerRoot,env:process.env,encoding:'utf8',timeout:plan.timeoutMs,maxBuffer:1048576,windowsHide:true,shell:false})",
  "if(result.error||result.status!==0){const errorCode=result.error?.code||null;const data={phase,exitCode:Number.isInteger(result.status)?result.status:null,timedOut:errorCode==='ETIMEDOUT',errorCode};process.stderr.write(`ORCA_ROUTER_FAILURE=${JSON.stringify(data)}\\n`);process.exitCode=data.timedOut?124:(result.status||1);break}",
  "}",
].join(";");

function parseArgs(argv) {
  const options = { check: false, json: false, prepareRouter: false, root: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--prepare-router") options.prepareRouter = true;
    else if (arg === "--root" || arg === "--project") {
      const value = argv[++index];
      if (!value || value.startsWith("--") || options.root) throw new Error("--root requires one absolute directory path");
      if (value.split(/[\\/]+/u).includes("..")) throw new Error("Project root may not contain parent traversal");
      options.root = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.root && !path.isAbsolute(options.root)) throw new Error("--root must be an absolute directory path");
  return options;
}

function assertRealDirectory(root) {
  const resolved = path.resolve(root);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Root must be a real directory without symlink/reparse parents");
  }
  return fs.realpathSync.native(resolved);
}

function assertRegularFile(root, relative) {
  const absolute = path.resolve(root, ...relative.split("/"));
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith(`..${path.sep}`) || relation === ".." || path.isAbsolute(relation)) {
    throw new Error(`Unsafe local path: ${relative}`);
  }
  let current = root;
  for (const [index, component] of relative.split("/").entries()) {
    current = path.join(current, component);
    let info;
    try { info = fs.lstatSync(current); }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
    if (info.isSymbolicLink()) throw new Error(`Symlink/reparse path is not allowed: ${relative}`);
    if (index < relative.split("/").length - 1 && !info.isDirectory()) throw new Error(`Non-directory path component: ${relative}`);
    if (index === relative.split("/").length - 1 && !info.isFile()) throw new Error(`Expected regular file: ${relative}`);
    const real = fs.realpathSync.native(current);
    const realRelation = path.relative(root, real);
    if (realRelation.startsWith(`..${path.sep}`) || realRelation === ".." || path.isAbsolute(realRelation)) throw new Error(`Path resolves outside project: ${relative}`);
  }
  return true;
}

function requireProjectModule(root, relative) {
  if (!assertRegularFile(root, relative)) throw Object.assign(new Error(`Missing project helper: ${relative}`), { code: "ENOENT" });
  return require(path.join(root, ...relative.split("/")));
}

function assertDirectoryIfPresent(root, relative) {
  const absolute = path.resolve(root, ...relative.split("/"));
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith(`..${path.sep}`) || relation === ".." || path.isAbsolute(relation)) throw new Error(`Unsafe local path: ${relative}`);
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    let info;
    try { info = fs.lstatSync(current); }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Expected a real directory: ${relative}`);
  }
  return true;
}

function inspectHooks(root) {
  const missing = HOOK_FILES.filter((file) => !assertRegularFile(root, file));
  if (missing.length) return { state: "blocked", missing };
  const config = JSON.parse(fs.readFileSync(path.join(root, ".codex/hooks.json"), "utf8"));
  const commands = [];
  const eventMap = config?.hooks;
  const missingEvents = [];
  if (!eventMap || typeof eventMap !== "object" || Array.isArray(eventMap)) return { state: "blocked", missing: [], issue: "Native hook event map is malformed" };
  for (const event of REQUIRED_HOOK_EVENTS) {
    if (!Object.hasOwn(eventMap, event)) { missingEvents.push(event); continue; }
    const eventCommands = [];
    visitEvent(eventMap[event], eventCommands);
    if (!eventCommands.some((command) => typeof command === "string" && command.includes("scripts/codex-hooks.js"))) missingEvents.push(event);
    commands.push(...eventCommands);
  }
  if (missingEvents.length) return { state: "blocked", missing: [], missingEvents, issue: "Required native hook event references are incomplete" };
  const customCommands = commands.filter((command) => typeof command !== "string" || !command.includes("scripts/codex-hooks.js")).length;
  return { state: "static-ready", commandCount: commands.length, customCommands, customHooks: customCommands ? "unverified" : "none", activated: "unverified" };
}

function visitEvent(value, commands) {
  if (Array.isArray(value)) return value.forEach((item) => visitEvent(item, commands));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "command") commands.push(child);
    else visitEvent(child, commands);
  }
}

function inspectRouter(root) {
  const routerRoot = path.join(root, "mcp-servers", "context-router");
  if (!assertDirectoryIfPresent(root, "mcp-servers/context-router")) return { state: "missing-source" };
  const missing = ROUTER_FILES.filter((file) => !assertRegularFile(routerRoot, file));
  if (missing.length) return { state: "blocked", missing };
  const pkg = JSON.parse(fs.readFileSync(path.join(routerRoot, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(routerRoot, "package-lock.json"), "utf8"));
  if (pkg.name !== "context-router" || pkg.name !== lock.name || !pkg.version || pkg.version !== lock.version ||
      pkg.scripts?.build !== "tsc" || pkg.scripts.prebuild || pkg.scripts.postbuild || !Number.isInteger(lock.lockfileVersion)) {
    return { state: "blocked", issue: "Router package and pinned lockfile do not match" };
  }
  const lockRoot = lock.packages?.[""];
  if (!lockRoot || JSON.stringify(lockRoot.dependencies || {}) !== JSON.stringify(pkg.dependencies || {}) ||
      JSON.stringify(lockRoot.devDependencies || {}) !== JSON.stringify(pkg.devDependencies || {})) {
    return { state: "blocked", issue: "Router package metadata and pinned lockfile do not match" };
  }
  const depsReady = assertDirectoryIfPresent(routerRoot, "node_modules") && [
    "@modelcontextprotocol/sdk/server/mcp.js",
    "@modelcontextprotocol/sdk/server/stdio.js",
    "zod",
    "typescript",
  ].every((specifier) => resolveRouterDependency(routerRoot, specifier)) && assertRegularFile(routerRoot, "node_modules/typescript/bin/tsc");
  const buildReady = assertRegularFile(routerRoot, "dist/index.js");
  return { state: depsReady && buildReady ? "ready" : "needs-prepare", dependencies: depsReady, build: buildReady,
    ...(!depsReady || !buildReady ? { prepareCommand: depsReady ? "npm run build" : "npm ci --ignore-scripts; npm run build" } : {}) };
}

function resolveRouterDependency(routerRoot, specifier) {
  let resolved;
  try { resolved = require.resolve(specifier, { paths: [routerRoot] }); }
  catch (error) { if (error.code === "MODULE_NOT_FOUND" || error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") return false; throw error; }
  const relative = path.relative(routerRoot, resolved);
  if (!relative.startsWith(`node_modules${path.sep}`) || path.isAbsolute(relative)) throw new Error("Router dependency resolves outside its local node_modules");
  return assertRegularFile(routerRoot, relative.replaceAll(path.sep, "/"));
}

function npmInvocation() {
  if (process.platform !== "win32") return { command: "npm", prefixArgs: [] };
  const cli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  let stat;
  try { stat = fs.lstatSync(cli); }
  catch (error) { if (error.code === "ENOENT") throw Object.assign(new Error("Node.js npm CLI was not found beside the active Node executable"), { code: "NPM_CLI_MISSING" }); throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error("Node.js npm CLI is not a regular file"), { code: "NPM_CLI_INVALID" });
  return { command: process.execPath, prefixArgs: [cli] };
}

async function runPinnedRouterPreparation(root, runner, options = {}) {
  const timeoutMs = options.timeoutMs ?? PREPARE_TIMEOUT_MS;
  const install = options.install !== false;
  const build = options.build !== false;
  if (!install && !build) return { state: "prepared", phase: "none", managedRun: null };
  let npm;
  let managedTempCli;
  try {
    if (!assertRegularFile(root, "scripts/managed-temp.js")) throw Object.assign(new Error("Managed temp runner is missing"), { code: "MANAGED_TEMP_MISSING" });
    if (!assertRegularFile(root, "scripts/lib/managed-run-report.js")) throw Object.assign(new Error("Managed run report reader is missing"), { code: "MANAGED_REPORT_MISSING" });
    if (process.platform === "win32" && (!assertRegularFile(root, "scripts/lib/managed-process.js") || !assertRegularFile(root, "scripts/lib/managed-process.ps1"))) {
      throw Object.assign(new Error("Managed process supervisor files are missing"), { code: "MANAGED_PROCESS_SUPERVISOR_MISSING" });
    }
    managedTempCli = path.join(root, "scripts/managed-temp.js");
    npm = npmInvocation();
  } catch (error) {
    return { state: "failed", phase: "install", exitCode: null, timedOut: false, errorCode: error.code || "PREPARATION_UNAVAILABLE",
      process: { supervision: process.platform === "win32" ? "windows-job-object" : "posix-process-group", termination: "unverified" } };
  }
  const routerRoot = path.join(root, "mcp-servers", "context-router");
  const managedRunTimeoutMs = (Number(install) + Number(build)) * timeoutMs + 10000;
  const cliArgs = [managedTempCli, "run", "--profile", "command", "--timeout-ms", String(managedRunTimeoutMs)];
  if (process.platform !== "win32") cliArgs.push("--process-contract", "foreground");
  cliArgs.push("--", process.execPath, "-e", CACHE_PROBE_ADAPTER, npm.command, JSON.stringify(npm.prefixArgs), routerRoot, JSON.stringify({ install, build, timeoutMs }));
  const launch = runner || spawnSync;
  let result;
  try {
    result = launch(process.execPath, cliArgs, { cwd: root, encoding: "utf8", timeout: managedRunTimeoutMs + 20000,
      maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false });
  } catch (error) {
    return { state: "failed", phase: "managed-run", exitCode: null, timedOut: error.code === "ETIMEDOUT", errorCode: error.code || "MANAGED_RUN_LAUNCH_FAILED", cleanup: { verified: false } };
  }
  const stderr = String(result?.stderr || "");
  const stdout = String(result?.stdout || "");
  const failureMatch = stderr.match(/^ORCA_ROUTER_FAILURE=(\{[^\r\n]+\})$/mu);
  const failure = failureMatch ? JSON.parse(failureMatch[1]) : null;
  const summaryMatch = stderr.match(/^managed-run:\s+(\{[^\r\n]+\})$/mu);
  let report = result?.managedReport || null;
  try {
    if (!report && summaryMatch) {
      const summary = JSON.parse(summaryMatch[1]);
      if (typeof summary.report === "string") report = requireProjectModule(root, "scripts/lib/managed-run-report.js").readReportPath(summary.report);
    }
  } catch { /* missing/invalid ownership-bound receipt blocks cleanup claims below */ }
  const managedRun = report ? {
    runId: report.runId,
    exitCode: report.exitCode,
    scratchRemoved: report.scratchRemoved === true,
    process: {
      supervision: report.process?.supervision || "unknown",
      treeStopped: report.process?.treeStopped === true,
      groupStopped: report.process?.groupStopped === true,
      ...(typeof report.process?.rootInJob === "boolean" ? { rootInJob: report.process.rootInJob } : {}),
      ...(typeof report.process?.killOnClose === "boolean" ? { killOnClose: report.process.killOnClose } : {}),
    },
    cleanup: {
      bytesRemoved: report.cleanup?.accounting?.observedBytesRemoved ?? null,
      filesRemoved: report.cleanup?.accounting?.observedFilesRemoved ?? null,
      remainingComplete: report.cleanup?.accounting?.remainingComplete === true,
      bytesRemaining: report.cleanup?.accounting?.observedBytesRemaining ?? null,
    },
    npmCache: {
      bytesFreed: report.cache?.bytesFreed ?? null,
      bytesRetained: report.cache?.bytesRetained ?? null,
      complete: report.cache?.complete === true,
      housekeeping: report.diagnostics?.cacheHousekeeping || null,
    },
  } : null;
  const successful = result?.status === 0 && report?.exitCode === 0 && report?.scratchRemoved === true &&
    report.cleanup?.accounting?.remainingComplete === true && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(report.runId || "");
  if (successful) return { state: "prepared", phase: build ? "build" : "install", managedRun };
  const timedOut = failure?.timedOut === true || result?.error?.code === "ETIMEDOUT";
  const lastPhase = [...stdout.matchAll(/^ORCA_ROUTER_PHASE=(install|build)$/gmu)].at(-1)?.[1];
  return { state: "failed", phase: failure?.phase || lastPhase || "managed-run", exitCode: failure?.exitCode ?? report?.exitCode ?? result?.status ?? null,
    timedOut, errorCode: failure?.errorCode || (result?.error?.code === "ETIMEDOUT" ? "MANAGED_RUN_TIMEOUT" : report ? null : "MANAGED_RUN_REPORT_MISSING"),
    managedRun, cleanup: { verified: managedRun?.scratchRemoved === true && managedRun?.cleanup.remainingComplete === true } };
}

function receiptDirectory(root) {
  const parentExists = assertDirectoryIfPresent(root, ".session-cache");
  if (!parentExists) fs.mkdirSync(path.join(root, ".session-cache"));
  const cacheRoot = path.join(root, ".session-cache");
  if (!assertDirectoryIfPresent(root, ".session-cache/orca-setup")) fs.mkdirSync(path.join(cacheRoot, "orca-setup"));
  if (!assertDirectoryIfPresent(root, ".session-cache/orca-setup")) throw new Error("Could not create setup receipt directory");
  return path.join(root, ".session-cache/orca-setup");
}

function writeReceipt(root, result) {
  const directory = receiptDirectory(root);
  const target = path.join(directory, "latest.json");
  try {
    const existing = fs.lstatSync(target);
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error("Setup receipt target must be a regular file");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = path.join(directory, `.latest.${process.pid}.tmp`);
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  fs.writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx" });
  try { fs.renameSync(temporary, target); }
  catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
}

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const root = assertRealDirectory(options.root || process.cwd());
  const checks = {};
  try {
    const assertRuntime = dependencies.assertSupportedRuntime || requireProjectModule(root, "scripts/lib/codex-runtime.js").assertSupportedRuntime;
    checks.runtime = { state: "ready", version: assertRuntime().version };
  }
  catch (error) { checks.runtime = { state: "blocked", issue: error.code || "ERR_UNSUPPORTED_CODEX_RUNTIME" }; }
  try {
    const resolveBash = dependencies.resolveBash || requireProjectModule(root, "scripts/codex-hooks.js").resolveBash;
    checks.bash = resolveBash() ? { state: "ready" } : { state: "blocked", issue: "bash-unavailable" };
  } catch (error) { checks.bash = { state: "blocked", issue: error.code || "hook-helper-unavailable" }; }
  try { checks.hooks = inspectHooks(root); }
  catch (error) { checks.hooks = { state: "blocked", issue: error.code || "hook-inspection-failed" }; }
  try {
    const libraryStatus = dependencies.libraryStatus || requireProjectModule(root, "scripts/lib/writing-library-store.js").libraryStatus;
    const library = libraryStatus();
    checks.writingLibrary = { state: library.state === "ready" ? "ready" : "needs-user-library", readySources: library.sources?.length || 0,
      issueCount: library.issues?.length || 0, optional: true };
  } catch { checks.writingLibrary = { state: "needs-user-library", issueCount: 1, optional: true }; }
  try { checks.contextRouter = inspectRouter(root); }
  catch (error) { checks.contextRouter = { state: "blocked", issue: error.code || "router-inspection-failed" }; }

  if (options.prepareRouter && checks.contextRouter.state === "needs-prepare") {
    const prepare = await (dependencies.prepareRouter || runPinnedRouterPreparation)(root, dependencies.runner, {
      timeoutMs: dependencies.timeoutMs,
      install: !checks.contextRouter.dependencies,
      build: !checks.contextRouter.build || !checks.contextRouter.dependencies,
    });
    if (prepare.state === "prepared") {
      const after = inspectRouter(root);
      checks.contextRouter = after.state === "ready" ? { ...after, preparation: prepare } : { ...after, state: "blocked", issue: "router-remains-unready-after-prepare", preparation: prepare };
    } else checks.contextRouter = { ...checks.contextRouter, state: "blocked", issue: `router-prepare-${prepare.phase || "unknown"}-failed`, preparation: prepare };
  }
  const blockers = ["runtime", "bash", "hooks", "contextRouter"].filter((key) => checks[key].state === "blocked" || checks[key].state === "missing-source");
  const result = { schemaVersion: 1, checkedAt: new Date().toISOString(), state: blockers.length ? "blocked" : "ready", checks,
    notes: ["Hook activation and model runtime metadata are not established by this static preflight.", "Writing-library and router preparation are optional and never run unless explicitly requested."] };
  writeReceipt(root, result);
  return result;
}

if (require.main === module) {
  (async () => {
    try {
      const result = await run();
      if (parseArgs(process.argv.slice(2)).json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else process.stdout.write(`Orca setup ${result.state}; receipt: ${RECEIPT_RELATIVE}\n`);
      if (result.state === "blocked") process.exitCode = 2;
    } catch (error) {
      process.stderr.write(`Orca setup blocked: ${error.code || "setup-error"}\n`);
      process.exitCode = 2;
    }
  })();
}

module.exports = { inspectHooks, inspectRouter, parseArgs, run, runPinnedRouterPreparation };
