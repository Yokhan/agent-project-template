"use strict";

const path = require("path");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { performance } = require("perf_hooks");

const PROTOCOL_VERSION = 1;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PHASES = new Set(["prelaunch", "periodic", "final", "export"]);
const SCAN_KINDS = new Set(["live", "stable"]);
const RESULT_STATUSES = new Set(["complete", "incomplete", "cancelled"]);
const REASONS = new Set(["budget-exhausted", "linked-entry", "unsupported-entry", "not-a-real-directory", "tree-changed-during-observation", "unsafe-or-unreadable-entry", "cancelled"]);
const RESOURCE_LIMITS = Object.freeze({ maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, codeRangeSizeMb: 16, stackSizeMb: 4 });
const MAX_ROOT_LENGTH = 32768;
const MAX_OBSERVATION_ID = 0x7fffffff;

function plainRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) { return plainRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function sanitizedError(code) { return Object.assign(new Error(code), { code }); }
function validResult(message) {
  const keys = ["type", "version", "runId", "observationId", "phase", "scanKind", "status", "complete", "bytes", "files", "reason", "transientMissingEntries", "elapsedMs", "entriesExamined", "exhaustedBy"];
  return exactKeys(message, keys) && message.type === "result" && message.version === PROTOCOL_VERSION &&
    RUN_ID.test(message.runId) && Number.isSafeInteger(message.observationId) && message.observationId > 0 &&
    PHASES.has(message.phase) && SCAN_KINDS.has(message.scanKind) && RESULT_STATUSES.has(message.status) &&
    typeof message.complete === "boolean" && Number.isSafeInteger(message.bytes) && message.bytes >= 0 &&
    Number.isSafeInteger(message.files) && message.files >= 0 &&
    (message.reason === null || typeof message.reason === "string" && REASONS.has(message.reason)) &&
    Number.isSafeInteger(message.transientMissingEntries) && message.transientMissingEntries >= 0 &&
    Number.isFinite(message.elapsedMs) && message.elapsedMs >= 0 &&
    Number.isSafeInteger(message.entriesExamined) && message.entriesExamined >= 0 &&
    (message.status === "complete"
      ? message.complete && message.reason === null && message.exhaustedBy === null
      : message.status === "cancelled"
        ? !message.complete && message.reason === "cancelled" && message.exhaustedBy === null
        : !message.complete && typeof message.reason === "string" && message.reason !== "cancelled" &&
          (message.reason === "budget-exhausted"
            ? message.exhaustedBy === "time" || message.exhaustedBy === "entries"
            : message.exhaustedBy === null));
}

class ObservationWorkerController {
  constructor({ runId, runStartedAt, timing, workerFactory, onFailure }) {
    if (!RUN_ID.test(runId)) throw new TypeError("Observation worker requires a managed run ID");
    this.runId = runId;
    this.runStartedAt = runStartedAt;
    this.timing = timing;
    this.workerFactory = workerFactory || ((entryPath, options) => new Worker(entryPath, options));
    this.customWorkerFactory = Boolean(workerFactory);
    this.onFailure = typeof onFailure === "function" ? onFailure : () => {};
    this.worker = null;
    this.ready = false;
    this.exitWait = deferred();
    this.cancelBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    this.cancelFlag = new Int32Array(this.cancelBuffer);
    this.inFlight = null;
    this.nextObservationId = 0;
    this.stickyFailure = null;
    this.runFailureKind = null;
    this.closing = false;
    this.terminationAttempted = false;
    this.terminationPromise = null;
    this.exited = false;
    this.unknownWorker = false;
    this.exitCode = null;
    this.state = {
      status: "idle", observationId: null, phase: null,
      dispatchStartElapsedMs: null, deadlineElapsedMs: null,
      lastResultStatus: null, coverageAgeMs: null, lastCompleteStartElapsedMs: null,
      failureKind: null, scanSettled: true, settled: false, exitCode: null, skippedTicks: 0,
    };
  }

  snapshot(runStartedAt) {
    const snapshot = { ...this.state };
    if (runStartedAt !== undefined && this.inFlight) snapshot.dispatchStartElapsedMs = Math.max(0, this.inFlight.startedAt - runStartedAt);
    if (runStartedAt !== undefined && this.inFlight) snapshot.deadlineElapsedMs = Math.max(0, this.inFlight.deadlineAt - runStartedAt);
    snapshot.scanSettled = !this.inFlight;
    snapshot.settled = this.exited || !this.worker && !this.unknownWorker;
    snapshot.exitCode = this.exitCode;
    return snapshot;
  }

  get busy() { return Boolean(this.inFlight); }
  noteSkippedTick() { this.state.skippedTicks = Math.min(Number.MAX_SAFE_INTEGER, this.state.skippedTicks + 1); }
  markRunFailure(kind) { this.runFailureKind ||= kind; this.state.failureKind ||= kind; }

  _fail(kind, flight = this.inFlight) {
    if (!this.stickyFailure) this.stickyFailure = kind;
    this.runFailureKind ||= kind;
    this.state.failureKind ||= kind;
    this.state.status = this.exited ? "exited" : "failed";
    if (flight && !flight.promiseSettled) {
      flight.promiseSettled = true;
      this.timing.clearTimeout(flight.deadlineTimer);
      flight.reject(sanitizedError(kind));
    }
    if (this.cancelFlag) Atomics.store(this.cancelFlag, 0, 1);
    try { this.onFailure(kind); } catch { /* caller failure must not mask observer failure */ }
  }

  _ensureWorker() {
    if (this.worker || this.exited) return;
    const workerData = { protocolVersion: PROTOCOL_VERSION, runId: this.runId, cancelBuffer: this.cancelBuffer };
    const workerOptions = { workerData, resourceLimits: { ...RESOURCE_LIMITS }, env: {}, execArgv: [] };
    const entryPath = path.resolve(__dirname, "managed-observation-worker.js");
    let candidate;
    try {
      candidate = this.workerFactory(entryPath, workerOptions);
    } catch {
      this.unknownWorker = this.customWorkerFactory;
      this.exited = !this.unknownWorker;
      this.state.status = "failed";
      this.state.settled = this.exited;
      this._fail("worker-start-error", null);
      if (this.exited) this.exitWait.resolve({ code: null, error: true });
      return;
    }
    this.worker = candidate || null;
    if (!candidate) {
      this.unknownWorker = this.customWorkerFactory;
      this.exited = !this.unknownWorker;
      this.state.status = "failed";
      this.state.settled = this.exited;
      this._fail("worker-factory-invalid", null);
      if (this.exited) this.exitWait.resolve({ code: null, error: true });
      return;
    }
    if (typeof candidate.on !== "function") {
      this.state.status = "unsettled";
      this.state.settled = false;
      this._fail("worker-factory-invalid", this.inFlight);
      return;
    }
    try { candidate.on("exit", code => this._onExit(code)); }
    catch { this.state.status = "unsettled"; this.state.settled = false; this._fail("worker-factory-invalid", this.inFlight); return; }
    this.state.status = "starting";
    if (typeof candidate.postMessage !== "function" || typeof candidate.terminate !== "function") {
      this._fail("worker-factory-invalid", this.inFlight);
      return;
    }
    try {
      candidate.on("message", message => this._onMessage(message));
      candidate.on("error", () => this._fail("worker-error"));
    } catch { this._fail("worker-factory-invalid", this.inFlight); }
  }

  _onExit(code) {
    this.exited = true;
    this.unknownWorker = false;
    this.exitCode = Number.isSafeInteger(code) ? code : null;
    this.state.exitCode = this.exitCode;
    this.state.settled = true;
    this.state.status = this.closing ? "exited" : "failed";
    this.exitWait.resolve({ code: this.exitCode, error: false });
    if (this.inFlight) {
      const flight = this.inFlight;
      if (!flight.settledWait) { flight.settledWait = true; flight.settle({ kind: "worker-exit", code: this.exitCode }); }
      if (!flight.promiseSettled) this._fail("worker-exit", flight);
      this.inFlight = null;
    }
    if (!this.closing && !this.stickyFailure) this._fail("worker-exit", null);
  }

  _onMessage(message) {
    if (exactKeys(message, ["type", "version", "runId"]) && message.type === "ready" &&
        message.version === PROTOCOL_VERSION && message.runId === this.runId && !this.ready) {
      this.ready = true;
      this.state.status = this.inFlight?.cancelRequested ? "cancelled" : "pending";
      this._postCurrent();
      return;
    }
    if (!validResult(message)) { this._fail("worker-protocol-invalid"); return; }
    const flight = this.inFlight;
    if (!flight || message.runId !== this.runId || message.observationId !== flight.observationId ||
        message.phase !== flight.phase || message.scanKind !== flight.scanKind) {
      this._fail("worker-result-mismatch", flight);
      return;
    }
    if (this.timing.now() >= flight.deadlineAt) {
      this._fail("worker-result-late", flight);
      if (!flight.settledWait) { flight.settledWait = true; flight.settle({ kind: "late-result" }); }
      this.inFlight = null;
      return;
    }
    if (message.entriesExamined > flight.maxEntries ||
        message.status === "cancelled" && !flight.cancelRequested && !this.stickyFailure) {
      this._fail("worker-protocol-invalid", flight);
      return;
    }
    this.timing.clearTimeout(flight.deadlineTimer);
    flight.resultReceived = true;
    const result = flight.cancelRequested
      ? { ...message, status: "cancelled", complete: false, reason: "cancelled", exhaustedBy: null }
      : message;
    if (result.status === "complete") this.state.status = "complete";
    else if (result.status === "cancelled") this.state.status = "cancelled";
    else this.state.status = "failed";
    this.state.observationId = message.observationId;
    this.state.phase = message.phase;
    this.state.lastResultStatus = result.status;
    if (!this.stickyFailure && !this.runFailureKind) this.state.failureKind = null;
    this.state.dispatchStartElapsedMs = Math.max(0, flight.startedAt - this.runStartedAt);
    this.state.deadlineElapsedMs = Math.max(0, flight.deadlineAt - this.runStartedAt);
    if (!flight.settledWait) { flight.settledWait = true; flight.settle({ kind: "result", result }); }
    this.inFlight = null;
    if (!flight.promiseSettled) { flight.promiseSettled = true; flight.resolve(result); }
  }

  _postCurrent() {
    const flight = this.inFlight;
    if (!flight || flight.posted || !this.ready || this.exited) return;
    if (this.timing.now() >= flight.deadlineAt) { this._fail("worker-start-late", flight); return; }
    flight.posted = true;
    try {
      this.worker.postMessage({
        type: "scan", version: PROTOCOL_VERSION, runId: this.runId,
        observationId: flight.observationId, phase: flight.phase,
        root: flight.root, scanKind: flight.scanKind,
        budgetMs: flight.budgetMs, maxEntries: flight.maxEntries,
      });
    } catch { this._fail("worker-post-error", flight); }
  }

  observe({ phase, root, scanKind, budgetMs, maxEntries }) {
    if (this.stickyFailure) return Promise.reject(sanitizedError(this.stickyFailure));
    if (this.closing || this.exited) return Promise.reject(sanitizedError("worker-not-available"));
    if (this.inFlight) {
      this.noteSkippedTick();
      return Promise.reject(sanitizedError("worker-busy"));
    }
    if (!PHASES.has(phase) || !SCAN_KINDS.has(scanKind) ||
        phase === "periodic" && scanKind !== "live" || phase !== "periodic" && scanKind !== "stable" ||
        typeof root !== "string" || root.length < 1 || root.length > MAX_ROOT_LENGTH || !path.isAbsolute(root) ||
        budgetMs !== 10000 || maxEntries !== 100000 || this.nextObservationId >= MAX_OBSERVATION_ID) {
      this._fail("worker-request-invalid", null);
      return Promise.reject(sanitizedError(this.stickyFailure));
    }
    const observationId = ++this.nextObservationId;
    const startedAt = this.timing.now();
    const deadlineAt = startedAt + budgetMs;
    const promise = deferred();
    const settlement = deferred();
    const flight = {
      observationId, phase, root, scanKind, budgetMs, maxEntries,
      startedAt, deadlineAt, posted: false, cancelRequested: false,
      promiseSettled: false, settledWait: false, resultReceived: false,
      resolve: promise.resolve, reject: promise.reject,
      settlement: settlement.promise, settle: settlement.resolve,
    };
    this.inFlight = flight;
    this.state.status = this.ready ? "pending" : "starting";
    this.state.observationId = observationId;
    this.state.phase = phase;
    this.state.dispatchStartElapsedMs = Math.max(0, startedAt - this.runStartedAt);
    this.state.deadlineElapsedMs = Math.max(0, deadlineAt - this.runStartedAt);
    this.state.lastResultStatus = null;
    this.state.scanSettled = false;
    flight.deadlineTimer = this.timing.setTimeout(() => {
      if (this.inFlight === flight && !flight.cancelRequested) this._fail("worker-deadline", flight);
    }, Math.max(0, deadlineAt - this.timing.now()));
    Atomics.store(this.cancelFlag, 0, 0);
    this._ensureWorker();
    if (this.ready) this._postCurrent();
    return promise.promise;
  }

  cancelActive() {
    const flight = this.inFlight;
    if (!flight || flight.cancelRequested) return false;
    flight.cancelRequested = true;
    Atomics.store(this.cancelFlag, 0, 1);
    this.timing.clearTimeout(flight.deadlineTimer);
    if (!this.stickyFailure) this.state.status = "cancelled";
    return true;
  }

  async cancelAndJoin() {
    const flight = this.inFlight;
    if (!flight && this.exited) return { settled: true, reusable: false, acknowledged: false };
    if (!flight && this.stickyFailure) return this.terminateAndJoin(10000);
    if (!flight) return {
      settled: !this.unknownWorker,
      reusable: Boolean(this.worker) && !this.unknownWorker,
      acknowledged: false,
    };
    if (this.stickyFailure) return this.terminateAndJoin(10000);
    this.cancelActive();
    const remainingMs = Math.max(0, flight.deadlineAt - this.timing.now());
    const outcome = await this._raceTimer(flight.settlement.then(value => ({ settled: true, value })), remainingMs, { settled: false });
    if (outcome.settled) return { settled: true, reusable: Boolean(this.worker) && !this.exited, acknowledged: outcome.value?.kind === "result" };
    this._fail("worker-cancel-unacknowledged", flight);
    return this.terminateAndJoin(10000);
  }

  async terminateAndJoin(waitMs = 10000) {
    if (!this.worker) {
      if (this.exited) { this.state.status = "exited"; this.state.settled = true; return { settled: true, reusable: false, acknowledged: false }; }
      if (!this.unknownWorker) { this.exited = true; this.state.status = "exited"; this.state.settled = true; return { settled: true, reusable: false, acknowledged: false }; }
      return { settled: false, reusable: false, acknowledged: false };
    }
    if (this.exited) return { settled: true, reusable: false, acknowledged: false };
    if (this.terminationAttempted) return { settled: false, reusable: false, acknowledged: false };
    this.terminationAttempted = true;
    this.closing = true;
    if (this.inFlight) this.cancelActive();
    this.state.status = "exiting";
    try {
      this.terminationPromise = Promise.resolve(this.worker.terminate());
      await this._raceTimer(Promise.all([this.terminationPromise, this.exitWait.promise]), waitMs, null, true);
      if (this.inFlight) {
        const flight = this.inFlight;
        if (!flight.settledWait) { flight.settledWait = true; flight.settle({ kind: "worker-exit", code: this.exitCode }); }
        if (!flight.promiseSettled) { flight.promiseSettled = true; flight.reject(sanitizedError("worker-terminated")); }
        this.inFlight = null;
      }
      return { settled: this.exited, reusable: false, acknowledged: false };
    } catch {
      if (this.exited) return { settled: true, reusable: false, acknowledged: false };
      this.state.status = "unsettled";
      return { settled: false, reusable: false, acknowledged: false };
    }
  }

  unrefAfterRetention() {
    if (!this.exited && this.worker && typeof this.worker.unref === "function") this.worker.unref();
  }

  _raceTimer(promise, waitMs, fallback, rejectOnTimeout = false) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = this.timing.setTimeout(() => rejectOnTimeout ? reject(sanitizedError("worker-join-timeout")) : resolve(fallback), waitMs);
    });
    return Promise.race([promise, timeout]).finally(() => this.timing.clearTimeout(timer));
  }
}

