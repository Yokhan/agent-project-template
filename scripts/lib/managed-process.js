"use strict";

// Runs a command under a small, independently owned supervisor. The supervisor
// outlives this Node process long enough to close the process family if its IPC
// peer disappears. The command never passes through a shell.
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const readline = require("readline");

const SCRIPT = path.resolve(__dirname, "managed-process.ps1");
const HANDSHAKE_TIMEOUT_MS = 15000;

function writeMessage(stream, value) {
  stream.write(`${JSON.stringify(value)}\n`);
}

function readMessages(stream) {
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const queue = [];
  const waiters = [];
  let ended = false;
  let failure = null;
  lines.on("line", rawLine => {
    const line = rawLine.replace(/^\uFEFF/, "");
    let value;
    try { value = JSON.parse(line); }
    catch (error) { failure = new Error(`Managed process supervisor sent invalid metadata (${error.message})`); }
    const waiter = waiters.shift();
    if (waiter) waiter(failure ? Promise.reject(failure) : Promise.resolve(value));
    else queue.push(value);
  });
  lines.on("close", () => {
    ended = true;
    while (waiters.length) waiters.shift()(Promise.reject(failure || new Error("Managed process supervisor disconnected")));
  });
  return {
    next() {
      if (queue.length) return Promise.resolve(queue.shift());
      if (ended) return Promise.reject(failure || new Error("Managed process supervisor disconnected"));
      return new Promise((resolve, reject) => waiters.push(result => result.then(resolve, reject)));
    },
    close() { lines.close(); },
  };
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withTimeout(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), HANDSHAKE_TIMEOUT_MS); }),
    ]);
  } finally { clearTimeout(timer); }
}

function validate(command, args, options) {
  if (typeof command !== "string" || !command) throw new TypeError("command must be a non-empty string");
  if (!Array.isArray(args) || args.some(value => typeof value !== "string")) throw new TypeError("args must be an array of strings");
  if (options.cwd !== undefined && typeof options.cwd !== "string") throw new TypeError("cwd must be a string");
  if (options.env !== undefined && (!options.env || typeof options.env !== "object" || Array.isArray(options.env))) throw new TypeError("env must be an object");
  if (options.signal !== undefined && typeof options.signal.addEventListener !== "function") throw new TypeError("signal must be an AbortSignal");
}

function environmentValue(environment, name) {
  const key = Object.keys(environment || {}).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : environment[key];
}

function resolveWindowsCommand(command, options) {
  const extension = path.win32.extname(command).toLowerCase();
  if ([".bat", ".cmd", ".ps1"].includes(extension)) {
    throw new Error(`Shell wrapper ${extension} commands are unsupported; invoke a native .exe or .com executable directly.`);
  }
  if (extension && ![".exe", ".com"].includes(extension)) {
    throw new Error(`Windows command scripts are unsupported; invoke a native .exe or .com executable directly.`);
  }

  const environment = options.env || process.env;
  const searchPath = environmentValue(environment, "PATH") ?? process.env.PATH ?? "";
  const pathExt = environmentValue(environment, "PATHEXT") ?? process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  const allowedExts = [...new Set(pathExt.split(";").map(value => value.trim().toLowerCase()).filter(value => [".com", ".exe"].includes(value)))];
  if (!allowedExts.length) allowedExts.push(".com", ".exe");
  const suffixes = extension ? [""] : ["", ...allowedExts];
  const hasDirectory = /[\\/]/.test(command) || path.win32.isAbsolute(command);
  const directories = hasDirectory
    ? [path.resolve(options.cwd || process.cwd(), command)]
    : searchPath.split(path.win32.delimiter).filter(Boolean).map(directory => path.join(directory.replace(/^"|"$/g, ""), command));
  for (const candidateBase of directories) {
    for (const suffix of suffixes) {
      const candidate = suffix ? `${candidateBase}${suffix}` : candidateBase;
      try { if (fs.statSync(candidate).isFile()) return path.resolve(candidate); }
      catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
    }
  }
  throw new Error(`Windows executable not found in PATH: ${command}`);
}

