"use strict";

// Reusable caches owned by this project, isolated from global tool caches.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const managedTemp = require("./managed-temp.js");

const CACHE_MARKER = ".managed-cache-owner.json";
const OPERATION_CLAIM = ".operation.claim";
const HASH_PREFIX_LENGTH = 32;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 * 1024;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_BUDGET_MS = 1000;
const KIND = /^[a-z0-9][a-z0-9_-]{0,39}$/iu;

function projectRoot(root) {
  const canonical = managedTemp.assertNoLinks(root);
  const stat = fs.lstatSync(canonical);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Project root must be a real directory");
  return fs.realpathSync.native(canonical);
}
function projectHash(root) { return crypto.createHash("sha256").update(root, "utf8").digest("hex"); }
function cacheBase() { return path.join(os.homedir(), ".cache", "apt-c"); }
function ensureDirectory(target) {
  const absolute = path.resolve(target);
  managedTemp.assertNoLinks(absolute, { allowMissing: true });
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Refusing non-directory cache path: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      try { fs.mkdirSync(current, { mode: 0o700 }); }
      catch (createError) { if (createError.code !== "EEXIST") throw createError; }
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Cache directory creation was redirected: ${current}`);
    }
  }
}
function cacheDirectory(root, kind) {
  const project = projectRoot(root);
  if (typeof kind !== "string" || !KIND.test(kind)) throw new TypeError("cache kind must be a short safe identifier");
  return { project, hash: projectHash(project), directory: path.join(cacheBase(), projectHash(project).slice(0, HASH_PREFIX_LENGTH), kind.toLowerCase()) };
}
function cachePath(projectRootValue, kind) { return cacheDirectory(projectRootValue, kind).directory; }
function safeJson(file) {
  try {
    managedTemp.assertNoLinks(file);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch { return null; }
}
function readCache(directory, root, hash, kind) {
  try {
    managedTemp.assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    const marker = safeJson(path.join(directory, CACHE_MARKER));
    if (!marker || marker.version !== 1 || marker.projectRoot !== root || marker.projectHash !== hash || marker.kind !== kind ||
      path.basename(directory) !== kind || !Number.isFinite(Date.parse(marker.createdAt)) || !Number.isFinite(Date.parse(marker.lastUsedAt))) return null;
    const expected = path.join(cacheBase(), hash.slice(0, HASH_PREFIX_LENGTH), kind);
    if (path.resolve(directory) !== path.resolve(expected)) return null;
    return marker;
  } catch { return null; }
}
function writeJsonAtomic(file, value) {
  managedTemp.assertNoLinks(path.dirname(file));
  managedTemp.assertNoLinks(file, { allowMissing: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temp, "wx", 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(value)}\n`, "utf8"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  managedTemp.assertNoLinks(path.dirname(file));
  managedTemp.assertNoLinks(file, { allowMissing: true });
  fs.renameSync(temp, file);
}
function acquireGate(base) {
  ensureDirectory(base);
  const file = path.join(base, OPERATION_CLAIM);
  const claim = { version: 1, pid: process.pid, token: crypto.randomUUID(), createdAt: new Date().toISOString() };
  try {
    managedTemp.assertNoLinks(base);
    const fd = fs.openSync(file, "wx", 0o600);
    try { fs.writeFileSync(fd, `${JSON.stringify(claim)}\n`, "utf8"); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    return { file, claim };
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const current = safeJson(file);
    const reason = !current || current.version !== 1 || !Number.isInteger(current.pid) || typeof current.token !== "string"
      ? "invalid-operation-claim"
      : isAlive(current.pid) ? "operation-in-progress" : "stale-operation-claim-requires-manual-recovery";
    return { busy: true, reason };
  }
}
function releaseGate(lock) {
  const current = safeJson(lock.file);
  if (!current || current.token !== lock.claim.token || current.pid !== lock.claim.pid) return false;
  managedTemp.assertNoLinks(path.dirname(lock.file));
  managedTemp.assertNoLinks(lock.file);
  fs.unlinkSync(lock.file);
  return true;
}
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}
function readLease(file, cache) {
  const lease = safeJson(file);
  if (!lease || lease.version !== 1 || lease.projectRoot !== cache.projectRoot || lease.projectHash !== cache.projectHash || lease.kind !== cache.kind ||
    lease.cachePath !== cache.directory || !Number.isInteger(lease.pid) || lease.pid < 1 || typeof lease.token !== "string" || typeof lease.runRoot !== "string" ||
    lease.supervisorPid !== undefined && lease.supervisorPid !== null && (!Number.isInteger(lease.supervisorPid) || lease.supervisorPid < 1)) return null;
  return lease;
}
function leaseState(lease) {
  if (isAlive(lease.pid) || isAlive(lease.supervisorPid)) return { active: true, uncertain: false, reason: "active-cache-lease" };
  const run = managedTemp.inspectRunLease(lease.runRoot);
  if (run.valid) {
    if (run.active) return { active: true, uncertain: false, reason: "active-cache-lease" };
    if (run.pending) return { active: false, uncertain: true, reason: run.reason };
    return { active: false, uncertain: false, reason: null };
  }
  // A completed scratch sweep removes its owner marker. That is recoverable
  // only when this lease was explicitly bound to the supervised host and that
  // host has exited (its contained process family has then been closed).
  if (lease.supervisorPid !== undefined && lease.supervisorPid !== null && isCanonicalMissingRun(lease)) {
    return { active: false, uncertain: false, reason: null };
  }
  return { active: false, uncertain: true, reason: run.reason || "unknown-run-lease" };
}
function isCanonicalMissingRun(lease) {
  let base;
  try {
    managedTemp.assertNoLinks(lease.projectRoot);
    const project = fs.realpathSync.native(lease.projectRoot);
    if (project !== lease.projectRoot) return false;
    base = managedTemp.managedBase(project);
  } catch { return false; }
  const runRoot = path.resolve(lease.runRoot);
  const id = path.basename(runRoot);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id) || runRoot !== path.resolve(base, id)) return false;
  try {
    fs.lstatSync(runRoot);
    return false;
  } catch (error) {
    return error.code === "ENOENT";
  }
}
function leaseDirectory(cache) { return path.join(path.dirname(cache.directory), ".leases", cache.kind); }
function readNamesBounded(directory, deadline, state, maxEntries = 100000) {
  const names = [];
  const dir = fs.opendirSync(directory);
  try {
    for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
      if (Date.now() > deadline || state.entries >= maxEntries) return { names, complete: false, reason: "budget-exhausted" };
      names.push(entry.name);
      state.entries += 1;
    }
  } finally { dir.closeSync(); }
  return { names, complete: true, reason: null };
}
function inspectLeases(cache, deadline = Date.now() + DEFAULT_BUDGET_MS) {
  const directory = leaseDirectory(cache);
  try {
    managedTemp.assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return { active: false, uncertain: true, reason: "invalid-lease-directory" };
  } catch (error) {
    if (error.code === "ENOENT") return { active: false, uncertain: false, reason: null };
    return { active: false, uncertain: true, reason: "linked-lease-directory" };
  }
  let names;
  try {
    const result = readNamesBounded(directory, deadline, { entries: 0 });
    if (!result.complete) return { active: false, uncertain: true, reason: result.reason };
    names = result.names;
  }
  catch { return { active: false, uncertain: true, reason: "unreadable-lease-directory" }; }
  let active = false;
  for (const name of names) {
    if (Date.now() > deadline) return { active, uncertain: true, reason: "budget-exhausted" };
    const file = path.join(directory, name);
    const lease = readLease(file, cache);
    if (!lease) return { active, uncertain: true, reason: "invalid-cache-lease" };
    const state = leaseState(lease);
    if (state.active) active = true;
    else if (state.uncertain) return { active, uncertain: true, reason: state.reason };
  }
  return { active, uncertain: false, reason: active ? "active-cache-lease" : null };
}