function runWorker() {
  const data = workerData;
  const keys = ["protocolVersion", "runId", "cancelBuffer"];
  if (!exactKeys(data, keys) || data.protocolVersion !== PROTOCOL_VERSION || !RUN_ID.test(data.runId) || !(data.cancelBuffer instanceof SharedArrayBuffer)) {
    throw new Error("invalid worker initialization");
  }
  const cancelFlag = new Int32Array(data.cancelBuffer);
  const managed = require("./managed-temp.js");
  let inFlight = false;
  parentPort.postMessage({ type: "ready", version: PROTOCOL_VERSION, runId: data.runId });
  parentPort.on("message", message => {
    const keysForRequest = ["type", "version", "runId", "observationId", "phase", "root", "scanKind", "budgetMs", "maxEntries"];
    if (!exactKeys(message, keysForRequest) || message.type !== "scan" || message.version !== PROTOCOL_VERSION ||
        message.runId !== data.runId || !Number.isSafeInteger(message.observationId) || message.observationId <= 0 ||
        !PHASES.has(message.phase) || !SCAN_KINDS.has(message.scanKind) ||
        message.phase === "periodic" && message.scanKind !== "live" || message.phase !== "periodic" && message.scanKind !== "stable" ||
        typeof message.root !== "string" || message.root.length < 1 || message.root.length > MAX_ROOT_LENGTH || !path.isAbsolute(message.root) ||
        message.budgetMs !== 10000 || message.maxEntries !== 100000 || inFlight) {
      parentPort.postMessage({ type: "protocol-error", version: PROTOCOL_VERSION, runId: data.runId });
      return;
    }
    inFlight = true;
    const startedAt = performance.now();
    let observed;
    try {
      observed = managed.observeTree(message.root, {
        budgetMs: message.budgetMs,
        maxEntries: message.maxEntries,
        ...(message.scanKind === "live" ? { allowTransientMissing: true } : { verifyStable: true }),
        shouldCancel: () => Atomics.load(cancelFlag, 0) !== 0,
      });
    } catch {
      observed = { bytes: 0, files: 0, complete: false, reason: "unsafe-or-unreadable-entry", transientMissingEntries: 0, elapsedMs: performance.now() - startedAt, entriesExamined: 0, exhaustedBy: null };
    }
    const wasCancelled = Atomics.load(cancelFlag, 0) !== 0 || observed.reason === "cancelled";
    const status = wasCancelled ? "cancelled" : observed.complete ? "complete" : "incomplete";
    const result = {
      type: "result", version: PROTOCOL_VERSION, runId: data.runId,
      observationId: message.observationId, phase: message.phase, scanKind: message.scanKind,
      status, complete: status === "complete",
      bytes: Number.isSafeInteger(observed.bytes) && observed.bytes >= 0 ? observed.bytes : 0,
      files: Number.isSafeInteger(observed.files) && observed.files >= 0 ? observed.files : 0,
      reason: status === "cancelled" ? "cancelled" : observed.complete ? null : REASONS.has(observed.reason) ? observed.reason : "unsafe-or-unreadable-entry",
      transientMissingEntries: Number.isSafeInteger(observed.transientMissingEntries) && observed.transientMissingEntries >= 0 ? observed.transientMissingEntries : 0,
      elapsedMs: Number.isFinite(observed.elapsedMs) && observed.elapsedMs >= 0 ? observed.elapsedMs : Math.max(0, performance.now() - startedAt),
      entriesExamined: Number.isSafeInteger(observed.entriesExamined) && observed.entriesExamined >= 0 ? observed.entriesExamined : 0,
      exhaustedBy: observed.exhaustedBy === "time" || observed.exhaustedBy === "entries" ? observed.exhaustedBy : null,
    };
    parentPort.postMessage(result);
    inFlight = false;
  });
}

if (isMainThread) module.exports = { ObservationWorkerController, RESOURCE_LIMITS };
else runWorker();