function launchOwned(command, args = [], options = {}) {
  validate(command, args, options);
  if (options.processContract !== undefined && !["contained", "foreground"].includes(options.processContract)) {
    throw new TypeError("processContract must be 'contained' or 'foreground' when provided");
  }
  if (process.platform === "win32") return launchWindows(resolveWindowsCommand(command, options), args, options);
  if (options.processContract === "foreground") return launchPosix(command, args, options);
  return Promise.reject(new Error("Reliable whole-process-family supervision is currently supported only on Windows; refusing to launch on this platform."));
}

async function launchWindows(command, args, options) {
  const pipeName = `managed-process-${process.pid}-${crypto.randomUUID()}`;
  const pipePath = `\\\\.\\pipe\\${pipeName}`;
  const server = net.createServer();
  let rejectConnection;
  const connected = new Promise((resolve, reject) => {
    rejectConnection = reject;
    server.once("connection", resolve);
    server.once("error", reject);
    server.listen(pipePath);
  });
  const powershell = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
  const host = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-PipeName", pipeName], {
    stdio: options.stdio ?? "inherit", windowsHide: true, shell: false,
  });
  host.once("error", error => { rejectConnection(error); try { server.close(); } catch { /* already closed */ } });
  let socket;
  let reader;
  let socketError = null;
  let cancelSent = false;
  let aborted = Boolean(options.signal?.aborted);
  const sendCancel = () => {
    if (cancelSent || !socket?.writable || socket.destroyed) return;
    cancelSent = true;
    writeMessage(socket, { type: "cancel" });
  };
  const abort = () => { aborted = true; sendCancel(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    socket = await withTimeout(connected, "Windows process supervisor did not connect to its private control pipe");
    socket.on("error", error => { socketError = error; });
    server.close();
    reader = readMessages(socket);
    writeMessage(socket, { type: "launch", ownerPid: process.pid, command, args, cwd: options.cwd || process.cwd(), env: options.env || process.env });
    const event = await withTimeout(reader.next(), "Windows process supervisor did not prepare the command");
    if (event.type === "result" && event.error) {
      return { code: event.code ?? null, signal: event.signal || null, treeStopped: event.treeStopped === true, rootInJob: event.rootInJob === true, killOnClose: event.killOnClose === true, proof: event.proof, error: event.error, aborted: event.aborted === true, supervision: "windows-job-object" };
    }
    if (event.type !== "spawn" || !Number.isInteger(event.pid) || !Number.isInteger(event.hostPid)) {
      throw new Error(event.error || socketError?.message || "Windows process supervisor failed before command start");
    }
    if (aborted) sendCancel();
    else {
      await options.onSpawn?.({ pid: event.pid, hostPid: event.hostPid, rootInJob: event.rootInJob === true, killOnClose: event.killOnClose === true });
      if (aborted) sendCancel();
      else writeMessage(socket, { type: "go" });
    }
    const result = await reader.next();
    if (result.type !== "result") throw new Error(result.error || "Windows process supervisor returned no result");
    return { code: result.code, signal: result.signal || null, treeStopped: result.treeStopped === true, rootInJob: result.rootInJob === true, killOnClose: result.killOnClose === true, proof: result.proof, error: result.error || null, aborted: aborted || result.aborted === true, supervision: "windows-job-object" };
  } catch (error) {
    if (socket?.writable) socket.destroy();
    if (host.exitCode === null && host.signalCode === null) host.kill();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    reader?.close();
    if (socket && !socket.destroyed) socket.end();
    try { server.close(); } catch { /* already closed */ }
  }
}

