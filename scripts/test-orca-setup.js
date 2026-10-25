#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { run, runPinnedRouterPreparation } = require("./orca-setup.js");
const payload = require("./lib/template-payload-policy.js");
const sync = require("./lib/sync-template-core.js");
const managedReports = require("./lib/managed-run-report.js");

const sourceRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orca-setup-test-"));
function mkdir(root, relative) { fs.mkdirSync(path.join(root, relative), { recursive: true }); }
function put(root, relative, content) {
  mkdir(root, path.posix.dirname(relative));
  fs.writeFileSync(path.join(root, ...relative.split("/")), content);
}
function standardRoot(name) {
  const root = path.join(tempRoot, name);
  fs.mkdirSync(root);
  for (const relative of ["scripts/codex-hooks.js", ".claude/hooks/deny-sensitive-paths.sh", ".claude/hooks/pre-edit-safety.sh", ".claude/hooks/pre-bash-safety.sh"]) {
    put(root, relative, "#!/bin/sh\nexit 0\n");
  }
  put(root, "scripts/lib/codex-runtime.js", "exports.assertSupportedRuntime=()=>({version:'v24.13.0'});\n");
  put(root, "scripts/lib/writing-library-store.js", "exports.libraryStatus=()=>({state:'blocked',sources:[],issues:['not present']});\n");
  put(root, "scripts/managed-temp.js", "process.exit(0);\n");
  put(root, "scripts/lib/managed-run-report.js", "exports.readReportPath=()=>({});\n");
  put(root, "scripts/lib/managed-process.js", "exports.launchOwned=async()=>({code:0});\n");
  put(root, "scripts/lib/managed-process.ps1", "# test stub\n");
  const hookEvents = Object.fromEntries(["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "Stop"]
    .map((event) => [event, [{ hooks: [{ type: "command", command: "node -e scripts/codex-hooks.js" }] }]]));
  put(root, ".codex/hooks.json", JSON.stringify({ hooks: hookEvents }));
  const dependencies = { "@modelcontextprotocol/sdk": "^1.32.1", zod: "^3.24.0" };
  const devDependencies = { "@types/node": "^25.5.2", esbuild: "^0.28.1", tsx: "^4.19.0", typescript: "^5.7.0" };
  put(root, "mcp-servers/context-router/package.json", JSON.stringify({ name: "context-router", version: "1.0.0", scripts: { build: "tsc" }, dependencies, devDependencies }));
  put(root, "mcp-servers/context-router/package-lock.json", JSON.stringify({ name: "context-router", version: "1.0.0", lockfileVersion: 3,
    packages: { "": { name: "context-router", version: "1.0.0", dependencies, devDependencies } } }));
  put(root, "mcp-servers/context-router/tsconfig.json", "{}");
  put(root, "mcp-servers/context-router/src/index.ts", "export {};\n");
  return root;
}
const stubRuntime = () => ({ version: "v24.13.0" });
const deps = (overrides = {}) => ({ assertSupportedRuntime: stubRuntime, resolveBash: () => "bash", libraryStatus: () => ({ state: "blocked", sources: [], issues: ["not present"] }), ...overrides });
function populateRouterDependencies(root) {
  const router = path.join(root, "mcp-servers/context-router");
  put(router, "node_modules/@modelcontextprotocol/sdk/package.json", JSON.stringify({ name: "@modelcontextprotocol/sdk", exports: {
    "./server/mcp.js": "./server/mcp.js", "./server/stdio.js": "./server/stdio.js" } }));
  put(router, "node_modules/@modelcontextprotocol/sdk/server/mcp.js", "export {};\n");
  put(router, "node_modules/@modelcontextprotocol/sdk/server/stdio.js", "export {};\n");
  put(router, "node_modules/zod/package.json", JSON.stringify({ name: "zod", main: "index.cjs" }));
  put(router, "node_modules/zod/index.cjs", "module.exports={};\n");
  put(router, "node_modules/typescript/package.json", JSON.stringify({ name: "typescript", main: "lib/typescript.js" }));
  put(router, "node_modules/typescript/lib/typescript.js", "module.exports={};\n");
  put(router, "node_modules/typescript/bin/tsc", "#!/usr/bin/env node\n");
}
function managedRunFixture(runId, overrides = {}) {
  return { runId, exitCode: 0, scratchRemoved: true,
    process: { supervision: process.platform === "win32" ? "windows-job-object" : "posix-process-group", treeStopped: process.platform === "win32", groupStopped: process.platform !== "win32", rootInJob: process.platform === "win32", killOnClose: process.platform === "win32" },
    cleanup: { accounting: { observedBytesRemoved: 512, observedFilesRemoved: 3, remainingComplete: true, observedBytesRemaining: 0 } },
    cache: { bytesFreed: 0, bytesRetained: 0, complete: true }, ...overrides };
}
function preparationRunner(root, runId) {
  const router = path.join(root, "mcp-servers/context-router");
  return (command, args, options) => {
    assert.equal(command, process.execPath);
    assert.equal(options.shell, false);
    assert.equal(args.includes("--cache"), false, "managed npm cache must be ephemeral by default");
    assert.match(args[args.indexOf("-e") + 1], /npm_config_cache|process\.env/u);
    const plan = JSON.parse(args.at(-1));
    assert.equal(options.timeout, (Number(plan.install) + Number(plan.build)) * 180000 + 30000);
    if (plan.install) populateRouterDependencies(root);
    if (plan.build) put(router, "dist/index.js", "built");
    const phase = plan.install && plan.build ? "install\nbuild" : plan.install ? "install" : "build";
    return { status: 0, stdout: phase.split("\n").map(value => `ORCA_ROUTER_PHASE=${value}\n`).join(""), stderr: "",
      managedReport: managedRunFixture(runId) };
  };
}

async function main() {
try {
  const readyRoot = standardRoot("ready");
  const result1 = await run(["--check", "--root", readyRoot], deps());
  const result2 = await run(["--check", "--project", readyRoot], deps());
  assert.equal(result1.state, "ready");
  assert.equal(result1.checks.hooks.state, "static-ready");
  assert.equal(result1.checks.writingLibrary.state, "needs-user-library");
  assert.equal(result1.checks.contextRouter.state, "needs-prepare");
  assert.equal(result1.checks.hooks.customCommands, 0);
  assert.equal(result2.state, "ready");
  assert.equal(result2.checks.contextRouter.state, "needs-prepare");
  const receipt = JSON.parse(fs.readFileSync(path.join(readyRoot, ".session-cache/orca-setup/latest.json"), "utf8"));
  assert.equal(receipt.checks.hooks.activated, "unverified");
  assert.equal(JSON.stringify(receipt).includes(readyRoot), false, "receipt must not contain host paths");
  const partialRoot = standardRoot("partial-router-deps");
  put(partialRoot, "mcp-servers/context-router/node_modules/typescript/package.json", JSON.stringify({ name: "typescript", main: "lib/typescript.js" }));
  put(partialRoot, "mcp-servers/context-router/node_modules/typescript/lib/typescript.js", "module.exports={};\n");
  put(partialRoot, "mcp-servers/context-router/node_modules/typescript/bin/tsc", "#!/usr/bin/env node\n");
  put(partialRoot, "mcp-servers/context-router/dist/index.js", "stale build\n");
  const partial = (await run(["--check", "--root", partialRoot], deps())).checks.contextRouter;
  assert.equal(partial.state, "needs-prepare");
  assert.equal(partial.dependencies, false, "TypeScript alone is not a ready router dependency tree");

  const externalRoot = standardRoot("external-script-project");
  put(externalRoot, "scripts/lib/codex-runtime.js", "exports.assertSupportedRuntime=()=>({version:'v24.99.0'});\n");
  put(externalRoot, "scripts/codex-hooks.js", "exports.resolveBash=()=>'/external/project/bash';\n");
  put(externalRoot, "scripts/lib/writing-library-store.js", "exports.libraryStatus=()=>({state:'ready',sources:[1,2,3,4,5,6],issues:[]});\n");
  const fromProjectModules = await run(["--check", "--project", externalRoot]);
  assert.equal(fromProjectModules.checks.runtime.version, "v24.99.0");
  assert.equal(fromProjectModules.checks.writingLibrary.state, "ready");

  assert.equal((await run(["--check", "--root", readyRoot], deps({ assertSupportedRuntime: () => { throw Object.assign(new Error("old node"), { code: "ERR_UNSUPPORTED_CODEX_RUNTIME" }); } }))).checks.runtime.state, "blocked");
  assert.equal((await run(["--check", "--root", readyRoot], deps({ resolveBash: () => null }))).checks.bash.state, "blocked");
  const brokenHooks = standardRoot("broken-hooks");
  fs.rmSync(path.join(brokenHooks, ".claude/hooks/pre-edit-safety.sh"));
  assert.equal((await run(["--check", "--root", brokenHooks], deps())).checks.hooks.state, "blocked");
  const customHooks = standardRoot("custom-hooks");
  put(customHooks, "scripts/project-hook.js", "process.exit(0);\n");
  const customConfig = JSON.parse(fs.readFileSync(path.join(customHooks, ".codex/hooks.json"), "utf8"));
  customConfig.hooks.SessionStart[0].hooks.push({ type: "command", command: "node scripts/project-hook.js" });
  fs.writeFileSync(path.join(customHooks, ".codex/hooks.json"), JSON.stringify(customConfig));
  const customHookStatus = (await run(["--check", "--root", customHooks], deps())).checks.hooks;
  assert.equal(customHookStatus.state, "static-ready");
  assert.equal(customHookStatus.customCommands, 1);
  assert.equal(customHookStatus.customHooks, "unverified");
  await assert.rejects(run(["--root", "relative/path"], deps()), /absolute/u);
  await assert.rejects(run(["--project", `${tempRoot}${path.sep}..${path.sep}bad`], deps()), /parent traversal/u);
  await assert.rejects(run(["--unknown"], deps()), /Unknown option/u);

  let externalCalls = 0;
  const noAutoInstall = standardRoot("no-auto-install");
  await run(["--check", "--root", noAutoInstall], deps({ runner: () => { externalCalls += 1; } }));
  assert.equal(externalCalls, 0, "default preflight must not invoke npm");

  const prepareRunId = "27f036a0-6c55-4a19-8e69-1cd0b409d3a1";
  const prepared = await run(["--prepare-router", "--root", readyRoot], deps({ runner: preparationRunner(readyRoot, prepareRunId) }));
  assert.equal(prepared.checks.contextRouter.state, "ready");
  assert.equal(prepared.checks.contextRouter.preparation.managedRun.runId, prepareRunId);
  assert.equal(prepared.checks.contextRouter.preparation.managedRun.cleanup.remainingComplete, true);
  assert.equal(prepared.checks.contextRouter.preparation.managedRun.cleanup.bytesRemoved, 512);
  const afterPrepare = await run(["--check", "--root", readyRoot], deps());
  assert.equal(afterPrepare.checks.contextRouter.state, "ready");
  const buildOnlyRoot = standardRoot("build-only");
  populateRouterDependencies(buildOnlyRoot);
  const buildOnlyStatus = (await run(["--check", "--root", buildOnlyRoot], deps())).checks.contextRouter;
  assert.equal(buildOnlyStatus.dependencies, true);
  assert.equal(buildOnlyStatus.build, false);
  assert.equal(buildOnlyStatus.prepareCommand, "npm run build");
  const baseBuildOnlyRunner = preparationRunner(buildOnlyRoot, "bbbd5e24-0024-45b6-93f8-94c5f7422f38");
  const buildOnly = await run(["--prepare-router", "--root", buildOnlyRoot], deps({ runner: (command, args, options) => {
    assert.deepEqual(JSON.parse(args.at(-1)), { install: false, build: true, timeoutMs: 180000 });
    return baseBuildOnlyRunner(command, args, options);
  } }));
  assert.equal(buildOnly.checks.contextRouter.state, "ready");
  assert.equal(buildOnly.checks.contextRouter.preparation.managedRun.runId, "bbbd5e24-0024-45b6-93f8-94c5f7422f38");
  let readyNpmCalls = 0;
  const readyAgain = await run(["--prepare-router", "--project", readyRoot], deps({ runner: () => { readyNpmCalls += 1; } }));
  assert.equal(readyAgain.checks.contextRouter.state, "ready");
  assert.equal(readyNpmCalls, 0, "ready router must not reinstall or rebuild");
  const timedOut = await runPinnedRouterPreparation(readyRoot, () => ({ status: null, error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) }), { install: true, build: true });
  assert.equal(timedOut.state, "failed");
  assert.equal(timedOut.phase, "managed-run");
  assert.equal(timedOut.timedOut, true);
  assert.equal(timedOut.cleanup.verified, false);
  const failedPrepareRoot = standardRoot("prepare-failed");
  const failedPrepare = await run(["--prepare-router", "--root", failedPrepareRoot], deps({ prepareRouter: async () => ({ state: "failed", phase: "build", exitCode: 1, timedOut: false, errorCode: null }) }));
  assert.equal(failedPrepare.checks.contextRouter.state, "blocked");
  assert.equal(failedPrepare.state, "blocked", "explicit preparation failure must block setup");
  const failedCliRoot = standardRoot("prepare-cli-failed");
  fs.rmSync(path.join(failedCliRoot, "scripts/managed-temp.js"));
  const cliFailure = spawnSync(process.execPath, [path.join(sourceRoot, "scripts/orca-setup.js"), "--prepare-router", "--project", failedCliRoot, "--json"], { encoding: "utf8", windowsHide: true });
  assert.equal(cliFailure.status, 2, "failed automatic preparation must return a blocking CLI exit code");
  assert.equal(JSON.parse(cliFailure.stdout).state, "blocked");

  const cacheProbeCode = "const fs=require('node:fs'),p=require('node:path'),cache=process.env.npm_config_cache,run=process.env.AGENT_MANAGED_TEMP,file=p.join(cache,'orca-cache-probe');fs.writeFileSync(file,'disposable cache bytes');process.stdout.write(JSON.stringify({cache,run,file,bytes:fs.statSync(file).size})+'\\n')";
  const cacheProbeArgs = [path.join(sourceRoot, "scripts/managed-temp.js"), "run", "--profile", "command", "--timeout-ms", "20000", "--min-free-bytes", "0"];
  if (process.platform !== "win32") cacheProbeArgs.push("--process-contract", "foreground");
  cacheProbeArgs.push("--", process.execPath, "-e", cacheProbeCode);
  const cacheProbe = spawnSync(process.execPath, cacheProbeArgs, { cwd: sourceRoot, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30000, windowsHide: true });
  assert.equal(cacheProbe.status, 0, cacheProbe.stderr);
  const cacheObservation = JSON.parse(cacheProbe.stdout.trim());
  const relativeCache = path.relative(cacheObservation.run, cacheObservation.cache);
  assert(!relativeCache.startsWith(`..${path.sep}`) && relativeCache !== "..", "npm cache must live inside its owned managed run");
  assert.equal(fs.existsSync(cacheObservation.file), false, "owned disposable npm cache must be removed after the process tree stops");
  const cacheSummary = cacheProbe.stderr.match(/^managed-run:\s+(\{[^\r\n]+\})$/mu);
  assert(cacheSummary, "managed-temp must emit its bounded run receipt");
  const cacheReport = managedReports.readReportPath(JSON.parse(cacheSummary[1]).report);
  assert.equal(cacheReport.scratchRemoved, true);
  assert.equal(cacheReport.cleanup.accounting.remainingComplete, true);
  assert(cacheReport.cleanup.accounting.observedBytesRemoved >= cacheObservation.bytes, "scratch cleanup must report measured removed bytes");
  process.stdout.write(`Managed npm cache fixture receipt: ${JSON.stringify({ runId: cacheReport.runId, scratchRemoved: cacheReport.scratchRemoved,
    bytesRemoved: cacheReport.cleanup.accounting.observedBytesRemoved, filesRemoved: cacheReport.cleanup.accounting.observedFilesRemoved })}\n`);

  const symlinkRoot = standardRoot("symlink-helper");
  const runtimeHelper = path.join(symlinkRoot, "scripts/lib/codex-runtime.js");
  fs.rmSync(runtimeHelper);
  let symlinkCreated = false;
  try {
    fs.symlinkSync(path.join(sourceRoot, "scripts/lib/codex-runtime.js"), runtimeHelper, "file");
    symlinkCreated = true;
  } catch { /* Symlink creation can require host privileges on Windows. */ }
  if (symlinkCreated) {
    assert.equal((await run(["--check", "--root", symlinkRoot])).checks.runtime.state, "blocked", "runtime helper symlink must be rejected before require");
  }

  assert.equal(payload.isPayloadPath("orca.yaml"), true);
  assert.equal(payload.getCategory("orca.yaml"), "hybrid");
  assert.match(fs.readFileSync(path.join(sourceRoot, "orca.yaml"), "utf8"), /setup: node scripts\/orca-setup\.js --prepare-router/u);
  assert.match(fs.readFileSync(path.join(sourceRoot, "setup.sh"), "utf8"), /\borca\.yaml\b/u);
  assert.match(fs.readFileSync(path.join(sourceRoot, "setup.bat"), "utf8"), /\borca\.yaml\b/u);
  const template = path.join(tempRoot, "template");
  const project = path.join(tempRoot, "project");
  fs.mkdirSync(template); fs.mkdirSync(project);
  put(template, "AGENTS.md", "<!-- Template Version: 6.2.0 -->\n");
  put(template, "orca.yaml", "scripts:\n  setup: node scripts/orca-setup.js --prepare-router\n");
  put(project, "orca.yaml", "scripts:\n  setup: echo custom setup\n  archive: echo custom archive\n");
  const priorHash = "a".repeat(64);
  put(project, ".template-manifest.json", JSON.stringify({ template_version: "6.1.2", files: { "orca.yaml": { category: "hybrid", hash: priorHash } } }));
  const plan = sync.buildPlan({ templateRoot: template, projectRoot: project, planDate: "2026-10-25" });
  const action = plan.plan.actions.find((item) => item.path === "orca.yaml");
  assert.equal(action.category, "hybrid");
  assert.equal(action.type, "conflict", "custom Orca setup/archive command must be preserved for review");
  const preserved = fs.readFileSync(path.join(project, "orca.yaml"), "utf8");
  assert.match(preserved, /echo custom setup/u);
  assert.match(preserved, /archive: echo custom archive/u);

  process.stdout.write("Orca setup focused checks passed.\n");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