function inventory(directory, deadline, maxEntries = 100000) {
  managedTemp.assertNoLinks(directory);
  const stack = [directory];
  let entries = 0, bytes = 0, files = 0;
  while (stack.length) {
    if (Date.now() > deadline || entries >= maxEntries) return { complete: false, bytes: null, files: null, reason: "budget-exhausted" };
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return { complete: false, bytes: null, files: null, reason: "linked-cache-entry" };
    if (stat.isFile()) { bytes += stat.size; files += 1; entries += 1; continue; }
    if (!stat.isDirectory()) return { complete: false, bytes: null, files: null, reason: "unsupported-cache-entry" };
    const dir = fs.opendirSync(current);
    try {
      for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
        if (Date.now() > deadline || entries >= maxEntries) return { complete: false, bytes: null, files: null, reason: "budget-exhausted" };
        entries += 1;
        stack.push(path.join(current, entry.name));
      }
    } finally { dir.closeSync(); }
  }
  return { complete: true, bytes, files, reason: null };
}
function removeCache(directory, deadline, maxEntries = 100000) {
  const root = path.resolve(directory);
  const marker = path.join(root, CACHE_MARKER);
  const stack = [{ target: root, root: true, dir: fs.opendirSync(root) }];
  let entries = 0, bytesFreed = 0, filesFreed = 0;
  try {
    while (stack.length) {
      if (Date.now() > deadline || entries >= maxEntries) return { removed: false, reason: "budget-exhausted", bytesFreed, filesFreed };
      const frame = stack[stack.length - 1];
      const entry = frame.dir.readSync();
      if (entry === null) {
        frame.dir.closeSync(); stack.pop();
        if (frame.root) {
          managedTemp.assertNoLinks(marker);
          const markerBytes = fs.lstatSync(marker).size;
          fs.unlinkSync(marker);
          bytesFreed += markerBytes; filesFreed += 1;
          managedTemp.assertNoLinks(root);
          fs.rmdirSync(root);
        } else { managedTemp.assertNoLinks(frame.target); fs.rmdirSync(frame.target); }
        entries += 1;
        continue;
      }
      if (frame.root && entry.name === CACHE_MARKER) continue;
      const child = path.join(frame.target, entry.name);
      const stat = fs.lstatSync(child);
      if (stat.isSymbolicLink()) throw new Error("Refusing linked cache entry");
      if (stat.isDirectory()) stack.push({ target: child, root: false, dir: fs.opendirSync(child) });
      else {
        if (!stat.isFile()) throw new Error("Refusing unsupported cache entry");
        managedTemp.assertNoLinks(child);
        fs.unlinkSync(child);
        bytesFreed += stat.size; filesFreed += 1; entries += 1;
      }
    }
  } finally { for (const frame of stack) { try { frame.dir.closeSync(); } catch { /* already closed */ } } }
  return { removed: true, bytesFreed, filesFreed };
}
function removeStaleLeases(cache, deadline) {
  const state = inspectLeases(cache, deadline);
  if (state.active || state.uncertain) throw new Error(state.reason || "cache-lease-uncertain");
  const directory = leaseDirectory(cache);
  if (!fs.existsSync(directory)) return;
  managedTemp.assertNoLinks(directory);
  const names = readNamesBounded(directory, deadline, { entries: 0 });
  if (!names.complete) throw new Error(names.reason);
  for (const name of names.names) {
    if (Date.now() > deadline) throw new Error("budget-exhausted");
    const file = path.join(directory, name);
    const lease = readLease(file, cache);
    if (!lease) throw new Error("cache-lease-changed-during-prune");
    const leaseStatus = leaseState(lease);
    if (leaseStatus.active || leaseStatus.uncertain) throw new Error(leaseStatus.reason || "cache-run-lease-uncertain");
    managedTemp.assertNoLinks(file);
    fs.unlinkSync(file);
  }
  fs.rmdirSync(directory);
}