async function launchPosix(command, args, options) {
  const requestedStdio = options.stdio ?? "inherit";
  const hostStdio = Array.isArray(requestedStdio)
    ? [...requestedStdio.slice(0, 3), "pipe"]
    : [requestedStdio, requestedStdio, requestedStdio, "pipe"];
  const host = spawn(process.execPath, [__filename, "--managed-process-host"], {
    stdio: hostStdio, detached: true, windowsHide: true, shell: false,
  });
  await withTimeout(new Promise((resolve, reject) => {
    host.once("spawn", resolve);
    host.once("error", reject);
  }), "POSIX process supervisor could not start");
  const control = host.stdio[3];
  const reader = readMessages(control);
  let aborted = Boolean(options.signal?.aborted);
  const abort = () => { aborted = true; if (!control.destroyed) writeMessage(control, { type: "cancel" }); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const ready = await withTimeout(reader.next(), "POSIX process supervisor did not become ready");
    if (ready.type !== "ready") throw new Error(ready.error || "POSIX process supervisor failed to start");
    writeMessage(control, { type: "launch", command, args, cwd: options.cwd || process.cwd(), env: options.env || process.env });
    const event = await withTimeout(reader.next(), "POSIX process supervisor did not prepare the command");
    if (event.type === "result" && event.error) {
      return {
        code: event.code ?? null, signal: event.signal || null, treeStopped: false,
        groupStopped: event.groupStopped === true, proof: event.proof,
        error: event.error, aborted: event.aborted === true,
        cleanupBasis: "declared-foreground-contract", supervision: "posix-process-group", safeForLimitedCleanup: false,
      };
    }
    if (event.type !== "spawn" || !Number.isInteger(event.pid) || !Number.isInteger(event.hostPid)) {
      throw new Error(event.error || "POSIX process supervisor failed before command start");
    }
    if (aborted) writeMessage(control, { type: "cancel" });
    else {
      await options.onSpawn?.({ pid: event.pid, hostPid: event.hostPid });
      if (aborted) writeMessage(control, { type: "cancel" });
      else writeMessage(control, { type: "go" });
    }
    const result = await reader.next();
    if (result.type !== "result") throw new Error(result.error || "POSIX process supervisor returned no result");
    return {
      code: result.code, signal: result.signal || null, treeStopped: false,
      groupStopped: result.groupStopped === true, proof: result.proof,
      error: result.error || null, aborted: aborted || result.aborted === true,
      cleanupBasis: "declared-foreground-contract", supervision: "posix-process-group",
      safeForLimitedCleanup: result.safeForLimitedCleanup === true,
    };
  } catch (error) {
    if (!control.destroyed) control.destroy();
    if (host.exitCode === null && host.signalCode === null) host.kill();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    reader.close();
    if (!control.destroyed) control.end();
  }
}

function parseLine(line) {
  try { return JSON.parse(line); }
  catch { throw new Error("invalid control message"); }
}

