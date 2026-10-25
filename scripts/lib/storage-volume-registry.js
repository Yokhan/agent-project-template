"use strict";

// Per-user metadata-only admission shared by participating project checkouts.
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const managed = require("./managed-temp.js");

const MAX_ROWS = 4000;
const MAX_DB_BYTES = 8 * 1024 * 1024;
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const TOKEN_HASH = /^[a-f0-9]{64}$/u;
const DEFAULT_DATABASE_PATH = path.join(os.homedir(), ".local", "share", "agent-project-template", "storage-coordination", "registry.sqlite");
const WINDOWS_IDENTITY_HELPER = path.resolve(__dirname, "storage-volume-identity.ps1");

function text(value, name, max = 4096) {
  if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0")) throw new Error(`${name} must be a non-empty bounded string`);
  return value;
}
function canonicalProject(root) {
  const absolute = managed.assertNoLinks(path.resolve(text(root, "projectRoot")));
  if (!fs.statSync(absolute).isDirectory()) throw new Error("Project root must be a directory");
  return fs.realpathSync.native(absolute);
}
function nearestExistingDirectory(target, { measureAvailable = true } = {}) {
  let current = path.resolve(text(target, "target"));
  if (process.platform === "win32" && current.startsWith("\\\\")) throw new Error("UNC targets are unsupported for volume admission");
  const suffix = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Cannot resolve target to an existing volume ancestor");
    suffix.unshift(path.basename(current));
    current = parent;
  }
  managed.assertNoLinks(current);
  if (!fs.statSync(current).isDirectory()) current = path.dirname(current);
  const stat = fs.statSync(current, { bigint: true });
  let availableBytes;
  if (measureAvailable) {
    const space = fs.statfsSync(current, { bigint: true });
    const availableBig = space.bavail * space.bsize;
    if (availableBig < 0n || availableBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Volume available-space measurement is outside the safe integer range");
    availableBytes = Number(availableBig);
  }
  return { path: current, device: stat.dev.toString(), availableBytes };
}
function windowsVolumeId(existingPath) {
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", WINDOWS_IDENTITY_HELPER], {
    input: JSON.stringify({ path: existingPath }), encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024,
  });
  if (result.error) throw new Error(`Cannot measure Windows volume identity: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Cannot measure Windows volume identity: ${(result.stderr || "helper failed").trim().slice(0, 1000)}`);
  let value;
  try { value = JSON.parse(result.stdout); } catch { throw new Error("Windows volume identity helper returned invalid JSON"); }
  if (typeof value.volumeId !== "string" || !/^\\\\\?\\volume\{[0-9a-f-]{36}\}\\$/iu.test(value.volumeId)) throw new Error("Windows volume identity helper returned an unsupported identity");
  return value.volumeId.toLowerCase();
}
function resolveVolume(target, { measureAvailable = true } = {}) {
  const existing = nearestExistingDirectory(target, { measureAvailable });
  const host = os.hostname().toLowerCase();
  const id = process.platform === "win32"
    ? `${host}:${windowsVolumeId(existing.path)}`
    : `${host}:st_dev:${existing.device}`;
  return { id, availableBytes: existing.availableBytes, measuredAt: new Date().toISOString() };
}
function safeDatabasePath(value) {
  const file = path.resolve(text(value, "databasePath"));
  managed.assertNoLinks(file, { allowMissing: true });
  return file;
}
function ensureDatabaseDirectory(file) {
  const directory = path.dirname(file);
  managed.assertNoLinks(directory, { allowMissing: true });
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  managed.assertNoLinks(directory);
  if (process.platform !== "win32") fs.chmodSync(directory, 0o700);
}
function databasePath(options = {}) {
  return safeDatabasePath(options.databasePath || process.env.AGENT_STORAGE_COORDINATION_TEST_DB || DEFAULT_DATABASE_PATH);
}
function assertKnownSchema(file) {
  if (!fs.existsSync(file)) return null;
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout=5000; BEGIN;");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    const objects = db.prepare("SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    if (version === 0) {
      if (objects.length) throw new Error("Volume registry has unversioned schema objects; refusing to reinterpret its schema");
    } else {
      if (version !== 1 && version !== 2) throw new Error(`Unsupported volume registry schema version: ${version}`);
      const expectedObjects = [
        { type: "index", name: "reservations_by_volume", tbl_name: "reservations" },
        { type: "table", name: "reservations", tbl_name: "reservations" },
      ];
      if (JSON.stringify(objects) !== JSON.stringify(expectedObjects)) {
        throw new Error(`Volume registry schema objects do not match version ${version}; refusing to reinterpret its schema`);
      }
      const columns = db.prepare("PRAGMA table_info(reservations)").all();
      const expectedColumns = [
        ["project_root", "TEXT", 1, 1], ["operation_id", "TEXT", 1, 2], ["generation", "INTEGER", 1, 3],
        ["target", "TEXT", 1, 0], ["volume_id", "TEXT", 1, 0], ["reserved_bytes", "INTEGER", 1, 0],
        ["token_sha256", "TEXT", 1, 0],
      ];
      if (version === 2 || (version === 1 && columns.some(column => column.name === "state"))) expectedColumns.push(["state", "TEXT", 1, 0]);
      expectedColumns.push(["created_at", "TEXT", 1, 0]);
      if (columns.length !== expectedColumns.length || columns.some(column => {
        const expected = expectedColumns.find(([name]) => name === column.name);
        if (!expected) return true;
        const [, type, notnull, primaryKeyOrder] = expected;
        return column.type !== type || column.notnull !== notnull || column.pk !== primaryKeyOrder;
      })) throw new Error(`Volume registry table columns do not match version ${version}; refusing to reinterpret its schema`);
      const indexes = db.prepare("PRAGMA index_list(reservations)").all().filter(index => !index.name.startsWith("sqlite_"));
      if (indexes.length !== 1 || indexes[0].name !== "reservations_by_volume" || indexes[0].unique !== 0) {
        throw new Error(`Volume registry indexes do not match version ${version}; refusing to reinterpret its schema`);
      }
      const indexColumns = db.prepare("PRAGMA index_info(reservations_by_volume)").all();
      if (indexColumns.length !== 1 || indexColumns[0].name !== "volume_id") {
        throw new Error(`Volume registry volume index does not match version ${version}; refusing to reinterpret its schema`);
      }
    }
    db.exec("COMMIT;");
    return version;
  } catch (error) {
    try { db.exec("ROLLBACK;"); } catch {}
    throw error;
  } finally { db.close(); }
}
function openStore(file) {
  const { DatabaseSync } = require("node:sqlite");
  ensureDatabaseDirectory(file);
  managed.assertNoLinks(file, { allowMissing: true });
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw new Error("Volume registry must be a regular file");
  assertKnownSchema(file);
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout=5000;");
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version === 0) {
      const count = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count;
      if (count) throw new Error("Volume registry has unversioned tables; refusing to reinterpret its schema");
      db.exec(`CREATE TABLE reservations (
        project_root TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        generation INTEGER NOT NULL CHECK(generation > 0),
        target TEXT NOT NULL,
        volume_id TEXT NOT NULL,
        reserved_bytes INTEGER NOT NULL CHECK(reserved_bytes > 0),
        token_sha256 TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state='reserved'),
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_root, operation_id, generation)
      );
      CREATE INDEX reservations_by_volume ON reservations(volume_id);
      PRAGMA user_version=2;`);
    } else if (version === 1) {
      const columns = db.prepare("PRAGMA table_info(reservations)").all().map(row => row.name);
      if (!columns.includes("state")) db.exec("ALTER TABLE reservations ADD COLUMN state TEXT NOT NULL DEFAULT 'reserved' CHECK(state='reserved')");
      db.exec("UPDATE reservations SET state='reserved'; PRAGMA user_version=2;");
    } else if (version !== 2) throw new Error(`Unsupported volume registry schema version: ${version}`);
    db.exec("COMMIT");
    if (process.platform !== "win32") fs.chmodSync(file, 0o600);
    return db;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    db.close();
    throw error;
  }
}
function metadataBytes(db) {
  const file = db.prepare("PRAGMA database_list").all().find(row => row.name === "main")?.file;
  if (!file) throw new Error("Cannot resolve volume registry database path");
  let bytes = 0;
  for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
    try { bytes += fs.statSync(candidate).size; } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (bytes > MAX_DB_BYTES) throw new Error("Volume registry metadata budget exceeded; no records were removed");
}
function withTransaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    metadataBytes(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}
function tokenHash(token) { return crypto.createHash("sha256").update(text(token, "token", 256), "utf8").digest("hex"); }
function validateInput(input) {
  const projectRoot = canonicalProject(input.projectRoot);
  const operationId = text(input.id, "operation id", 64);
  const generation = input.generation;
  if (!Number.isSafeInteger(generation) || generation <= 0) throw new Error("generation must be a positive safe integer");
  const target = path.resolve(text(input.target, "target"));
  managed.assertNoLinks(target, { allowMissing: true });
  const reservedBytes = input.reserveBytes;
  if (!Number.isSafeInteger(reservedBytes) || reservedBytes <= 0) throw new Error("reserveBytes must be a positive safe integer");
  return { projectRoot, operationId, generation, target, reservedBytes, tokenSha256: tokenHash(input.token) };
}
function hasReservation(input, options = {}) {
  const row = validateInput(input);
  const file = databasePath(options);
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return false;
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout=5000;");
    const existing = db.prepare("SELECT target,volume_id,reserved_bytes,token_sha256 FROM reservations WHERE project_root=? AND operation_id=? AND generation=?")
      .get(row.projectRoot, row.operationId, row.generation);
    if (!existing) return false;
    const currentVolume = identityFor(row.target, options);
    if (existing.target !== row.target || existing.volume_id !== currentVolume.id
      || existing.reserved_bytes !== row.reservedBytes || existing.token_sha256 !== row.tokenSha256) {
      throw new Error("Existing volume reservation identity or owner fence does not match");
    }
    return true;
  } finally { db.close(); }
}
function identityFor(target, options, { locked = false } = {}) {
  if (typeof options.measureVolume === "function") {
    const identity = options.measureVolume(target, { locked });
    const id = text(identity?.id, "measured volume identity", 1024);
    const availableBytes = identity.availableBytes;
    if (!Number.isSafeInteger(availableBytes) || availableBytes < 0) throw new Error("Available-byte measurement must be a nonnegative safe integer");
    return { id, availableBytes };
  }
  if (options.volumeIdentity !== undefined) {
    const identity = options.volumeIdentity;
    const id = text(identity?.id, "volumeIdentity.id", 1024);
    const availableBytes = options.availableBytes === undefined ? identity.availableBytes : options.availableBytes;
    if (!Number.isSafeInteger(availableBytes) || availableBytes < 0) throw new Error("Available-byte measurement must be a nonnegative safe integer");
    return { id, availableBytes };
  }
  if (process.env.AGENT_STORAGE_COORDINATION_TEST_DB && process.env.AGENT_STORAGE_COORDINATION_TEST_VOLUME_ID) {
    const id = text(process.env.AGENT_STORAGE_COORDINATION_TEST_VOLUME_ID, "test volume identity", 1024);
    const configured = process.env.AGENT_STORAGE_COORDINATION_TEST_AVAILABLE_BYTES;
    const fallback = configured === undefined ? Number.MAX_SAFE_INTEGER : Number(configured);
    const availableBytes = options.availableBytes === undefined ? fallback : options.availableBytes;
    if (!Number.isSafeInteger(availableBytes) || availableBytes < 0) throw new Error("Available-byte measurement must be a nonnegative safe integer");
    return { id, availableBytes };
  }
  const identity = resolveVolume(target, { measureAvailable: locked });
  const availableBytes = options.availableBytes === undefined ? identity.availableBytes : options.availableBytes;
  if (locked && (!Number.isSafeInteger(availableBytes) || availableBytes < 0)) throw new Error("Available-byte measurement must be a nonnegative safe integer");
  return { id: identity.id, availableBytes };
}
function reserve(input, options = {}) {
  const row = validateInput(input);
  initialize(options);
  if (hasReservation(input, options)) {
    const file = databasePath(options);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
    try {
      db.exec("PRAGMA busy_timeout=5000;");
      const existing = db.prepare("SELECT volume_id FROM reservations WHERE project_root=? AND operation_id=? AND generation=?")
        .get(row.projectRoot, row.operationId, row.generation);
      if (!existing) return reserve(input, options);
      return { reserved: true, existing: true, id: row.operationId, generation: row.generation, volumeId: existing.volume_id, reservedBytes: row.reservedBytes };
    } finally { db.close(); }
  }
  const preliminaryVolume = identityFor(row.target, options);
  const file = databasePath(options);
  const db = openStore(file);
  try {
    return withTransaction(db, () => {
      const existing = db.prepare("SELECT * FROM reservations WHERE project_root=? AND operation_id=? AND generation=?")
        .get(row.projectRoot, row.operationId, row.generation);
      if (existing) {
        if (existing.target !== row.target || existing.volume_id !== preliminaryVolume.id || existing.reserved_bytes !== row.reservedBytes || existing.token_sha256 !== row.tokenSha256) {
          throw new Error("Existing volume reservation identity or owner fence does not match");
        }
        return { reserved: true, existing: true, id: row.operationId, generation: row.generation, volumeId: existing.volume_id, reservedBytes: row.reservedBytes };
      }
      const volume = identityFor(row.target, options, { locked: true });
      if (volume.id !== preliminaryVolume.id) throw new Error("Target volume identity changed during the admission check; no reservation was committed");
      const count = db.prepare("SELECT count(*) AS count FROM reservations").get().count;
      if (count >= MAX_ROWS) throw new Error("Volume registry capacity reached; no reservations were removed");
      if (!options.allowOverCapacity) {
        const totals = db.prepare("SELECT COALESCE(SUM(reserved_bytes),0) AS bytes FROM reservations WHERE volume_id=? AND state='reserved'").get(volume.id).bytes;
        if (!Number.isSafeInteger(totals) || totals < 0) throw new Error("Volume reservation total is outside the safe integer range");
        if (volume.availableBytes - MIN_FREE_BYTES - totals < row.reservedBytes) {
          throw new Error("Global volume admission refused: 2 GiB free-space floor plus unreleased reservations would be exceeded");
        }
      }
      db.prepare("INSERT INTO reservations(project_root,operation_id,generation,target,volume_id,reserved_bytes,token_sha256,state,created_at) VALUES(?,?,?,?,?,?,?,'reserved',?)")
        .run(row.projectRoot, row.operationId, row.generation, row.target, volume.id, row.reservedBytes, row.tokenSha256, new Date().toISOString());
      return { reserved: true, existing: false, id: row.operationId, generation: row.generation, volumeId: volume.id, reservedBytes: row.reservedBytes };
    });
  } finally { db.close(); }
}
function initialize(options = {}) {
  const file = databasePath(options);
  const version = assertKnownSchema(file);
  if (version === 2) {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
    try { db.exec("PRAGMA busy_timeout=5000;"); metadataBytes(db); return { registryPresent: true }; }
    finally { db.close(); }
  }
  const db = openStore(file);
  try { metadataBytes(db); return { registryPresent: true }; }
  finally { db.close(); }
}
function release(input, { databasePath: selectedPath, evidence } = {}) {
  const projectRoot = canonicalProject(input.projectRoot);
  const operationId = text(input.id, "operation id", 64);
  const generation = input.generation;
  if (!Number.isSafeInteger(generation) || generation <= 0) throw new Error("generation must be a positive safe integer");
  if (!new Set(["published-ready", "owner-released-absent-target", "reconciled-absent-target", "duplicate-project-claim"]).has(evidence)) throw new Error("Volume release requires verified project lifecycle evidence");
  const tokenSha256 = tokenHash(input.token);
  const file = databasePath(selectedPath ? { databasePath: selectedPath } : {});
  if (!fs.existsSync(file)) return { released: false, absent: true, id: operationId, generation };
  managed.assertNoLinks(file);
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: false, timeout: 5000 });
  try {
    return withTransaction(db, () => {
      const row = db.prepare("SELECT * FROM reservations WHERE project_root=? AND operation_id=? AND generation=?").get(projectRoot, operationId, generation);
      if (!row) return { released: false, absent: true, id: operationId, generation };
      if (row.token_sha256 !== tokenSha256) throw new Error("Volume reservation owner/token fence rejected");
      if (evidence !== "published-ready" && evidence !== "duplicate-project-claim") {
        managed.assertNoLinks(row.target, { allowMissing: true });
        if (fs.existsSync(row.target)) throw new Error("Cannot release a volume reservation while its target exists");
      }
      db.prepare("DELETE FROM reservations WHERE project_root=? AND operation_id=? AND generation=? AND token_sha256=?")
        .run(projectRoot, operationId, generation, tokenSha256);
      return { released: true, id: operationId, generation, volumeId: row.volume_id, reservedBytes: row.reserved_bytes };
    });
  } finally { db.close(); }
}
function status(projectRoot, options = {}) {
  const ownerRoot = canonicalProject(projectRoot);
  const file = databasePath(options);
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return { registryPresent: false, reservations: [] };
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  try {
    db.exec("PRAGMA busy_timeout=5000;");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version === 0) return { registryPresent: true, initializing: true, reservations: [] };
    if (version !== 1 && version !== 2) throw new Error(`Unsupported volume registry schema version: ${version}`);
    const reservations = db.prepare("SELECT operation_id AS id,generation,target,volume_id AS volumeId,reserved_bytes AS reservedBytes,created_at AS createdAt FROM reservations WHERE project_root=? ORDER BY created_at DESC LIMIT 200")
      .all(ownerRoot);
    return { registryPresent: true, reservations };
  } finally { db.close(); }
}

module.exports = { defaultDatabasePath: DEFAULT_DATABASE_PATH, resolveVolume, initialize, hasReservation, reserve, release, status, MIN_FREE_BYTES };