function emptyReport(started) {
  return { removed: [], retained: [], bytesObserved: 0, bytesFreed: 0, filesFreed: 0, bytesRetained: 0, complete: true, overBudget: false, activeOverBudget: false, reason: null, elapsedMs: Date.now() - started };
}
function validateLimits(options) {
  const maxBytes = options.maxBytes === undefined ? DEFAULT_MAX_BYTES : options.maxBytes;
  const maxAgeMs = options.maxAgeMs === undefined ? DEFAULT_MAX_AGE_MS : options.maxAgeMs;
  const budgetMs = options.budgetMs === undefined ? DEFAULT_BUDGET_MS : options.budgetMs;
  if (!Number.isFinite(maxBytes) || maxBytes < 0 || !Number.isFinite(maxAgeMs) || maxAgeMs < 0 || !Number.isFinite(budgetMs) || budgetMs < 0) throw new TypeError("cache limits must be non-negative finite numbers");
  return { maxBytes, maxAgeMs, budgetMs };
}
function enumerateOwned(base, projectFilter = null, deadline = Date.now() + DEFAULT_BUDGET_MS) {
  const caches = [];
  const budgetState = { entries: 0 };
  const projects = readNamesBounded(base, deadline, budgetState);
  if (!projects.complete) return { caches, complete: false, reason: projects.reason };
  for (const hashPrefix of projects.names) {
    if (Date.now() > deadline) return { caches, complete: false, reason: "budget-exhausted" };
    if (!/^[0-9a-f]{32}$/iu.test(hashPrefix)) continue;
    const projectDirectory = path.join(base, hashPrefix);
    let projectStat;
    try { projectStat = fs.lstatSync(projectDirectory); } catch { continue; }
    if (!projectStat.isDirectory() || projectStat.isSymbolicLink()) continue;
    const kinds = readNamesBounded(projectDirectory, deadline, budgetState);
    if (!kinds.complete) return { caches, complete: false, reason: kinds.reason };
    for (const kind of kinds.names) {
      if (Date.now() > deadline) return { caches, complete: false, reason: "budget-exhausted" };
      if (!KIND.test(kind)) continue;
      const directory = path.join(projectDirectory, kind);
      try {
        managedTemp.assertNoLinks(directory);
        const marker = safeJson(path.join(directory, CACHE_MARKER));
        if (!marker || !readCache(directory, marker.projectRoot, marker.projectHash, kind)) continue;
        if (projectFilter && marker.projectRoot !== projectFilter) continue;
        caches.push({ directory, projectRoot: marker.projectRoot, projectHash: marker.projectHash, kind, marker });
      } catch { /* linked or unknown paths are outside the prune set */ }
    }
  }
  return { caches, complete: true, reason: null };
}
function pruneUnderGate(limits, projectFilter = null) {
  const started = Date.now();
  const deadline = started + limits.budgetMs;
  const report = emptyReport(started);
  const base = cacheBase();
  if (!fs.existsSync(base)) return report;
  let caches;
  let enumeration;
  try {
    managedTemp.assertNoLinks(base);
    enumeration = enumerateOwned(base, projectFilter, deadline);
    caches = enumeration.caches;
  }
  catch (error) { report.complete = false; report.reason = "unsafe-cache-root"; report.retained.push({ path: base, reason: error.message }); return report; }
  if (!enumeration.complete) {
    report.complete = false; report.reason = enumeration.reason;
    report.retained.push({ path: base, reason: enumeration.reason });
    return report;
  }
  const scanned = [];
  for (const cache of caches) {
    let size;
    try { size = inventory(cache.directory, deadline); }
    catch { size = { complete: false, reason: "unreadable-cache" }; }
    const leases = inspectLeases(cache, deadline);
    const item = { ...cache, size, leases, lastUsed: Date.parse(cache.marker.lastUsedAt) };
    scanned.push(item);
    if (size.complete) report.bytesObserved += size.bytes;
    else { report.complete = false; report.reason = size.reason; }
    if (leases.uncertain) { report.complete = false; report.reason ||= leases.reason; }
  }
  const now = Date.now();
  const eligible = scanned.filter(item => item.size.complete && !item.leases.active && !item.leases.uncertain)
    .sort((a, b) => a.lastUsed - b.lastUsed || a.directory.localeCompare(b.directory));
  const remove = new Set(eligible.filter(item => now - item.lastUsed >= limits.maxAgeMs));
  let total = scanned.reduce((sum, item) => sum + (item.size.complete ? item.size.bytes : 0), 0);
  for (const item of eligible) {
    if (total <= limits.maxBytes) break;
    remove.add(item);
    total -= item.size.bytes;
  }
  for (const item of scanned) {
    if (!remove.has(item)) {
      const reason = item.leases.active ? "active-lease" : item.leases.uncertain ? item.leases.reason : !item.size.complete ? item.size.reason : now - item.lastUsed < limits.maxAgeMs ? "within-retention-age" : "budget-retained";
      report.retained.push({ path: item.directory, bytes: item.size.complete ? item.size.bytes : null, reason });
      if (item.size.complete) report.bytesRetained += item.size.bytes;
      continue;
    }
    try {
      const current = readCache(item.directory, item.projectRoot, item.projectHash, item.kind);
      if (!current) throw new Error("cache-owner-changed");
      const leaseState = inspectLeases(item, deadline);
      if (leaseState.active || leaseState.uncertain) {
        report.retained.push({ path: item.directory, bytes: item.size.bytes, reason: leaseState.reason || "cache-became-active" });
        report.bytesRetained += item.size.bytes;
        continue;
      }
      removeStaleLeases(item, deadline);
      const result = removeCache(item.directory, deadline);
      report.bytesFreed += result.bytesFreed;
      report.filesFreed += result.filesFreed;
      if (result.removed) report.removed.push({ path: item.directory, bytesFreed: result.bytesFreed, filesFreed: result.filesFreed, reason: now - item.lastUsed >= limits.maxAgeMs ? "expired" : "byte-budget" });
      else {
        report.complete = false; report.reason = result.reason;
        report.retained.push({ path: item.directory, bytes: null, reason: result.reason });
      }
    } catch (error) {
      report.complete = false; report.reason = error.message;
      report.retained.push({ path: item.directory, bytes: null, reason: error.message });
    }
  }
  const observedRemainingBytes = report.bytesObserved - report.bytesFreed;
  report.overBudget = observedRemainingBytes > limits.maxBytes;
  report.activeOverBudget = report.overBudget && scanned.some(item => item.leases.active);
  if (report.overBudget && !report.reason) report.reason = report.activeOverBudget ? "live-caches-exceed-budget" : "cache-prune-incomplete";
  report.elapsedMs = Date.now() - started;
  return report;
}
function pruneCaches(options = {}) {
  const limits = validateLimits(options);
  const projectFilter = options.projectRoot === undefined ? null : projectRoot(options.projectRoot);
  const started = Date.now();
  const base = cacheBase();
  ensureDirectory(base);
  const lock = acquireGate(base);
  if (lock.busy) {
    const report = emptyReport(started);
    report.complete = false; report.reason = lock.reason;
    return report;
  }
  try { return pruneUnderGate(limits, projectFilter); }
  finally { try { releaseGate(lock); } catch { /* fail closed: the claim remains visible */ } }
}