async function targetGate(control) {
  const lines = readline.createInterface({ input: control, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) { lines.close(); process.exit(125); }
  const configuration = parseLine(first.value);
  if (configuration.type !== "config") { lines.close(); process.exit(125); }
  const decision = await iterator.next();
  if (decision.done || parseLine(decision.value).type !== "go") { lines.close(); process.exit(125); }
  const { command, args, cwd, env } = configuration;
  const child = spawn(command, args, { cwd, env, stdio: "inherit", detached: false, shell: false });
  let spawnError = null;
  child.once("error", error => {
    spawnError = error;
    process.stderr.write(`managed-process: ${error.message}\n`);
    process.exitCode = 127;
  });
  child.once("close", (code, signal) => {
    const result = { type: "target-result", code: spawnError ? 127 : code, signal };
    try { control.write(`${JSON.stringify(result)}\n`); } catch { /* supervisor already left */ }
    lines.close();
    control.end();
  });
  // Keep the target gate alive until its direct command exits. The host owns
  // process-group cleanup, including descendants detached from this parent.
  await new Promise(resolve => child.once("close", resolve));
}

async function posixHost() {
  const control = new net.Socket({ fd: 3, readable: true, writable: true });
  const lines = readline.createInterface({ input: control, crlfDelay: Infinity });
  const incoming = lines[Symbol.asyncIterator]();
  const send = value => control.write(`${JSON.stringify(value)}\n`);
  let activeGroup = null;
  let pipeLost = false;
  control.on("close", () => { pipeLost = true; });
  send({ type: "ready", hostPid: process.pid });
  try {
    const request = await incoming.next();
    if (request.done) throw new Error("control pipe closed before launch");
    const config = parseLine(request.value);
    if (config.type !== "launch") throw new Error("expected launch request");
    const target = spawn(process.execPath, [__filename, "--managed-process-target"], {
      stdio: ["inherit", "inherit", "inherit", "pipe"], detached: true, windowsHide: true, shell: false,
    });
    activeGroup = target.pid;
    const targetControl = target.stdio[3];
    const targetReader = readMessages(targetControl);
    const gateReady = await targetReader.next();
    if (gateReady.type !== "ready") throw new Error("target gate did not become ready");
    targetControl.write(`${JSON.stringify({ type: "config", command: config.command, args: config.args, cwd: config.cwd, env: config.env })}\n`);
    send({ type: "spawn", pid: target.pid, hostPid: process.pid });
    const decision = await incoming.next();
    if (decision.done || parseLine(decision.value).type !== "go") {
      try { process.kill(-activeGroup, "SIGKILL"); } catch { /* already exited */ }
      const groupStopped = await waitGroupStopped(activeGroup);
      const result = {
        type: "result", code: null, signal: "SIGTERM", treeStopped: false, groupStopped,
        proof: groupStopped ? "owned-process-group-absent" : "owned-process-group-still-live",
        cleanupBasis: "declared-foreground-contract", supervision: "posix-process-group", safeForLimitedCleanup: false, aborted: true,
      };
      send(result); return;
    }
    targetControl.write(`${JSON.stringify({ type: "go" })}\n`);
    let commandResult = null;
    let aborted = false;
    const targetResult = targetReader.next();
    let cancelResult = incoming.next().then(value => ({ value }), error => ({ error }));
    while (!commandResult) {
      const done = await Promise.race([
        targetResult.then(value => ({ kind: "target", value }), error => ({ kind: "target-error", error })),
        cancelResult.then(result => ({ kind: "control", ...result })),
      ]);
      if (done.kind === "target") commandResult = done.value;
      else if (done.kind === "target-error") throw done.error;
      else if (done.error || done.value?.done) { pipeLost = true; aborted = true; }
      else if (parseLine(done.value.value).type === "cancel") aborted = true;
      if (aborted) {
        try { process.kill(-activeGroup, "SIGTERM"); } catch { /* process group may have exited */ }
        await delay(300);
        try { process.kill(-activeGroup, "SIGKILL"); } catch { /* process group may have exited */ }
        break;
      }
      cancelResult = incoming.next().then(value => ({ value }), error => ({ error }));
    }
    if (!aborted) {
      try { process.kill(-activeGroup, "SIGTERM"); } catch { /* no descendants remain */ }
      await delay(80);
      try { process.kill(-activeGroup, "SIGKILL"); } catch { /* group has stopped */ }
    }
    const groupStopped = await waitGroupStopped(activeGroup);
    const safeForLimitedCleanup = Boolean(commandResult && !aborted && groupStopped);
    send({
      type: "result", code: commandResult?.code ?? null, signal: commandResult?.signal || null,
      treeStopped: false, groupStopped, proof: groupStopped ? "owned-process-group-absent" : "owned-process-group-still-live",
      cleanupBasis: "declared-foreground-contract", supervision: "posix-process-group",
      safeForLimitedCleanup, aborted,
    });
  } catch (error) {
    if (activeGroup) { try { process.kill(-activeGroup, "SIGKILL"); } catch { /* already stopped */ } }
    const groupStopped = activeGroup ? await waitGroupStopped(activeGroup) : false;
    send({
      type: "result", code: null, signal: null, treeStopped: false, groupStopped,
      proof: "supervisor-error", error: error.message, cleanupBasis: "declared-foreground-contract",
      supervision: "posix-process-group", safeForLimitedCleanup: false, aborted: true,
    });
  } finally { lines.close(); control.end(); }
}

async function waitGroupStopped(group) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { process.kill(-group, 0); } catch (error) { if (error.code === "ESRCH") return true; }
    await delay(25);
  }
  try { process.kill(-group, 0); return false; } catch (error) { return error.code === "ESRCH"; }
}

if (require.main === module && process.argv[2] === "--managed-process-host") posixHost().catch(() => { process.exitCode = 125; });
if (require.main === module && process.argv[2] === "--managed-process-target") {
  const control = new net.Socket({ fd: 3, readable: true, writable: true });
  control.write(`${JSON.stringify({ type: "ready" })}\n`);
  targetGate(control).catch(() => { process.exitCode = 125; });
}

module.exports = { launchOwned };
