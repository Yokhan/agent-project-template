"use strict";

// Metadata-only coordination for explicitly declared storage operations.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const managed = require("./managed-temp.js");
const volumeRegistry = require("./storage-volume-registry.js");

const MAX_ROWS = 2000;
const MAX_FILES = 20000;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_DB_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 2048;
const DIGEST = /^[a-f0-9]{64}$/u;
function projectRoot(root) {
  const absolute = managed.assertNoLinks(root);
  if (!fs.statSync(absolute).isDirectory()) throw new Error("Project root must be a directory");
  return fs.realpathSync.native(absolute);
}
const registryPath = root => path.join(projectRoot(root), ".session-cache", "storage-operations", "registry.sqlite");
const registryDirectory = root => path.dirname(registryPath(root));
const textValue = (value, name, max = MAX_TEXT) => {
  if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0")) throw new Error(`${name} must be a non-empty string of at most ${max} characters`);
  return value;
};
function safePath(value, { mustExist = false } = {}) {
  return canonicalPath(value, { mustExist }).path;
}
function canonicalPath(value, { mustExist = false } = {}) {
  textValue(value, "path");
  const absolute = path.resolve(value);
  managed.assertNoLinks(absolute, { allowMissing: !mustExist });
  let canonical;
  if (mustExist) {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error("Links are not allowed");
    canonical = fs.realpathSync.native(absolute);
  } else {
    let existing = absolute;
    const suffix = [];
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) throw new Error("Cannot resolve target path parent");
      suffix.unshift(path.basename(existing));
      existing = parent;
    }
    const stat = fs.lstatSync(existing);
    if (stat.isSymbolicLink()) throw new Error("Links are not allowed");
    if (suffix.length && !stat.isDirectory()) throw new Error("Target parent is not a directory");
    canonical = path.resolve(fs.realpathSync.native(existing), ...suffix);
  }
  return { path: canonical, key: process.platform === "win32" ? canonical.toLocaleLowerCase("en-US") : canonical };
}
function pathOverlaps(left, right) {
  const within = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  return within(left, right) || within(right, left);
}
function isDescendant(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function ensureRegistryDirectory(file) {
  const directory = path.dirname(file);
  managed.assertNoLinks(directory, { allowMissing: true });
  fs.mkdirSync(directory, { recursive: true });
  managed.assertNoLinks(directory);
}
function openRegistry(root) {
  const { DatabaseSync } = require("node:sqlite");
  const file = registryPath(root);
  ensureRegistryDirectory(file);
  managed.assertNoLinks(file, { allowMissing: true });
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw new Error("Storage registry must be a regular file");
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version === 0) {
      const existingTables = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count;
      if (existingTables) throw new Error("Storage registry has unversioned tables; refusing to reinterpret its schema");
      db.exec(`CREATE TABLE operations (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, source_key TEXT NOT NULL, digest TEXT NOT NULL, purpose TEXT NOT NULL,
    target TEXT NOT NULL, target_key TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('writing','ready','abandoned')),
    session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL, generation INTEGER NOT NULL,
    manifest TEXT, reserved_bytes INTEGER NOT NULL DEFAULT 0, grant_unissued INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(source_key,digest,purpose), UNIQUE(target_key));
    CREATE TABLE protections (
      id TEXT PRIMARY KEY, path TEXT NOT NULL, reason TEXT NOT NULL,
      session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX protections_owner_path ON protections(path,session,request);
    CREATE TABLE pins (
      id TEXT PRIMARY KEY, resource_id TEXT, path TEXT NOT NULL,
      session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(resource_id) REFERENCES operations(id));
    CREATE TABLE registry_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
    CREATE TABLE pending_claims (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, source_key TEXT NOT NULL, digest TEXT NOT NULL, purpose TEXT NOT NULL,
      target TEXT NOT NULL, target_key TEXT NOT NULL, session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL,
      generation INTEGER NOT NULL, reserved_bytes INTEGER NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(source_key,digest,purpose), UNIQUE(target_key));
    CREATE TRIGGER pending_claims_insert_revision AFTER INSERT ON pending_claims BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER pending_claims_delete_revision AFTER DELETE ON pending_claims BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    INSERT INTO registry_meta(id,revision) VALUES(1,0);
    CREATE TRIGGER operations_insert_revision AFTER INSERT ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER operations_update_revision AFTER UPDATE ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER operations_delete_revision AFTER DELETE ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER pins_insert_revision AFTER INSERT ON pins BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER pins_delete_revision AFTER DELETE ON pins BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER protections_insert_revision AFTER INSERT ON protections BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER protections_delete_revision AFTER DELETE ON protections BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    PRAGMA user_version=2;`);
    } else if (version === 1) {
      db.exec(`ALTER TABLE operations ADD COLUMN grant_unissued INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE pending_claims (
        id TEXT PRIMARY KEY, source TEXT NOT NULL, source_key TEXT NOT NULL, digest TEXT NOT NULL, purpose TEXT NOT NULL,
        target TEXT NOT NULL, target_key TEXT NOT NULL, session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL,
        generation INTEGER NOT NULL, reserved_bytes INTEGER NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(source_key,digest,purpose), UNIQUE(target_key));
        CREATE TRIGGER pending_claims_insert_revision AFTER INSERT ON pending_claims BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
        CREATE TRIGGER pending_claims_delete_revision AFTER DELETE ON pending_claims BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
        PRAGMA user_version=2;`);
    } else if (version !== 2) throw new Error(`Unsupported storage registry schema version: ${version}`);
    db.exec("COMMIT");
    return db;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    db.close();
    throw error;
  }
}
function withTransaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = callback(); assertMetadataBudget(db); db.exec("COMMIT"); return result; }
  catch (error) { try { db.exec("ROLLBACK"); } catch {} throw error; }
}
function assertMetadataBudget(db) {
  const file = db.prepare("PRAGMA database_list").all().find(item => item.name === "main")?.file;
  if (!file) throw new Error("Cannot resolve registry database path");
  let bytes = 0;
  for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
    try { bytes += fs.statSync(candidate).size; } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (bytes > MAX_DB_BYTES) throw new Error("Storage registry metadata budget exceeded; no records were removed");
}
function bounded(db) {
  const row = db.prepare("SELECT (SELECT count(*) FROM operations) + (SELECT count(*) FROM pending_claims) AS operations, (SELECT count(*) FROM protections) AS protections, (SELECT count(*) FROM pins) AS pins").get();
  if (row.operations >= MAX_ROWS || row.protections + row.pins >= MAX_ROWS) throw new Error("Storage registry capacity reached; no records were removed");
}
function validateNewTarget(root, db, sourceKey, target, targetKey, { excludePendingId } = {}) {
  const rootKey = canonicalPath(projectRoot(root), { mustExist: true }).key;
  const registryKey = canonicalPath(registryDirectory(root)).key;
  if (!isDescendant(rootKey, targetKey)) throw new Error("New storage targets must be descendants of the project root");
  if (pathOverlaps(registryKey, targetKey)) throw new Error("Storage target cannot overlap the registry directory");
  if (pathOverlaps(sourceKey, targetKey)) throw new Error("Source and target paths must not overlap");
  if (fs.existsSync(target)) {
    const targetStat = fs.lstatSync(target);
    if (!targetStat.isDirectory() || targetStat.isSymbolicLink() || fs.readdirSync(target).length > 0) throw new Error("Refusing to claim a nonempty or non-directory existing target");
  }
  const overlaps = db.prepare("SELECT target_key FROM operations UNION ALL SELECT target_key FROM pending_claims WHERE (? IS NULL OR id<>?)")
    .all(excludePendingId || null, excludePendingId || null);
  if (overlaps.some(row => pathOverlaps(targetKey, row.target_key))) throw new Error("Target overlaps an already registered or pending storage operation");
  const protectedPaths = [
    ...db.prepare("SELECT path FROM pins").all().map(row => row.path),
    ...db.prepare("SELECT path FROM protections").all().map(row => row.path),
  ];
  if (protectedPaths.some(protectedPath => pathOverlaps(targetKey, canonicalPath(protectedPath, { mustExist: true }).key))) {
    throw new Error("Target overlaps a pinned or protected path");
  }
}
function operationReservation(root, row) {
  return { projectRoot: projectRoot(root), id: row.id, generation: row.generation, target: row.target,
    reserveBytes: row.reserved_bytes, token: row.token };
}
function existingOperationResult(root, found, requestedOwner) {
  if (!found) return null;
  if (found.state === "writing" || found.state === "abandoned") {
    if (found.state === "writing" && found.grant_unissued === 1 && requestedOwner
      && found.session === requestedOwner.session && found.request === requestedOwner.request
      && found.source_key === requestedOwner.sourceKey && found.digest === requestedOwner.digest
      && found.purpose === requestedOwner.purpose && found.target === requestedOwner.target
      && found.reserved_bytes === requestedOwner.reserveBytes) {
      const db = requestedOwner.db;
      const consumed = db.prepare("UPDATE operations SET grant_unissued=0,updated_at=? WHERE id=? AND generation=? AND token=? AND grant_unissued=1")
        .run(new Date().toISOString(), found.id, found.generation, found.token);
      if (consumed.changes === 1) return { state: "writer", id: found.id, generation: found.generation, token: found.token, target: found.target };
    }
    return { state: "busy", id: found.id, generation: found.generation, target: found.target,
      owner: { session: found.session, request: found.request }, abandoned: found.state === "abandoned",
      _reservation: operationReservation(root, found) };
  }
  return { state: "reuse-candidate", id: found.id, generation: found.generation, target: found.target, encodedManifest: found.manifest };
}
function publicExisting(result) {
  if (result?.state !== "busy") return result;
  const { _reservation, ...value } = result;
  if (!value.abandoned) delete value.abandoned;
  if (value.abandoned) delete value.owner;
  return value;
}
function finishExisting(root, db, result) {
  if (result?.state !== "reuse-candidate") return publicExisting(result);
  const manifest = JSON.parse(result.encodedManifest);
  const verified = verifyManifest(result.target, manifest);
  const current = db.prepare("SELECT state,generation,manifest FROM operations WHERE id=?").get(result.id);
  if (!current || current.state !== "ready" || current.generation !== result.generation || current.manifest !== result.encodedManifest) throw new Error("Ready resource changed during reuse validation");
  return { state: "reuse", id: result.id, generation: result.generation, target: result.target, manifest: verified };
}
function reservationOptions(options, { allowOverCapacity = false } = {}) {
  return { ...options, allowOverCapacity };
}
function backfillProjectReservations(root, options) {
  const rootPath = projectRoot(root);
  const db = openRegistry(rootPath);
  let rows;
  try { rows = db.prepare("SELECT * FROM operations WHERE state IN ('writing','abandoned') ORDER BY created_at,id").all(); }
  finally { db.close(); }
  for (const row of rows) volumeRegistry.reserve(operationReservation(rootPath, row), reservationOptions(options, { allowOverCapacity: true }));
}
function recoverProjectAdmission(root, options) {
  backfillProjectReservations(root, options);
}
function pendingMatches(pending, request) {
  return pending.source_key === request.sourceKey && pending.digest === request.digest && pending.purpose === request.purpose
    && pending.target_key === request.targetKey && pending.session === request.session && pending.request === request.request
    && pending.reserved_bytes === request.reserveBytes;
}
function fundedPending(root, pending, options) {
  const reservation = operationReservation(root, pending);
  if (volumeRegistry.hasReservation(reservation, options)) return reservation;
  volumeRegistry.reserve(reservation, options);
  return reservation;
}
function promotePending(root, pending) {
  const db = openRegistry(root);
  try {
    return withTransaction(db, () => {
      const current = db.prepare("SELECT * FROM pending_claims WHERE id=?").get(pending.id);
      const existing = db.prepare("SELECT * FROM operations WHERE id=?").get(pending.id);
      if (existing) {
        if (existing.token !== pending.token || existing.generation !== pending.generation || existing.source !== pending.source
          || existing.source_key !== pending.source_key || existing.digest !== pending.digest || existing.purpose !== pending.purpose
          || existing.target !== pending.target || existing.target_key !== pending.target_key
          || existing.session !== pending.session || existing.request !== pending.request || existing.reserved_bytes !== pending.reserved_bytes) {
          throw new Error("Pending claim operation identity fence rejected");
        }
        db.prepare("DELETE FROM pending_claims WHERE id=? AND token=? AND generation=?").run(pending.id, pending.token, pending.generation);
        return existing;
      }
      if (!current || current.source !== pending.source || current.token !== pending.token || current.generation !== pending.generation
        || current.session !== pending.session || current.request !== pending.request || current.source_key !== pending.source_key
        || current.digest !== pending.digest || current.purpose !== pending.purpose || current.target !== pending.target || current.target_key !== pending.target_key
        || current.reserved_bytes !== pending.reserved_bytes) throw new Error("Pending claim owner or identity fence changed before promotion");
      const duplicate = db.prepare("SELECT * FROM operations WHERE source_key=? AND digest=? AND purpose=?")
        .get(pending.source_key, pending.digest, pending.purpose);
      if (duplicate) throw new Error("A matching operation appeared while the pending claim was funded");
      validateNewTarget(root, db, pending.source_key, pending.target, pending.target_key, { excludePendingId: pending.id });
      const now = new Date().toISOString();
      db.prepare("INSERT INTO operations(id,source,source_key,digest,purpose,target,target_key,state,session,request,token,generation,reserved_bytes,grant_unissued,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'writing',?,?,?,?,?,1,?,?)")
        .run(pending.id, pending.source, pending.source_key, pending.digest, pending.purpose, pending.target, pending.target_key,
          pending.session, pending.request, pending.token, pending.generation, pending.reserved_bytes, pending.created_at, now);
      db.prepare("DELETE FROM pending_claims WHERE id=? AND token=? AND generation=?").run(pending.id, pending.token, pending.generation);
      return db.prepare("SELECT * FROM operations WHERE id=?").get(pending.id);
    });
  } finally { db.close(); }
}
function claim(root, input, { availableBytes, volumeOptions } = {}) {
  const sourceIdentity = canonicalPath(input.source, { mustExist: true });
  const source = sourceIdentity.path, sourceKey = sourceIdentity.key;
  if (!DIGEST.test(input.digest || "")) throw new Error("digest must be a lowercase SHA-256 hex string");
  const digest = input.digest;
  const purpose = textValue(input.purpose, "purpose", 256);
  const targetIdentity = canonicalPath(input.target);
  const target = targetIdentity.path, targetKey = targetIdentity.key;
  const reserveBytes = input.reserveBytes === undefined ? 0 : input.reserveBytes;
  if (!Number.isSafeInteger(reserveBytes) || reserveBytes <= 0) throw new Error("reserveBytes must be a positive safe integer");
  const session = textValue(input.session, "session", 256), request = textValue(input.request, "request", 256);
  const rootPath = projectRoot(root), options = volumeOptions || { availableBytes };
  volumeRegistry.initialize(options);
  recoverProjectAdmission(rootPath, options);
  const db = openRegistry(rootPath);
  let prepared, pending;
  try {
    prepared = withTransaction(db, () => {
      const found = db.prepare("SELECT * FROM operations WHERE source_key=? AND digest=? AND purpose=?").get(sourceKey, digest, purpose);
      if (found) return { existing: existingOperationResult(rootPath, found, { db, session, request, sourceKey, digest, purpose, target, targetKey, reserveBytes }) };
      pending = db.prepare("SELECT * FROM pending_claims WHERE source_key=? AND digest=? AND purpose=?").get(sourceKey, digest, purpose);
      if (pending) return pendingMatches(pending, { sourceKey, digest, purpose, targetKey, session, request, reserveBytes })
        ? { pending }
        : { existing: { state: "busy", id: pending.id, generation: pending.generation, target: pending.target } };
      validateNewTarget(rootPath, db, sourceKey, target, targetKey);
      bounded(db);
      const candidate = { id: crypto.randomUUID(), source, source_key: sourceKey, digest, purpose, target, target_key: targetKey,
        session, request, token: crypto.randomUUID(), generation: 1, reserved_bytes: reserveBytes, created_at: new Date().toISOString() };
      db.prepare("INSERT INTO pending_claims(id,source,source_key,digest,purpose,target,target_key,session,request,token,generation,reserved_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(candidate.id, candidate.source, candidate.source_key, candidate.digest, candidate.purpose, candidate.target, candidate.target_key,
          candidate.session, candidate.request, candidate.token, candidate.generation, candidate.reserved_bytes, candidate.created_at);
      return { pending: candidate };
    });
    if (prepared.existing) {
      const result = finishExisting(rootPath, db, prepared.existing);
      if (result.state === "writer" && typeof options.afterWriterGrant === "function") options.afterWriterGrant({ id: result.id, generation: result.generation });
      return result;
    }
  } finally { db.close(); }
  pending = prepared.pending;
  if (typeof options.beforeExternalReservation === "function") options.beforeExternalReservation({ id: pending.id, generation: pending.generation });
  fundedPending(rootPath, pending, options);
  if (typeof options.afterExternalReservation === "function") options.afterExternalReservation({ id: pending.id, generation: pending.generation });
  promotePending(rootPath, pending);
  const grantDb = openRegistry(rootPath);
  let result;
  try {
    result = withTransaction(grantDb, () => {
      const operation = grantDb.prepare("SELECT * FROM operations WHERE id=?").get(pending.id);
      if (!operation) throw new Error("Funded claim was not promoted to a project operation");
      const issued = existingOperationResult(rootPath, operation, { db: grantDb, session, request, sourceKey, digest, purpose, target, targetKey, reserveBytes });
      return issued;
    });
  } finally { grantDb.close(); }
  if (result.state === "writer" && typeof options.afterWriterGrant === "function") options.afterWriterGrant({ id: result.id, generation: result.generation });
  return publicExisting(result);
}
function verifyManifest(target, manifest) {
  if (!Array.isArray(manifest) || manifest.length > MAX_FILES) throw new Error(`manifest must contain at most ${MAX_FILES} files`);
  managed.assertNoLinks(target);
  const rootStat = fs.lstatSync(target);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Published target must be a regular directory");
  const expected = new Map();
  for (const item of manifest) {
    if (!item || typeof item.path !== "string" || path.isAbsolute(item.path) || item.path.split(/[\\/]/u).some(part => part === ".." || part === "")) throw new Error("Invalid manifest path");
    if (!Number.isSafeInteger(item.size) || item.size < 0 || !DIGEST.test(item.sha256 || "")) throw new Error("Invalid manifest size or SHA-256");
    if (expected.has(item.path)) throw new Error("Duplicate manifest path");
    expected.set(item.path, item);
  }
  const observed = [];
  function walk(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink() || !(stat.isFile() || stat.isDirectory())) throw new Error("Published tree contains a link or special entry");
      if (stat.isDirectory()) walk(absolute, relative);
      else {
        const hash = crypto.createHash("sha256"), fd = fs.openSync(absolute, "r"), buffer = Buffer.allocUnsafe(1024 * 1024);
        try { let bytes; while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes)); }
        finally { fs.closeSync(fd); }
        observed.push({ path: relative, size: stat.size, sha256: hash.digest("hex") });
      }
      if (observed.length > MAX_FILES) throw new Error("Published tree exceeds file limit");
    }
  }
  walk(target);
  if (observed.length !== expected.size) throw new Error("Published tree does not match manifest");
  for (const item of observed) {
    const declared = expected.get(item.path);
    if (!declared || declared.size !== item.size || declared.sha256 !== item.sha256) throw new Error(`Manifest mismatch: ${item.path}`);
  }
  return observed.sort((a,b) => a.path.localeCompare(b.path));
}
function ownedOperation(db, input) {
  const row = db.prepare("SELECT * FROM operations WHERE id=?").get(textValue(input.id, "id", 64));
  if (!row || row.state !== "writing" || row.token !== input.token || row.generation !== input.generation) throw new Error("Storage operation owner/token/generation fence rejected");
  return row;
}
function publish(root, input) {
  const db = openRegistry(root);
  try {
    const row = db.prepare("SELECT * FROM operations WHERE id=?").get(input.id);
    if (!row || row.state !== "writing" || row.token !== input.token || row.generation !== input.generation) throw new Error("Storage operation owner/token/generation fence rejected");
    if (input.session !== row.session || input.request !== row.request) throw new Error("Storage operation owner mismatch");
    const requestedManifest = JSON.stringify(input.manifest);
    if (typeof requestedManifest !== "string" || Buffer.byteLength(requestedManifest, "utf8") > MAX_MANIFEST_BYTES) throw new Error("Published manifest exceeds 1 MiB metadata limit");
    const manifest = verifyManifest(row.target, input.manifest);
    const payloadBytes = manifest.reduce((total, item) => {
      if (item.size > Number.MAX_SAFE_INTEGER - total) throw new Error("Manifest payload size exceeds the safe integer range");
      return total + item.size;
    }, 0);
    if (payloadBytes > row.reserved_bytes) throw new Error("Published output exceeds its reserved peak bytes");
    const reservation = { projectRoot: projectRoot(root), id: row.id, generation: row.generation, target: row.target, reserveBytes: row.reserved_bytes, token: row.token };
    volumeRegistry.reserve(reservation);
    const published = withTransaction(db, () => {
      const current = ownedOperation(db, input);
      if (current.target !== row.target) throw new Error("Storage operation target changed");
      const encoded = JSON.stringify(manifest);
      if (Buffer.byteLength(encoded, "utf8") > MAX_MANIFEST_BYTES) throw new Error("Published manifest exceeds 1 MiB metadata limit");
      db.prepare("UPDATE operations SET state='ready',manifest=?,reserved_bytes=0,updated_at=? WHERE id=? AND state='writing' AND token=? AND generation=?").run(encoded, new Date().toISOString(), input.id, input.token, input.generation);
      return { published: true, id: input.id, generation: input.generation, manifest };
    });
    try {
      const released = volumeRegistry.release(reservation, { evidence: "published-ready" });
      return { ...published, volumeReservationReleased: released.released || released.absent };
    } catch (error) {
      return { ...published, volumeReservationReleased: false, volumeReleaseError: error.message };
    }
  } finally { db.close(); }
}
function protect(root, input) {
  const protectedPath = safePath(input.path, { mustExist: true });
  const reason = textValue(input.reason, "reason", 256), session = textValue(input.session, "session", 256), request = textValue(input.request, "request", 256);
  const db = openRegistry(root);
  try { return withTransaction(db, () => {
    const existing = db.prepare("SELECT id,token FROM protections WHERE path=? AND session=? AND request=?").get(protectedPath, session, request);
    if (existing) return { protected: true, id: existing.id, token: existing.token, existing: true, path: protectedPath };
    bounded(db);
    const id = crypto.randomUUID(), token = crypto.randomUUID();
    db.prepare("INSERT INTO protections(id,path,reason,session,request,token,created_at) VALUES(?,?,?,?,?,?,?)").run(id, protectedPath, reason, session, request, token, new Date().toISOString());
    return { protected: true, id, token, path: protectedPath };
  }); } finally { db.close(); }
}
function pin(root, input) {
  const session = textValue(input.session, "session", 256), request = textValue(input.request, "request", 256);
  const db = openRegistry(root);
  try { return withTransaction(db, () => {
    const op = input.resourceId && db.prepare("SELECT * FROM operations WHERE id=?").get(input.resourceId);
    const target = op ? op.target : safePath(input.path, { mustExist: true });
    if (op && op.state !== "ready") throw new Error("Only a ready registered resource can be pinned");
    bounded(db);
    const id = crypto.randomUUID(), token = crypto.randomUUID();
    db.prepare("INSERT INTO pins(id,resource_id,path,session,request,token,created_at) VALUES(?,?,?,?,?,?,?)").run(id, op?.id || null, target, session, request, token, new Date().toISOString());
    return { pinned: true, id, token, path: target };
  }); } finally { db.close(); }
}
function release(root, input) {
  const db = openRegistry(root);
  try {
    const result = withTransaction(db, () => {
    if (input.pinId || input.protectionId) {
      const table = input.pinId ? "pins" : "protections", id = input.pinId || input.protectionId;
      const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
      if (!row || row.token !== input.token || input.session !== row.session || input.request !== row.request) throw new Error("Pin/protection release owner fence rejected");
      db.prepare(`DELETE FROM ${table} WHERE id=? AND token=?`).run(id, input.token);
      return { released: true, id };
    }
    const protection = input.id && db.prepare("SELECT * FROM protections WHERE id=?").get(input.id);
    if (protection) {
      if (protection.token !== input.token || input.session !== protection.session || input.request !== protection.request) throw new Error("Pin/protection release owner fence rejected");
      db.prepare("DELETE FROM protections WHERE id=? AND token=?").run(input.id, input.token);
      return { released: true, id: input.id };
    }
    const row = db.prepare("SELECT * FROM operations WHERE id=?").get(textValue(input.id, "id", 64));
    if (!row || !["writing", "abandoned"].includes(row.state) || row.token !== input.token || row.generation !== input.generation) throw new Error("Storage operation owner/token/generation fence rejected");
    if (input.session !== row.session || input.request !== row.request) throw new Error("Storage operation owner mismatch");
    managed.assertNoLinks(row.target, { allowMissing: true });
    if (fs.existsSync(row.target)) throw new Error("Cannot release a storage operation while its target still exists");
    db.prepare("DELETE FROM operations WHERE id=? AND state=? AND token=? AND generation=?").run(row.id, row.state, row.token, row.generation);
    return { released: true, id: row.id, _volumeReservation: { projectRoot: projectRoot(root), id: row.id, generation: row.generation,
      target: row.target, reserveBytes: row.reserved_bytes, token: row.token } };
    });
    if (!result._volumeReservation) return result;
    try {
      const volumeResult = volumeRegistry.release(result._volumeReservation, { evidence: "owner-released-absent-target" });
      return { released: true, id: result.id, volumeReservationReleased: volumeResult.released || volumeResult.absent };
    } catch (error) {
      return { released: true, id: result.id, volumeReservationReleased: false, volumeReleaseError: error.message };
    }
  } finally { db.close(); }
}
function abandon(root, input) {
  const db = openRegistry(root);
  try {
    const current = db.prepare("SELECT * FROM operations WHERE id=?").get(textValue(input.id, "id", 64));
    if (current?.state === "writing" && current.token === input.token && current.generation === input.generation
      && current.session === input.session && current.request === input.request) {
      volumeRegistry.reserve({ projectRoot: projectRoot(root), id: current.id, generation: current.generation, target: current.target,
        reserveBytes: current.reserved_bytes, token: current.token });
    }
    return withTransaction(db, () => {
    const row = ownedOperation(db, input);
    if (input.session !== row.session || input.request !== row.request) throw new Error("Storage operation owner mismatch");
    db.prepare("UPDATE operations SET state='abandoned',updated_at=? WHERE id=? AND token=? AND generation=?").run(new Date().toISOString(), row.id, row.token, row.generation);
    return { abandoned: true, id: row.id, target: row.target };
    });
  } finally { db.close(); }
}
function reconcile(root, input) {
  const file = registryPath(root);
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return volumeRegistry.release({ ...input, projectRoot: projectRoot(root) }, { evidence: "reconciled-absent-target" });
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true });
  let row;
  try { row = db.prepare("SELECT * FROM operations WHERE id=?").get(textValue(input.id, "id", 64)); }
  finally { db.close(); }
  if (!row) return volumeRegistry.release({ ...input, projectRoot: projectRoot(root) }, { evidence: "reconciled-absent-target" });
  if (row.generation !== input.generation || row.session !== input.session || row.request !== input.request
    || (input.token !== undefined && row.token !== input.token)) {
    throw new Error("Storage operation owner/token/generation fence rejected");
  }
  const ownerInput = { ...input, token: row.token };
  const reservation = { projectRoot: projectRoot(root), id: row.id, generation: row.generation, target: row.target,
    reserveBytes: row.reserved_bytes || 1, token: row.token };
  if (row.state === "ready") {
    verifyManifest(row.target, JSON.parse(row.manifest || "[]"));
    return volumeRegistry.release(reservation, { evidence: "published-ready" });
  }
  if (!["writing", "abandoned"].includes(row.state)) throw new Error("Unsupported operation state for reconciliation");
  return release(root, ownerInput);
}
function status(root, options = {}) {
  const file = registryPath(root);
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return { registryPresent: false, revision: 0, operations: [], pendingClaims: [], pins: [], protections: [], unfinishedWrites: [], volumeAdmission: volumeRegistry.status(root) };
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec("BEGIN");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version === 0) {
      const existingTables = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count;
      if (existingTables) throw new Error("Storage registry has unversioned tables; status cannot interpret its schema");
      db.exec("COMMIT");
      return { registryPresent: true, initializing: true, revision: 0, operations: [], pendingClaims: [], pins: [], protections: [], unfinishedWrites: [], volumeAdmission: volumeRegistry.status(root) };
    }
    if (version !== 1 && version !== 2) throw new Error(`Unsupported storage registry schema version: ${version}`);
    const revision = db.prepare("SELECT revision FROM registry_meta WHERE id=1").get()?.revision || 0;
    const operations = db.prepare("SELECT id,source,digest,purpose,target,state,session,request,generation,reserved_bytes,length(manifest) AS manifest_bytes,created_at,updated_at FROM operations ORDER BY updated_at DESC LIMIT 500").all();
    const pendingClaims = version === 2
      ? db.prepare("SELECT id,source,digest,purpose,target,session,request,generation,reserved_bytes,created_at FROM pending_claims ORDER BY created_at DESC LIMIT 200").all()
      : [];
    const unfinishedParams = [];
    let unfinishedFilter = " WHERE state='writing'";
    if (options.owner) { unfinishedFilter += " AND session=?"; unfinishedParams.push(options.owner); }
    if (options.request) { unfinishedFilter += " AND request=?"; unfinishedParams.push(options.request); }
    const unfinishedWrites = db.prepare(`SELECT id,target,state,session,request,generation,updated_at FROM operations${unfinishedFilter} ORDER BY updated_at DESC LIMIT ${MAX_ROWS}`).all(...unfinishedParams);
    const pins = db.prepare("SELECT id,resource_id,path,session,request,created_at FROM pins ORDER BY created_at DESC LIMIT 500").all();
    const protections = db.prepare("SELECT id,path,reason,session,request,created_at FROM protections ORDER BY created_at DESC LIMIT 500").all();
    const visiblePins = [...pins.map(item => ({ ...item, kind: "pin" })), ...protections.map(item => ({ ...item, kind: "protection" }))].slice(0, 500);
    db.exec("COMMIT");
    return { registryPresent: true, revision, operations, pendingClaims, pins: visiblePins, protections, unfinishedWrites, volumeAdmission: volumeRegistry.status(root) };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  } finally { db.close(); }
}

module.exports = { registryPath, openRegistry, claim, publish, protect, pin, release, abandon, reconcile, status, verifyManifest };
