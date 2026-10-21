"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { promisify } = require("util");
const { launchOwned } = require("./lib/managed-process.js");
let testStage = "setup";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mkdtemp = promisify(fs.mkdtemp);
const writeFile = promisify(fs.writeFile);
const rm = promisify(fs.rm);

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

async function waitFor(predicate, message, timeout = 6000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await sleep(25);
  }
  throw new Error(message);
}

async function run() {
  if (process.platform !== "win32") {
    await assert.rejects(
      async () => launchOwned(process.execPath, ["-e", "process.exit(99)"], {}),
      /whole-process-family supervision is currently supported only on Windows/,
      "unsupported hosts must fail closed before launching a command",
    );
    const foreground = await launchOwned(process.execPath, ["-e", "process.exit(0)"], { processContract: "foreground" });
    assert.strictEqual(foreground.code, 0);
    assert.strictEqual(foreground.treeStopped, false, "foreground contract must never claim whole-tree proof");
    assert.strictEqual(foreground.groupStopped, true);
    assert.strictEqual(foreground.cleanupBasis, "declared-foreground-contract");
    assert.strictEqual(foreground.supervision, "posix-process-group");
    assert.strictEqual(foreground.safeForLimitedCleanup, true);
    const foregroundFailure = await launchOwned(process.execPath, ["-e", "process.exit(23)"], { processContract: "foreground" });
    assert.strictEqual(foregroundFailure.code, 23, "foreground contract must preserve failing command exit status");
    assert.strictEqual(foregroundFailure.treeStopped, false);
    assert.strictEqual(foregroundFailure.safeForLimitedCleanup, true, "completed foreground command with absent group may use only limited cleanup");
    process.stdout.write("managed-process foreground contract checks passed; whole-process-family acceptance skipped because reliable containment is currently supported only on Windows\n");
    return;
  }

  const scratch = await mkdtemp(path.join(os.tmpdir(), "managed process fixture "));
  const fixture = path.join(scratch, "fixture with spaces and argv.js");
  const pidFile = path.join(scratch, 'grandchild pid.txt');
  const outputFile = path.join(scratch, 'argv with spaces.json');
  const neighbor = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  let abruptHost = null;
  try {
    const childSource = [
      '"use strict";',
      'const fs = require("fs");',
      'const { spawn } = require("child_process");',
      'const [mode, pidFile, outputFile, ...values] = process.argv.slice(2);',
      'if (mode === "argv") { fs.writeFileSync(outputFile, JSON.stringify({ values, marker: process.env.MANAGED_PROCESS_FIXTURE, path: process.env.PATH || null })); process.exit(0); }',
      'if (mode === "stdio") { process.stdout.write("stdout-marker\\n"); process.stderr.write("stderr-marker\\n"); process.exit(0); }',
      'if (mode === "grandchild") {',
      '  const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", detached: false, windowsHide: true });',
      '  fs.writeFileSync(pidFile, String(grandchild.pid));',
      '  grandchild.unref();',
      '  process.exit(Number(values[0] || 0));',
      '}',
      'if (mode === "grandchild-wait") {',
      '  const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", detached: false, windowsHide: true });',
      '  fs.writeFileSync(pidFile, String(grandchild.pid));',
      '  fs.writeFileSync(outputFile, String(process.pid));',
      '  grandchild.unref();',
      '  setInterval(() => {}, 1000);',
      '}',
      'if (mode === "wait") setInterval(() => {}, 1000);',
    ].join("\n");
    await writeFile(fixture, childSource, "utf8");

    let persisted = null;
    const argv = ["argv", pidFile, outputFile, "path with spaces", 'quote"value', "trailing\\"];
    testStage = "argv launch";
    const success = await launchOwned(process.execPath, [fixture, ...argv], {
      cwd: scratch,
      env: { SystemRoot: process.env.SystemRoot, MANAGED_PROCESS_FIXTURE: "isolated" },
      onSpawn: async lease => { persisted = lease; assert.strictEqual(lease.rootInJob, true); assert.strictEqual(lease.killOnClose, true); assert.ok(!fs.existsSync(outputFile), "command must remain suspended until its lease is recorded"); },
    });
    assert.strictEqual(success.code, 0, "successful command exit must be preserved");
    assert.strictEqual(success.treeStopped, true, "success must include stopped-tree proof");
    assert.strictEqual(success.rootInJob, true, "foreground process must be confirmed in its assigned Job Object");
    assert.strictEqual(success.killOnClose, true, "kernel-reported Job Object limits must confirm kill-on-close");
    assert.ok(persisted && persisted.pid > 0 && persisted.hostPid > 0, "lease callback must run before command start");
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(outputFile, "utf8")), { values: argv.slice(3), marker: "isolated", path: null }, "argv, environment replacement and quoting must remain intact");

    const stdoutLog = path.join(scratch, "child stdout.log");
    const stderrLog = path.join(scratch, "child stderr.log");
    const stdoutFd = fs.openSync(stdoutLog, "w");
    const stderrFd = fs.openSync(stderrLog, "w");
    let stdioResult;
    try { stdioResult = await launchOwned(process.execPath, [fixture, "stdio"], { cwd: scratch, stdio: ["ignore", stdoutFd, stderrFd] }); }
    finally { fs.closeSync(stdoutFd); fs.closeSync(stderrFd); }
    assert.strictEqual(stdioResult.code, 0, "redirected command must exit successfully");
    assert.strictEqual(fs.readFileSync(stdoutLog, "utf8"), "stdout-marker\n", "stdout must reach the supplied descriptor");
    assert.strictEqual(fs.readFileSync(stderrLog, "utf8"), "stderr-marker\n", "stderr must reach the supplied descriptor");

    testStage = "bare executable resolution";
    const bareNode = await launchOwned("node", ["-e", "process.exit(0)"]);
    assert.strictEqual(bareNode.code, 0, "bare executable names must resolve through PATH");
    assert.strictEqual(bareNode.treeStopped, true, "resolved executables must retain process-tree supervision");
    assert.throws(() => launchOwned("npm.cmd", []), /Shell wrapper.*unsupported/, "shell wrappers must fail clearly without a shell");

    testStage = "grandchild successful-exit launch";
    const grandchildSuccess = await launchOwned(process.execPath, [fixture, "grandchild", pidFile, outputFile, "0"], { cwd: scratch });
    assert.strictEqual(grandchildSuccess.code, 0, "successful wrapper exit must be preserved");
    assert.strictEqual(grandchildSuccess.treeStopped, true, "leftover descendants must be stopped after successful exit");
    const grandchildPid = Number(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), "grandchild did not start"));
    await waitFor(() => !alive(grandchildPid), "owned grandchild survived normal cleanup");

    await fs.promises.unlink(pidFile).catch(() => {});
    testStage = "grandchild failing-exit launch";
    const failure = await launchOwned(process.execPath, [fixture, "grandchild", pidFile, outputFile, "23"], { cwd: scratch });
    assert.strictEqual(failure.code, 23, "failing command exit must be preserved");
    assert.strictEqual(failure.treeStopped, true, "leftover descendants must be stopped after failing exit");
    const failingGrandchild = Number(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), "failing command grandchild did not start"));
    await waitFor(() => !alive(failingGrandchild), "owned grandchild survived failing cleanup");

    await fs.promises.unlink(pidFile).catch(() => {});
    const controller = new AbortController();
    testStage = "abort launch";
    const cancelledPromise = launchOwned(process.execPath, [fixture, "wait"], { cwd: scratch, signal: controller.signal });
    await sleep(200);
    controller.abort();
    const cancelled = await cancelledPromise;
    assert.strictEqual(cancelled.treeStopped, true, "abort must stop the owned process tree");
    assert.strictEqual(cancelled.aborted, true, "abort result must be explicit");

    const delayedController = new AbortController();
    testStage = "abort while lease callback is pending";
    const delayedCancellation = launchOwned(process.execPath, [fixture, "wait"], {
      cwd: scratch,
      signal: delayedController.signal,
      onSpawn: async () => { await sleep(250); },
    });
    setTimeout(() => delayedController.abort(), 25);
    const delayedCancelled = await delayedCancellation;
    assert.strictEqual(delayedCancelled.treeStopped, true, "abort during async lease persistence must stop the owned tree");
    assert.strictEqual(delayedCancelled.aborted, true);

    const leaseFile = path.join(scratch, "abrupt lease.json");
    const wrapperSource = [
      'const fs = require("fs");',
      'const { spawnSync } = require("child_process");',
      'const [modulePath, executable, argumentJson, cwd, leaseFile, pidFile] = process.argv.slice(2);',
      'const { launchOwned } = require(modulePath);',
      'launchOwned(executable, JSON.parse(argumentJson), { cwd, onSpawn(lease) { fs.writeFileSync(leaseFile, JSON.stringify(lease)); const timer = setInterval(() => { if (fs.existsSync(pidFile)) { clearInterval(timer); spawnSync("taskkill.exe", ["/F", "/PID", String(process.pid)], { windowsHide: true }); } }, 25); } }).catch(error => { process.stderr.write(error.stack || String(error)); });',
    ].join("\n");
    testStage = "abrupt wrapper launch";
    const wrapperFile = path.join(scratch, "abrupt-wrapper.js");
    await writeFile(wrapperFile, wrapperSource, "utf8");
    abruptHost = spawn(process.execPath, [wrapperFile, path.resolve(__dirname, "lib/managed-process.js"), process.execPath, JSON.stringify([fixture, "grandchild-wait", pidFile, outputFile]), scratch, leaseFile, pidFile], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let wrapperError = "";
    abruptHost.stderr.setEncoding("utf8").on("data", chunk => { wrapperError += chunk; });
    try { await waitFor(() => fs.existsSync(leaseFile) && fs.readFileSync(leaseFile, "utf8"), "abrupt wrapper did not record its lease"); }
    catch (error) { throw new Error(`${error.message}; wrapper exit=${abruptHost.exitCode}/${abruptHost.signalCode}; ${wrapperError}`); }
    await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), "abrupt wrapper command did not start");
    const abruptGrandchild = Number(fs.readFileSync(pidFile, "utf8"));
    const abruptCommandPid = Number(fs.readFileSync(outputFile, "utf8"));
    const abruptLease = JSON.parse(fs.readFileSync(leaseFile, "utf8"));
    await new Promise(resolve => abruptHost.once("exit", resolve));
    await waitFor(() => !alive(abruptCommandPid), "foreground process survived abrupt wrapper termination", 10000);
    await waitFor(() => !alive(abruptGrandchild), "children survived abrupt wrapper termination");
    await waitFor(() => !alive(abruptLease.hostPid), "supervisor host survived abrupt wrapper termination", 10000);
    assert.ok(alive(neighbor.pid), "unrelated neighbor process must remain alive");

    let failureVisible = false;
    testStage = "missing executable launch";
    try {
      const missing = await launchOwned(path.join(scratch, "missing executable"), [], { cwd: scratch });
      failureVisible = /executable/i.test(missing.error || "");
    } catch (error) { failureVisible = /supervisor|CreateProcess|prepare|command|executable/i.test(error.message); }
    assert.ok(failureVisible, "supervisor or launch failure must be visible to the caller");

    testStage = "CreateProcess failure proof";
    const invalidExe = path.join(scratch, "invalid executable.exe");
    await writeFile(invalidExe, "not a PE image", "utf8");
    const createFailure = await launchOwned(invalidExe, [], { cwd: scratch });
    assert.match(createFailure.error || "", /CreateProcess/i, "CreateProcess errors must reach the caller as failures");
    assert.strictEqual(createFailure.treeStopped, true, "pre-creation failure has no owned process to stop");
    process.stdout.write("managed-process focused lifecycle checks passed\n");
  } finally {
    if (abruptHost && abruptHost.exitCode === null && abruptHost.signalCode === null) abruptHost.kill();
    if (neighbor.exitCode === null && neighbor.signalCode === null) neighbor.kill();
    await rm(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) run().catch(error => { process.stderr.write(`stage=${testStage}: ${error.stack || error}\n`); process.exitCode = 1; });
module.exports = { run };