function acquireCache(root, kind, options = {}) {
  const cache = cacheDirectory(root, kind);
  if (typeof options.runRoot !== "string" || !options.runRoot) throw new TypeError("runRoot must identify an owned managed-temp run");
  const run = managedTemp.inspectRunLease(options.runRoot);
  if (!run.valid) throw new Error(`Cannot bind cache lease to run: ${run.reason}`);
  if (run.owner.root !== cache.project) throw new Error("Cache and managed run must belong to the same canonical project");
  const limits = validateLimits(options);
  const base = cacheBase();
  ensureDirectory(base);
  const lock = acquireGate(base);
  if (lock.busy) throw new Error(`Managed cache operation is unavailable: ${lock.reason}`);
  let leaseFile, token;
  try {
    pruneUnderGate(limits, cache.project);
    const parent = path.dirname(cache.directory);
    ensureDirectory(parent);
    let createdDirectory = false;
    try { fs.mkdirSync(cache.directory, { mode: 0o700 }); createdDirectory = true; }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    managedTemp.assertNoLinks(cache.directory);
    const cacheStat = fs.lstatSync(cache.directory);
    if (!cacheStat.isDirectory() || cacheStat.isSymbolicLink()) throw new Error("Refusing non-directory managed cache path");
    const markerPath = path.join(cache.directory, CACHE_MARKER);
    let marker = readCache(cache.directory, cache.project, cache.hash, kind.toLowerCase());
    if (!marker) {
      if (!createdDirectory || fs.existsSync(markerPath) || fs.readdirSync(cache.directory).length) throw new Error("Refusing pre-existing unmanaged cache directory");
      const now = new Date().toISOString();
      marker = { version: 1, projectRoot: cache.project, projectHash: cache.hash, kind: kind.toLowerCase(), createdAt: now, lastUsedAt: now };
      const fd = fs.openSync(markerPath, "wx", 0o600);
      try { fs.writeFileSync(fd, `${JSON.stringify(marker)}\n`, "utf8"); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
    }
    marker.lastUsedAt = new Date().toISOString();
    writeJsonAtomic(markerPath, marker);
    const leaseDir = leaseDirectory({ directory: cache.directory, kind: kind.toLowerCase() });
    ensureDirectory(leaseDir);
    token = crypto.randomUUID();
    leaseFile = path.join(leaseDir, `${token}.json`);
    const lease = { version: 1, token, pid: process.pid, supervisorPid: null, projectRoot: cache.project, projectHash: cache.hash, kind: kind.toLowerCase(), cachePath: cache.directory, runRoot: path.resolve(options.runRoot), createdAt: new Date().toISOString() };
    const fd = fs.openSync(leaseFile, "wx", 0o600);
    try { fs.writeFileSync(fd, `${JSON.stringify(lease)}\n`, "utf8"); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
  } finally { releaseGate(lock); }

  let released = false;
  return {
    path: cache.directory,
    bindSupervisor(hostPid) {
      if (released) throw new Error("Cannot bind a released cache lease");
      if (!Number.isInteger(hostPid) || hostPid < 1 || !isAlive(hostPid)) throw new TypeError("supervisor PID must identify a live process");
      const bindLock = acquireGate(base);
      if (bindLock.busy) throw new Error(`Managed cache operation is unavailable: ${bindLock.reason}`);
      try {
        const current = readLease(leaseFile, { directory: cache.directory, projectRoot: cache.project, projectHash: cache.hash, kind: kind.toLowerCase() });
        if (!current || current.token !== token || current.pid !== process.pid) throw new Error("cache lease owner mismatch");
        if (current.supervisorPid !== null && current.supervisorPid !== hostPid) throw new Error("cache lease is already bound to another supervisor");
        current.supervisorPid = hostPid;
        current.supervisorBoundAt = new Date().toISOString();
        writeJsonAtomic(leaseFile, current);
        return { bound: true, supervisorPid: hostPid };
      } finally { releaseGate(bindLock); }
    },
    release() {
      if (released) return { released: true, alreadyReleased: true };
      const releaseLock = acquireGate(base);
      if (releaseLock.busy) return { released: false, reason: releaseLock.reason };
      try {
        const lease = readLease(leaseFile, { directory: cache.directory, projectRoot: cache.project, projectHash: cache.hash, kind: kind.toLowerCase() });
        if (!lease || lease.token !== token || lease.pid !== process.pid) return { released: false, reason: "lease-owner-mismatch" };
        managedTemp.assertNoLinks(path.dirname(leaseFile));
        managedTemp.assertNoLinks(leaseFile);
        fs.unlinkSync(leaseFile);
        released = true;
        return { released: true };
      } finally { releaseGate(releaseLock); }
    },
  };
}

function status() {
  const base = cacheBase();
  if (!fs.existsSync(base)) return [];
  managedTemp.assertNoLinks(base);
  return enumerateOwned(base, null, Date.now() + DEFAULT_BUDGET_MS).caches.map(cache => {
    const size = inventory(cache.directory, Date.now() + DEFAULT_BUDGET_MS);
    const leases = inspectLeases(cache);
    return { path: cache.directory, projectRoot: cache.projectRoot, kind: cache.kind, bytes: size.complete ? size.bytes : null, active: leases.active, uncertain: leases.uncertain, reason: leases.reason || size.reason || null, lastUsedAt: cache.marker.lastUsedAt };
  });
}

module.exports = { CACHE_MARKER, DEFAULT_MAX_BYTES, DEFAULT_MAX_AGE_MS, DEFAULT_BUDGET_MS, cacheBase, cachePath, acquireCache, pruneCaches, status };
