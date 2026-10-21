"use strict";

// Owned, disposable per-run workspaces for commands that need isolated temp files.
// Deletion is intentionally iterative and budgeted; unknown content is preserved.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const OWNER_FILE = ".managed-temp-owner.json";
const CLAIM_SUFFIX = ".cleanup-claim";
const DEPENDENTS_DIR = "dependents";
const DEPENDENT_SUFFIX = ".json";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_BUDGET_MS = 1500;

function assertNoLinks(target, { allowMissing = false } = {}) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (allowMissing && error.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink or junction in managed-temp path: ${current}`);
  }
  return absolute;
}

function projectRoot(root) {
  const absolute = assertNoLinks(root);
  if (!fs.statSync(absolute).isDirectory()) throw new Error("Project root must be a directory");
  return fs.realpathSync.native(absolute);
}
function projectHash(project) { return crypto.createHash("sha256").update(project, "utf8").digest("hex"); }
function managedBaseFor(project) {
  return path.join(os.homedir(), ".cache", "apt-t", projectHash(project).slice(0, 32));
}
function managedBase(root) { return managedBaseFor(projectRoot(root)); }
function ensureDirectory(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink or junction in managed-temp path: ${current}`);
      if (!stat.isDirectory()) throw new Error(`Managed-temp path component is not a directory: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      fs.mkdirSync(current, { mode: 0o700 });
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Managed-temp directory creation was redirected: ${current}`);
    }
  }
}
function managedRoot(root, create = false) {
  const project = projectRoot(root);
  const hash = projectHash(project);
  const base = managedBaseFor(project);
  assertNoLinks(base, { allowMissing: true });
  if (create && !fs.existsSync(base)) ensureDirectory(base);
  if (fs.existsSync(base)) {
    if (!fs.statSync(base).isDirectory()) throw new Error("Managed-temp root is not a directory");
    if (fs.realpathSync.native(base) !== base) throw new Error("Managed-temp root resolves outside its canonical path");
  }
  return { project, projectHash: hash, base };
}
function readOwner(directory, expectedRoot, expectedHash = projectHash(expectedRoot)) {
  try {
    assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    const ownerPath = path.join(directory, OWNER_FILE);
    assertNoLinks(ownerPath);
    const ownerStat = fs.lstatSync(ownerPath);
    if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) return null;
    const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
    if (owner.version !== 1 || !UUID.test(owner.id) || path.basename(directory) !== owner.id || owner.root !== expectedRoot || owner.projectHash !== expectedHash ||
      !(Number.isInteger(owner.pid) && owner.pid > 0 || owner.pid === null && typeof owner.finishedAt === "string")) return null;
    if (owner.childPid !== null && owner.childPid !== undefined && (!Number.isInteger(owner.childPid) || owner.childPid < 1)) return null;
    if (owner.launching !== undefined && typeof owner.launching !== "boolean") return null;
    if (owner.childGroup !== undefined && typeof owner.childGroup !== "boolean") return null;
    if (owner.retainedReason !== undefined && owner.retainedReason !== null && typeof owner.retainedReason !== "string") return null;
    if (owner.resources !== undefined && (!Array.isArray(owner.resources) || owner.resources.some(resource => !resource || typeof resource.kind !== "string" || typeof resource.path !== "string" || path.isAbsolute(resource.path) || resource.path.split(/[\\/]+/u).includes("..")))) return null;
    owner.launching = owner.launching === true;
    owner.childGroup = owner.childGroup === true;
    owner.retainedReason = owner.retainedReason || null;
    return owner;
  } catch { return null; }
}
function isAlive(pid, group = false) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(group && process.platform !== "win32" ? -pid : pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}
function leaseActive(owner, ignoredPid = null) {
  return owner.launching || owner.pid !== ignoredPid && isAlive(owner.pid) || isAlive(owner.childPid, owner.childGroup === true);
}
function writeOwner(directory, owner) {
  const target = path.join(directory, OWNER_FILE);
  assertNoLinks(target, { allowMissing: true });
  const temp = `${target}.${process.pid}.tmp`;
  const fd = fs.openSync(temp, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(owner) + "\n", "utf8"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  assertNoLinks(directory);
  assertNoLinks(target, { allowMissing: true });
  fs.renameSync(temp, target);
}

function containedPath(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function dependentFile(parentDirectory, childId) {
  return path.join(parentDirectory, DEPENDENTS_DIR, `${childId}${DEPENDENT_SUFFIX}`);
}
function registerDependent(project, childId) {
  const inherited = process.env.AGENT_MANAGED_TEMP;
  if (!inherited) return null;
  const parentRunRoot = path.resolve(inherited);
  const parent = inspectRunLease(parentRunRoot);
  if (!parent.valid || !parent.active || !parent.owner) throw new Error("Inherited managed parent run is not a validated live lease");
  const canonicalParent = path.resolve(parentRunRoot);
  if (canonicalParent !== path.resolve(managedBaseFor(parent.owner.root), parent.owner.id) || !containedPath(canonicalParent, project)) return null;
  const directory = path.join(canonicalParent, DEPENDENTS_DIR);
  ensureDirectory(directory);
  const token = crypto.randomUUID();
  const record = {
    version: 1,
    token,
    parent: { id: parent.owner.id, root: parent.owner.root, projectHash: parent.owner.projectHash },
    child: { id: childId, root: project, projectHash: projectHash(project), runRoot: path.join(managedBaseFor(project), childId) },
    createdAt: new Date().toISOString(),
  };
  const file = dependentFile(canonicalParent, childId);
  const staging = path.join(canonicalParent, `.dependent-${childId}.tmp`);
  assertNoLinks(directory);
  assertNoLinks(staging, { allowMissing: true });
  try {
    const fd = fs.openSync(staging, "wx", 0o600);
    try { fs.writeFileSync(fd, `${JSON.stringify(record)}\n`, "utf8"); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    assertNoLinks(file, { allowMissing: true });
    fs.renameSync(staging, file);
  } finally { if (fs.existsSync(staging)) { assertNoLinks(staging); fs.unlinkSync(staging); } }
  return { file, token, parentRunRoot: canonicalParent, childId };
}
function readDependent(file, parentDirectory, parentOwner, childId) {
  try {
    assertNoLinks(path.dirname(file)); assertNoLinks(file);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > 16384) return null;
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const child = record.child, parent = record.parent;
    if (record.version !== 1 || !UUID.test(record.token) || !Number.isFinite(Date.parse(record.createdAt)) ||
      !parent || parent.id !== parentOwner.id || parent.root !== parentOwner.root || parent.projectHash !== parentOwner.projectHash ||
      !child || child.id !== childId || !UUID.test(child.id) || typeof child.root !== "string" || path.resolve(child.root) !== child.root ||
      child.projectHash !== projectHash(child.root) || child.runRoot !== path.join(managedBaseFor(child.root), child.id) ||
      path.basename(file) !== `${child.id}${DEPENDENT_SUFFIX}` || !containedPath(parentDirectory, child.root)) return null;
    return record;
  } catch { return null; }
}
function removeEmptyDirectory(directory, deadline) {
  try {
    assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    if (Date.now() >= deadline) return false;
    const dir = fs.opendirSync(directory);
    let empty;
    try { empty = dir.readSync() === null; }
    finally { dir.closeSync(); }
    if (!empty || Date.now() >= deadline) return false;
    assertNoLinks(directory);
    fs.rmdirSync(directory);
    return true;
  } catch (error) { return error.code === "ENOENT"; }
}
function cleanReportNamespace(record, deadline) {
  const reportBase = path.join(os.homedir(), ".cache", "apt-r");
  const directory = path.join(reportBase, record.child.projectHash.slice(0, 32));
  try {
    assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    if (Date.now() >= deadline) return false;
    const dir = fs.opendirSync(directory);
    let first, second;
    try { first = dir.readSync(); second = first && dir.readSync(); }
    finally { dir.closeSync(); }
    if (!first) return removeEmptyDirectory(directory, deadline);
    if (first.name !== "last.json" || second) return false;
    const reportPath = path.join(directory, "last.json");
    assertNoLinks(reportPath);
    const reportStat = fs.lstatSync(reportPath);
    if (!reportStat.isFile() || reportStat.size > 65536) return false;
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    if (!report || report.schemaVersion !== 1 || report.projectRoot !== record.child.root) return false;
    if (Date.now() >= deadline) return false;
    assertNoLinks(reportPath);
    fs.unlinkSync(reportPath);
    assertNoLinks(directory);
    fs.rmdirSync(directory);
    return true;
  } catch (error) { return error.code === "ENOENT"; }
}
function dependencyNamespacesEmpty(record, deadline, cacheModule = null) {
  const tempNamespace = managedBaseFor(record.child.root);
  if (!removeEmptyDirectory(tempNamespace, deadline)) return false;
  const caches = cacheModule || require("./managed-cache.js");
  const cacheNamespace = path.join(caches.cacheBase(), record.child.projectHash.slice(0, 32));
  const leases = path.join(cacheNamespace, ".leases");
  if (fs.existsSync(leases) && !removeEmptyDirectory(leases, deadline)) return false;
  if (!removeEmptyDirectory(cacheNamespace, deadline)) return false;
  return cleanReportNamespace(record, deadline);
}
function settleDependent(file, parentDirectory, parentOwner, childId, deadline, maxEntries) {
  const record = readDependent(file, parentDirectory, parentOwner, childId);
  if (!record) return { settled: false, reason: "invalid-dependent-binding" };
  const remaining = Math.max(0, deadline - Date.now());
  if (remaining <= 0) return { settled: false, reason: "budget-exhausted" };
  let childExists = false;
  try {
    assertNoLinks(record.child.root);
    const childStat = fs.lstatSync(record.child.root);
    if (!childStat.isDirectory() || childStat.isSymbolicLink() || fs.realpathSync.native(record.child.root) !== record.child.root) return { settled: false, reason: "invalid-dependent-project-root" };
    childExists = true;
  } catch (error) {
    if (error.code !== "ENOENT") return { settled: false, reason: "unsafe-dependent-project-root" };
  }
  if (childExists) {
    if (!containedPath(parentDirectory, record.child.root)) return { settled: false, reason: "dependent-project-outside-parent" };
    const childReport = sweep(record.child.root, { budgetMs: remaining, maxEntries, onlyId: childId });
    if (childReport.errors.length || childReport.pending.some(item => item.path === childId) || Date.now() >= deadline) {
      const reason = childReport.pending.find(item => item.path === childId)?.reason || childReport.errors[0]?.error || "budget-exhausted";
      return { settled: false, reason: `child-run-${reason}` };
    }
    const lease = inspectRunLease(record.child.runRoot);
    if (lease.valid && (lease.active || lease.pending) || fs.existsSync(record.child.runRoot)) return { settled: false, reason: lease.reason || "child-run-remains" };
    const caches = require("./managed-cache.js");
    const cacheReport = caches.pruneCaches({ projectRoot: record.child.root, maxBytes: 0, maxAgeMs: 0, budgetMs: Math.max(0, deadline - Date.now()) });
    if (!cacheReport.complete || cacheReport.overBudget || cacheReport.retained.length) return { settled: false, reason: cacheReport.reason || cacheReport.retained[0]?.reason || "child-cache-remains" };
  }
  if (!dependencyNamespacesEmpty(record, deadline)) return { settled: false, reason: "child-owned-namespace-not-empty" };
  const current = readDependent(file, parentDirectory, parentOwner, childId);
  if (!current || current.token !== record.token) return { settled: false, reason: "dependent-binding-changed" };
  assertNoLinks(file);
  fs.unlinkSync(file);
  return { settled: true, reason: null };
}
function settleDependents(parentDirectory, parentOwner, deadline, maxEntries) {
  const directory = path.join(parentDirectory, DEPENDENTS_DIR);
  try {
    assertNoLinks(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return { settled: false, reason: "invalid-dependent-directory" };
  } catch (error) {
    return error.code === "ENOENT" ? { settled: true, reason: null } : { settled: false, reason: "unsafe-dependent-directory" };
  }
  let dir;
  try { dir = fs.opendirSync(directory); }
  catch { return { settled: false, reason: "unreadable-dependent-directory" }; }
  const files = [];
  try {
    for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
      if (Date.now() >= deadline || files.length >= maxEntries) return { settled: false, reason: "budget-exhausted" };
      if (!UUID.test(entry.name.replace(/\.json$/iu, "")) || !entry.name.endsWith(DEPENDENT_SUFFIX)) return { settled: false, reason: "unknown-dependent-entry" };
      files.push(entry.name);
    }
  } catch { return { settled: false, reason: "unreadable-dependent-directory" }; }
  finally { dir.closeSync(); }
  for (const name of files) {
    if (Date.now() >= deadline) return { settled: false, reason: "budget-exhausted" };
    const childId = name.slice(0, -DEPENDENT_SUFFIX.length);
    const result = settleDependent(path.join(directory, name), parentDirectory, parentOwner, childId, deadline, maxEntries);
    if (!result.settled) return result;
  }
  return { settled: true, reason: null };
}

function emptyAccounting(reason = null) {
  return {
    observedBytesRemoved: 0,
    observedFilesRemoved: 0,
    observedBytesRemaining: null,
    observedFilesRemaining: null,
    remainingComplete: false,
    reason,
  };
}

function inventoryBounded(directory, deadline, maxEntries) {
  assertNoLinks(directory);
  const stack = [path.resolve(directory)];
  let entries = 0;
  let bytes = 0;
  let files = 0;
  while (stack.length) {
    if (Date.now() > deadline || entries >= maxEntries) return { complete: false, bytes: null, files: null, reason: "budget-exhausted" };
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return { complete: false, bytes: null, files: null, reason: "linked-entry" };
    if (stat.isFile()) { bytes += stat.size; files += 1; entries += 1; continue; }
    if (!stat.isDirectory()) { entries += 1; continue; }
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

function observeTree(root, options = {}) {
  const budgetMs = Number.isFinite(options.budgetMs) ? Math.max(0, options.budgetMs) : DEFAULT_BUDGET_MS;
  const maxEntries = Number.isInteger(options.maxEntries) ? Math.max(0, options.maxEntries) : 100000;
  const deadline = Date.now() + budgetMs;
  const start = path.resolve(root);
  let bytes = 0, files = 0, entries = 0;
  try {
    assertNoLinks(start);
    const stat = fs.lstatSync(start);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return { bytes, files, complete: false, reason: "not-a-real-directory" };
    const stack = [start];
    while (stack.length) {
      if (Date.now() > deadline || entries >= maxEntries) return { bytes, files, complete: false, reason: "budget-exhausted" };
      const current = stack.pop();
      const currentStat = fs.lstatSync(current);
      if (currentStat.isSymbolicLink()) return { bytes, files, complete: false, reason: "linked-entry" };
      if (currentStat.isFile()) { bytes += currentStat.size; files += 1; entries += 1; continue; }
      if (!currentStat.isDirectory()) return { bytes, files, complete: false, reason: "unsupported-entry" };
      const dir = fs.opendirSync(current);
      try {
        for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
          if (Date.now() > deadline || entries >= maxEntries) return { bytes, files, complete: false, reason: "budget-exhausted" };
          entries += 1;
          stack.push(path.join(current, entry.name));
        }
      } finally { dir.closeSync(); }
    }
    return { bytes, files, complete: true, reason: null };
  } catch (error) {
    return { bytes, files, complete: false, reason: error.code === "ENOENT" ? "tree-changed-during-observation" : "unsafe-or-unreadable-entry" };
  }
}

function claimPath(base, id) { return path.join(base, `${id}${CLAIM_SUFFIX}`); }
function readClaim(file, expectedRoot, expectedHash, id) {
  try {
    assertNoLinks(file);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const claim = JSON.parse(fs.readFileSync(file, "utf8"));
    if (claim.version !== 1 || claim.id !== id || claim.root !== expectedRoot || claim.projectHash !== expectedHash || !Number.isInteger(claim.pid) || claim.pid < 1 || typeof claim.token !== "string") return null;
    return claim;
  } catch { return null; }
}
function acquireClaim(base, root, projectHash, id) {
  const file = claimPath(base, id);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const claim = { version: 1, id, root, projectHash, pid: process.pid, token: crypto.randomUUID(), createdAt: new Date().toISOString() };
    try {
      assertNoLinks(base);
      const fd = fs.openSync(file, "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(claim) + "\n", "utf8"); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      return { file, claim };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = readClaim(file, root, projectHash, id);
      if (!existing) return { busy: true, reason: "invalid-cleanup-claim" };
      return { busy: true, reason: isAlive(existing.pid) ? "cleanup-claimed" : "stale-cleanup-claim-requires-manual-recovery" };
    }
  }
  return { busy: true, reason: "cleanup-claimed" };
}
function releaseClaim(base, lock) {
  const current = readClaim(lock.file, lock.claim.root, lock.claim.projectHash, lock.claim.id);
  if (!current || current.token !== lock.claim.token) return false;
  assertSafeMutation(base, lock.file);
  fs.unlinkSync(lock.file);
  return true;
}

function assertSafeMutation(base, target) {
  const normalizedBase = path.resolve(base);
  const normalizedTarget = path.resolve(target);
  const relative = path.relative(normalizedBase, normalizedTarget);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    if (normalizedTarget !== normalizedBase) throw new Error(`Refusing path outside managed-temp root: ${target}`);
  }
  // Revalidate every ancestor immediately before each filesystem mutation.
  // Node does not expose dirfd-relative unlink/rmdir, so a hostile concurrent
  // replacement between this check and the syscall remains a platform limit.
  assertNoLinks(normalizedBase);
  assertNoLinks(normalizedTarget);
}

function removeBounded(directory, deadline, maxEntries = 10000, owner = null, base = path.dirname(directory), accounting = emptyAccounting()) {
  const root = path.resolve(directory);
  const ownerPath = path.join(root, OWNER_FILE);
  const stack = [];
  let entries = 0;
  const openDirectory = target => {
    assertNoLinks(target);
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing non-directory or linked path: ${target}`);
    return fs.opendirSync(target);
  };
  stack.push({ target: root, root: true, dir: openDirectory(root) });
  try {
    while (stack.length) {
      if (Date.now() > deadline || entries >= maxEntries) {
        const remaining = inventoryBounded(root, deadline, Math.max(0, maxEntries - entries));
        accounting.observedBytesRemaining = remaining.bytes;
        accounting.observedFilesRemaining = remaining.files;
        accounting.remainingComplete = remaining.complete;
        accounting.reason = remaining.reason || "budget-exhausted";
        return { removed: false, entries, reason: "budget-exhausted", accounting };
      }
      const frame = stack[stack.length - 1];
      const entry = frame.dir.readSync();
      if (entry === null) {
        frame.dir.closeSync();
        stack.pop();
        if (frame.root && owner) {
          // All other entries are gone. Remove ownership last; if the final
          // rmdir fails, leave the empty directory unowned and report it.
          assertSafeMutation(base, ownerPath);
          const markerBytes = fs.lstatSync(ownerPath).size;
          fs.unlinkSync(ownerPath);
          accounting.observedBytesRemoved += markerBytes;
          accounting.observedFilesRemoved += 1;
          assertSafeMutation(base, root);
          fs.rmdirSync(root);
        } else {
          assertSafeMutation(base, frame.target);
          fs.rmdirSync(frame.target);
        }
        entries += 1;
        continue;
      }
      if (frame.root && owner && entry.name === OWNER_FILE) continue;
      const child = path.join(frame.target, entry.name);
      assertNoLinks(child);
      const stat = fs.lstatSync(child);
      if (stat.isSymbolicLink()) throw new Error(`Refusing nested symlink or junction: ${child}`);
      if (stat.isDirectory()) {
        const nestedMarker = path.join(child, OWNER_FILE);
        if (owner && fs.existsSync(nestedMarker)) {
          const nestedOwner = readOwner(child, owner.root);
          if (!nestedOwner) throw new Error(`Refusing nested managed workspace with invalid owner marker: ${child}`);
          if (leaseActive(nestedOwner)) throw new Error(`Refusing nested managed workspace with a live lease: ${child}`);
          throw new Error(`Refusing nested managed workspace that has not completed cleanup: ${child}`);
        }
        stack.push({ target: child, root: false, dir: openDirectory(child) });
      }
      else {
        assertSafeMutation(base, child);
        fs.unlinkSync(child);
        if (stat.isFile()) {
          accounting.observedBytesRemoved += stat.size;
          accounting.observedFilesRemoved += 1;
        }
        entries += 1;
      }
    }
  } finally {
    for (const frame of stack) { try { frame.dir.closeSync(); } catch { /* already closed */ } }
  }
  accounting.observedBytesRemaining = 0;
  accounting.observedFilesRemaining = 0;
  accounting.remainingComplete = true;
  accounting.reason = null;
  return { removed: true, entries, accounting };
}

function createRun(root, options = {}) {
  const { project, base } = managedRoot(root, false);
  const id = crypto.randomUUID();
  const directory = path.join(base, id);
  const dependent = registerDependent(project, id);
  managedRoot(root, true);
  assertNoLinks(base);
  fs.mkdirSync(directory, { mode: 0o700 });
  const owner = { version: 1, id, root: project, projectHash: projectHash(project), pid: process.pid, childPid: null, childGroup: false, launching: false, retainedReason: null, createdAt: new Date().toISOString(), label: typeof options.label === "string" ? options.label.slice(0, 120) : null, resources: [] };
  if (options.processContract === "foreground") owner.retainedReason = "foreground-contract-not-completed";
  writeOwner(directory, owner);
  const temp = path.join(directory, "tmp");
  assertNoLinks(temp, { allowMissing: true });
  owner.resources.push({ kind: "temp", path: "tmp", createdAt: new Date().toISOString() });
  writeOwner(directory, owner);
  fs.mkdirSync(temp, { mode: 0o700 });
  let finished = false;
  return {
    id, root: directory, temp,
    allocate(kind, label) {
      if (finished) throw new Error("Managed run is already finished");
      if (typeof kind !== "string" || !/^[a-z0-9][a-z0-9_-]{0,39}$/iu.test(kind)) throw new TypeError("resource kind must be a short safe identifier");
      const storedLabel = typeof label === "string" ? label.trim().replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 120) : null;
      const shortLabel = storedLabel ? storedLabel.toLowerCase().replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 8) : "";
      const shortKind = kind.toLowerCase().replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 16);
      const name = `${owner.resources.length}-${shortKind}${shortLabel ? `-${shortLabel}` : ""}`;
      const relative = path.join("resources", name);
      const target = path.join(directory, relative);
      assertNoLinks(target, { allowMissing: true });
      owner.resources.push({ kind, path: relative, label: storedLabel || null, createdAt: new Date().toISOString() });
      writeOwner(directory, owner);
      ensureDirectory(path.dirname(target));
      fs.mkdirSync(target, { mode: 0o700 });
      return target;
    },
    setLaunching(value) {
      if (finished) throw new Error("Managed run is already finished");
      if (typeof value !== "boolean") throw new TypeError("launching must be boolean");
      owner.launching = value;
      writeOwner(directory, owner);
    },
    setChildPid(pid, { group = false } = {}) {
      if (finished) throw new Error("Managed run is already finished");
      if (pid !== null && (!Number.isInteger(pid) || pid < 1)) throw new TypeError("child pid must be a positive integer or null");
      owner.childPid = pid;
      owner.childGroup = pid === null ? false : Boolean(group);
      owner.launching = false;
      writeOwner(directory, owner);
    },
    retain(reason) {
      if (finished) throw new Error("Managed run is already finished");
      if (typeof reason !== "string" || !reason.trim()) throw new TypeError("retained reason must be a non-empty string");
      owner.retainedReason = reason.trim().slice(0, 240);
      writeOwner(directory, owner);
      return { retained: true, reason: owner.retainedReason };
    },
    finish({ foregroundCompleted = false } = {}) {
      if (finished) return { removed: true, alreadyFinished: true };
      if (isAlive(owner.childPid, owner.childGroup)) return { removed: false, reason: "live-child", accounting: emptyAccounting("live-child") };
      if (foregroundCompleted && owner.pid === process.pid && owner.retainedReason === "foreground-contract-not-completed") {
        owner.retainedReason = null;
        writeOwner(directory, owner);
      }
      const report = sweep(project, { budgetMs: 10000, maxEntries: 100000, onlyId: id, finishingPid: owner.pid });
      finished = report.removed.includes(id) || !fs.existsSync(directory);
      if (dependent) report.dependent = { settled: false, reason: "awaiting-parent-cleanup" };
      return { removed: finished, report };
    },
  };
}

function sweep(root, options = {}) {
  const started = Date.now();
  const budgetMs = Number.isFinite(options.budgetMs) ? Math.max(0, options.budgetMs) : DEFAULT_BUDGET_MS;
  const deadline = started + budgetMs;
  const report = { removed: [], busy: [], skipped: [], errors: [], pending: [], accounting: { observedBytesRemoved: 0, observedFilesRemoved: 0, observedBytesRemaining: 0, observedFilesRemaining: 0, remainingComplete: true, reason: null }, observations: [], elapsedMs: 0 };
  let roots;
  try { roots = managedRoot(root, false); }
  catch (error) { report.errors.push({ path: String(root), error: error.message }); report.elapsedMs = Date.now() - started; return report; }
  if (!fs.existsSync(roots.base)) { report.elapsedMs = Date.now() - started; return report; }
  let names;
  try { names = fs.readdirSync(roots.base); }
  catch (error) { report.errors.push({ path: roots.base, error: error.message }); report.elapsedMs = Date.now() - started; return report; }
  const observeRemaining = (id, directory, reason) => {
    const inventory = inventoryBounded(directory, deadline, options.maxEntries || 10000);
    report.observations.push({ path: id, observedBytesRemoved: 0, observedFilesRemoved: 0, observedBytesRemaining: inventory.bytes, observedFilesRemaining: inventory.files, remainingComplete: inventory.complete, reason: inventory.reason || reason });
    if (inventory.complete) {
      report.accounting.observedBytesRemaining += inventory.bytes;
      report.accounting.observedFilesRemaining += inventory.files;
    } else {
      report.accounting.remainingComplete = false;
      report.accounting.reason = inventory.reason || reason;
    }
  };
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (Date.now() > deadline) {
      // Classify remaining entries so callers can distinguish stale work from
      // live leases and unowned data; no further deletion is attempted.
      for (const remaining of names.slice(index)) {
        if (remaining.endsWith(CLAIM_SUFFIX)) continue;
        if (!UUID.test(remaining)) { report.skipped.push({ path: remaining, reason: "unknown-name" }); continue; }
        const pendingOwner = readOwner(path.join(roots.base, remaining), roots.project, roots.projectHash);
        if (!pendingOwner) report.skipped.push({ path: remaining, reason: "invalid-owner" });
        else if (pendingOwner.launching && !isAlive(pendingOwner.pid) && !isAlive(pendingOwner.childPid, pendingOwner.childGroup)) {
          report.pending.push({ path: remaining, reason: "unresolved-launch-lease" });
          observeRemaining(remaining, path.join(roots.base, remaining), "unresolved-launch-lease");
        }
        else if (leaseActive(pendingOwner)) {
          report.busy.push({ path: remaining, reason: "live-lease" });
          report.skipped.push({ path: remaining, reason: "live-lease" });
          observeRemaining(remaining, path.join(roots.base, remaining), "live-lease");
        }
        else {
          report.pending.push({ path: remaining, reason: "budget-exhausted" });
          observeRemaining(remaining, path.join(roots.base, remaining), "budget-exhausted");
        }
      }
      break;
    }
    if (name.endsWith(CLAIM_SUFFIX)) {
      const id = name.slice(0, -CLAIM_SUFFIX.length);
      if (!UUID.test(id)) { report.skipped.push({ path: name, reason: "unknown-name" }); continue; }
      const claim = readClaim(path.join(roots.base, name), roots.project, roots.projectHash, id);
      if (claim && isAlive(claim.pid)) {
        report.busy.push({ path: id, reason: "cleanup-claimed" });
        report.skipped.push({ path: id, reason: "cleanup-claimed" });
      } else if (claim && !fs.existsSync(path.join(roots.base, id))) {
        try { assertSafeMutation(roots.base, path.join(roots.base, name)); fs.unlinkSync(path.join(roots.base, name)); }
        catch (error) { report.errors.push({ path: name, error: error.message }); }
      } else if (claim) {
        report.pending.push({ path: id, reason: "stale-cleanup-claim-requires-manual-recovery" });
      } else {
        report.pending.push({ path: id, reason: "invalid-cleanup-claim" });
      }
      continue;
    }
    if (options.onlyId && name !== options.onlyId) continue;
    const directory = path.join(roots.base, name);
    if (!UUID.test(name)) { report.skipped.push({ path: name, reason: "unknown-name" }); continue; }
    const owner = readOwner(directory, roots.project, roots.projectHash);
    if (!owner) { report.skipped.push({ path: name, reason: "invalid-owner" }); continue; }
    if (owner.retainedReason) {
      report.pending.push({ path: name, reason: owner.retainedReason });
      observeRemaining(name, directory, owner.retainedReason);
      continue;
    }
    if (owner.launching && !isAlive(owner.pid) && !isAlive(owner.childPid, owner.childGroup)) {
      report.pending.push({ path: name, reason: "unresolved-launch-lease" });
      observeRemaining(name, directory, "unresolved-launch-lease");
      continue;
    }
    if (leaseActive(owner, options.onlyId === name ? options.finishingPid : null)) {
      report.busy.push({ path: name, reason: "live-lease" });
      report.skipped.push({ path: name, reason: "live-lease" });
      observeRemaining(name, directory, "live-lease");
      continue;
    }
    const lock = acquireClaim(roots.base, roots.project, roots.projectHash, name);
    if (lock.busy) {
      if (lock.reason.includes("stale") || lock.reason.includes("invalid")) report.pending.push({ path: name, reason: lock.reason });
      else {
        report.busy.push({ path: name, reason: lock.reason });
        report.skipped.push({ path: name, reason: lock.reason });
      }
      continue;
    }
    const measured = emptyAccounting();
    try {
      assertNoLinks(directory);
      const dependencies = settleDependents(directory, owner, deadline, options.maxEntries || 10000);
      if (!dependencies.settled) {
        report.pending.push({ path: name, reason: `dependent-resource-${dependencies.reason}` });
        observeRemaining(name, directory, `dependent-resource-${dependencies.reason}`);
        continue;
      }
      const result = removeBounded(directory, deadline, options.maxEntries || 10000, owner, roots.base, measured);
      report.observations.push({ path: name, ...measured });
      report.accounting.observedBytesRemoved += measured.observedBytesRemoved;
      report.accounting.observedFilesRemoved += measured.observedFilesRemoved;
      if (measured.remainingComplete && measured.observedBytesRemaining !== null) report.accounting.observedBytesRemaining += measured.observedBytesRemaining;
      else { report.accounting.remainingComplete = false; report.accounting.reason = measured.reason || result.reason || "incomplete-observation"; }
      if (measured.observedFilesRemaining !== null && measured.remainingComplete) report.accounting.observedFilesRemaining += measured.observedFilesRemaining;
      if (result.removed) report.removed.push(name);
      else report.pending.push({ path: name, reason: result.reason });
    } catch (error) {
      const observed = emptyAccounting(error.message.includes("symlink") || error.message.includes("linked") ? "linked-entry" : "observation-or-cleanup-error");
      observed.observedBytesRemoved = measured.observedBytesRemoved;
      observed.observedFilesRemoved = measured.observedFilesRemoved;
      const remaining = inventoryBounded(directory, deadline, options.maxEntries || 10000);
      observed.observedBytesRemaining = remaining.bytes;
      observed.observedFilesRemaining = remaining.files;
      observed.remainingComplete = remaining.complete;
      observed.reason = remaining.reason || observed.reason;
      report.observations.push({ path: name, ...observed });
      report.accounting.observedBytesRemoved += observed.observedBytesRemoved;
      report.accounting.observedFilesRemoved += observed.observedFilesRemoved;
      if (remaining.complete) {
        report.accounting.observedBytesRemaining += remaining.bytes;
        report.accounting.observedFilesRemaining += remaining.files;
      }
      report.accounting.remainingComplete = false;
      report.accounting.reason = observed.reason;
      report.errors.push({ path: name, error: error.message });
    }
    finally { try { releaseClaim(roots.base, lock); } catch (error) { report.errors.push({ path: name, error: error.message }); } }
  }
  if (!report.accounting.remainingComplete) {
    report.accounting.observedBytesRemaining = null;
    report.accounting.observedFilesRemaining = null;
  }
  report.elapsedMs = Date.now() - started;
  return report;
}

function status(root) {
  const { project, projectHash: hash, base } = managedRoot(root, false);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).map(name => {
    if (name.endsWith(CLAIM_SUFFIX)) {
      const id = name.slice(0, -CLAIM_SUFFIX.length);
      const claim = UUID.test(id) ? readClaim(path.join(base, name), project, hash, id) : null;
      return claim ? { id, pid: claim.pid, active: isAlive(claim.pid), state: isAlive(claim.pid) ? "cleanup-claimed" : "stale-cleanup-claim" } : { name, active: null, state: "invalid-cleanup-claim" };
    }
    const owner = UUID.test(name) ? readOwner(path.join(base, name), project, hash) : null;
    return owner ? { id: owner.id, pid: owner.pid, childPid: owner.childPid ?? null, childGroup: owner.childGroup, launching: owner.launching, retainedReason: owner.retainedReason, active: leaseActive(owner), createdAt: owner.createdAt, label: owner.label || null } : { name, active: null, state: "unknown-or-invalid" };
  });
}

function inspectRunLease(runRoot) {
  try {
    const directory = assertNoLinks(runRoot);
    const marker = path.join(directory, OWNER_FILE);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return { valid: false, active: null, reason: "invalid-run-root" };
    const owner = JSON.parse(fs.readFileSync(marker, "utf8"));
    const canonicalProject = projectRoot(owner.root);
    if (canonicalProject !== owner.root || !readOwner(directory, owner.root, projectHash(owner.root)) || path.resolve(directory) !== path.resolve(managedBaseFor(owner.root), owner.id)) {
      return { valid: false, active: null, reason: "invalid-run-owner" };
    }
    if (owner.retainedReason) return { valid: true, active: null, pending: true, reason: owner.retainedReason };
    if (owner.launching && !isAlive(owner.pid) && !isAlive(owner.childPid, owner.childGroup)) return { valid: true, active: null, pending: true, reason: "unresolved-launch-lease" };
    const active = leaseActive(owner);
    return { valid: true, active, pending: false, reason: active ? "live-run-lease" : "stale-run-lease", owner: { id: owner.id, root: owner.root, projectHash: owner.projectHash, pid: owner.pid, childPid: owner.childPid ?? null, childGroup: owner.childGroup === true, launching: owner.launching === true, retainedReason: owner.retainedReason || null } };
  } catch { return { valid: false, active: null, reason: "missing-or-invalid-run-owner" }; }
}

module.exports = { OWNER_FILE, DEFAULT_BUDGET_MS, createRun, managedBase, sweep, status, assertNoLinks, removeBounded, inspectRunLease, observeTree };
