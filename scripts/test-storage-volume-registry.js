"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const base = process.env.AGENT_RUN_COPY_DIR || process.env.AGENT_RUN_OUTPUT;
if (!base) throw new Error("Run this test through managed-temp so fixtures stay in its owned output");
const fixtureRoot = path.join(base, "storage-volume-fixtures");
fs.mkdirSync(fixtureRoot, { recursive: true });
process.env.AGENT_STORAGE_COORDINATION_TEST_DB = path.join(fixtureRoot, "registry.sqlite");
const volume = require("./lib/storage-volume-registry.js");
const volumeId = "fixture-host:fixture-volume";
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitForFile(file, timeoutMs = 10000) {
  const started = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for test barrier: ${path.basename(file)}`);
    await delay(10);
  }
}

const project = name => {
  const root = path.join(fixtureRoot, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
};
const input = (root, id, target, bytes, token = `secret-${id}`) => ({
  projectRoot: root, id, generation: 1, target, reserveBytes: bytes, token,
});
function childReserve(value, available, identityId) {
  const modulePath = path.resolve(__dirname, "lib/storage-volume-registry.js");
  const script = `const r=require(${JSON.stringify(modulePath)});const input=JSON.parse(process.argv[1]);try{process.stdout.write(JSON.stringify(r.reserve(input,{availableBytes:Number(process.argv[2]),volumeIdentity:{id:process.argv[3],availableBytes:Number(process.argv[2])}})))}catch(error){process.stdout.write(JSON.stringify({error:error.message}))}`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script, JSON.stringify(value), String(available), identityId], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`reserve child exited ${code}: ${stderr}`)));
  });
}

async function main() {
  const absent = project("absent-store");
  assert.equal(volume.status(absent).registryPresent, false);
  assert.equal(fs.existsSync(process.env.AGENT_STORAGE_COORDINATION_TEST_DB), false, "read-only status does not create the global registry");

  const unknownDatabase = path.join(fixtureRoot, "unknown-existing-schema.sqlite");
  const { DatabaseSync } = require("node:sqlite");
  const unknown = new DatabaseSync(unknownDatabase);
  unknown.exec("CREATE TABLE unrelated_data(id TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO unrelated_data VALUES('keep','original bytes');");
  unknown.close();
  const unknownBytes = fs.readFileSync(unknownDatabase);
  assert.throws(() => volume.initialize({ databasePath: unknownDatabase }), /unversioned schema objects/u,
    "initialization refuses to reinterpret an unknown existing schema");
  assert.deepEqual(fs.readFileSync(unknownDatabase), unknownBytes,
    "unknown existing schema bytes remain unchanged after refusal");

  const brokenCurrentDatabase = path.join(fixtureRoot, "broken-current-schema.sqlite");
  const brokenCurrent = new DatabaseSync(brokenCurrentDatabase);
  brokenCurrent.exec("PRAGMA user_version=2; CREATE TABLE unrelated_data(id TEXT PRIMARY KEY, value TEXT NOT NULL);");
  brokenCurrent.close();
  const brokenCurrentBytes = fs.readFileSync(brokenCurrentDatabase);
  assert.throws(() => volume.initialize({ databasePath: brokenCurrentDatabase }), /schema objects do not match version 2/u,
    "a current version marker cannot legitimize a missing reservations table");
  assert.deepEqual(fs.readFileSync(brokenCurrentDatabase), brokenCurrentBytes,
    "a malformed current-version database remains unchanged after refusal");

  const unsupportedDatabase = path.join(fixtureRoot, "unsupported-version.sqlite");
  const unsupported = new DatabaseSync(unsupportedDatabase);
  unsupported.exec("PRAGMA user_version=77;");
  unsupported.close();
  const unsupportedBytes = fs.readFileSync(unsupportedDatabase);
  assert.throws(() => volume.initialize({ databasePath: unsupportedDatabase }), /Unsupported volume registry schema version: 77/u,
    "an unknown version is refused before schema writes");
  assert.deepEqual(fs.readFileSync(unsupportedDatabase), unsupportedBytes,
    "an unknown-version database remains unchanged after refusal");

  const legacyWithoutStateDatabase = path.join(fixtureRoot, "legacy-v1-without-state.sqlite");
  const legacyWithoutState = new DatabaseSync(legacyWithoutStateDatabase);
  legacyWithoutState.exec(`CREATE TABLE reservations (
    project_root TEXT NOT NULL, operation_id TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation > 0),
    target TEXT NOT NULL, volume_id TEXT NOT NULL, reserved_bytes INTEGER NOT NULL CHECK(reserved_bytes > 0),
    token_sha256 TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_root, operation_id, generation));
    CREATE INDEX reservations_by_volume ON reservations(volume_id);
    PRAGMA user_version=1;`);
  legacyWithoutState.close();
  assert.deepEqual(volume.initialize({ databasePath: legacyWithoutStateDatabase }), { registryPresent: true },
    "known v1 schema without state migrates to v2");
  assert.deepEqual(volume.initialize({ databasePath: legacyWithoutStateDatabase }), { registryPresent: true },
    "migrated v1 schema with appended state passes current-version preflight");
  const migrationProject = project("legacy-v1-without-state-owner");
  const migrationTarget = path.join(migrationProject, "output");
  const migrationInput = input(migrationProject, "legacy-v1-without-state", migrationTarget, 100);
  assert.equal(volume.reserve(migrationInput, {
    databasePath: legacyWithoutStateDatabase,
    volumeIdentity: { id: volumeId, availableBytes: Number.MAX_SAFE_INTEGER },
  }).reserved, true, "the migrated legacy schema accepts a new reservation");
  assert.equal(volume.status(migrationProject, { databasePath: legacyWithoutStateDatabase }).reservations.length, 1);
  volume.release(migrationInput, { databasePath: legacyWithoutStateDatabase, evidence: "owner-released-absent-target" });

  const legacyWithStateDatabase = path.join(fixtureRoot, "legacy-v1-with-state.sqlite");
  const legacyWithState = new DatabaseSync(legacyWithStateDatabase);
  legacyWithState.exec(`CREATE TABLE reservations (
    project_root TEXT NOT NULL, operation_id TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation > 0),
    target TEXT NOT NULL, volume_id TEXT NOT NULL, reserved_bytes INTEGER NOT NULL CHECK(reserved_bytes > 0),
    token_sha256 TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'reserved' CHECK(state='reserved'), created_at TEXT NOT NULL,
    PRIMARY KEY(project_root, operation_id, generation));
    CREATE INDEX reservations_by_volume ON reservations(volume_id);
    PRAGMA user_version=1;`);
  legacyWithState.close();
  assert.deepEqual(volume.initialize({ databasePath: legacyWithStateDatabase }), { registryPresent: true },
    "known v1 schema with state migrates without rebuilding the table");
  assert.deepEqual(volume.initialize({ databasePath: legacyWithStateDatabase }), { registryPresent: true },
    "current preflight accepts the known v1-with-state migration result");

  const rootA = project("owner-a"), rootB = project("owner-b");
  const available = 2 * 1024 ** 3 + 10_000;
  const requestBytes = 6000;
  const targetA = path.join(rootA, "pending-output"), targetB = path.join(rootB, "pending-output");
  const contenders = await Promise.all([
    childReserve(input(rootA, "operation-a", targetA, requestBytes), available, volumeId),
    childReserve(input(rootB, "operation-b", targetB, requestBytes), available, volumeId),
  ]);
  assert.equal(contenders.filter(item => item.reserved).length, 1, "separate project roots serialize reservations for one volume");
  assert.equal(contenders.filter(item => /Global volume admission refused/u.test(item.error || "")).length, 1,
    `the global free-space floor and active reservations admit only one contender: ${JSON.stringify(contenders)}`);
  const winner = contenders[0].reserved ? input(rootA, "operation-a", targetA, requestBytes) : input(rootB, "operation-b", targetB, requestBytes);
  const loser = contenders[0].reserved ? input(rootB, "operation-b", targetB, requestBytes) : input(rootA, "operation-a", targetA, requestBytes);
  const status = volume.status(winner.projectRoot);
  assert.equal(status.reservations.length, 1);
  assert.equal(Object.hasOwn(status.reservations[0], "token"), false, "status does not disclose owner tokens");
  assert.throws(() => volume.release({ ...winner, token: "wrong-token" }, { evidence: "owner-released-absent-target" }), /owner\/token fence rejected/u);
  assert.equal(volume.release(winner, { evidence: "owner-released-absent-target" }).released, true,
    "the owner can release a reservation after proving its target absent");
  const afterRelease = await childReserve(loser, available, volumeId);
  assert.equal(afterRelease.reserved, true, `the next project can reserve after an owner release: ${JSON.stringify(afterRelease)}`);

  const rawDatabase = fs.readFileSync(process.env.AGENT_STORAGE_COORDINATION_TEST_DB);
  assert.equal(rawDatabase.includes(Buffer.from(loser.token)), false, "the database stores only a token hash");
  assert.equal(volume.status(loser.projectRoot).reservations.length, 1);
  volume.release(loser, { evidence: "owner-released-absent-target" });

  const raceDatabase = path.join(fixtureRoot, "queued-admission.sqlite");
  volume.initialize({ databasePath: raceDatabase });
  const aRoot = project("queued-a"), bRoot = project("queued-b");
  const aTarget = path.join(aRoot, "pending-output"), bTarget = path.join(bRoot, "pending-output");
  const raceVolume = { id: "fixture-host:queued-volume", availableBytes: 2 * 1024 ** 3 + 10_000 };
  const prior = input(aRoot, "published-a", aTarget, 8000, "private-a-token");
  volume.reserve(prior, { databasePath: raceDatabase, volumeIdentity: raceVolume });
  const blocker = new DatabaseSync(raceDatabase, { timeout: 5000 });
  blocker.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;");
  const capacityPath = path.join(fixtureRoot, "queued-capacity.json");
  const premeasurePath = path.join(fixtureRoot, "queued-premeasure.marker");
  fs.writeFileSync(capacityPath, JSON.stringify({ id: raceVolume.id, availableBytes: raceVolume.availableBytes }));
  const reserveScript = `const fs=require('node:fs');const r=require(${JSON.stringify(path.resolve(__dirname, "lib/storage-volume-registry.js"))});const input=JSON.parse(process.argv[1]),measurements=[],opts={databasePath:process.argv[2],measureVolume:(target,{locked})=>{measurements.push(locked?'locked':'preliminary');if(!locked)fs.writeFileSync(process.argv[4],'premeasured');return JSON.parse(fs.readFileSync(process.argv[3],'utf8'))}};try{process.stdout.write(JSON.stringify({result:r.reserve(input,opts),measurements}))}catch(error){process.stdout.write(JSON.stringify({error:error.message,measurements}))}`;
  const queued = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", reserveScript, JSON.stringify(input(bRoot, "queued-b", bTarget, 2000, "private-b-token")), raceDatabase, capacityPath, premeasurePath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`queued reservation child exited ${code}: ${stderr}`)));
  });
  await waitForFile(premeasurePath);
  await delay(200);
  fs.writeFileSync(capacityPath, JSON.stringify({ id: raceVolume.id, availableBytes: 2 * 1024 ** 3 + 1000 }));
  blocker.prepare("DELETE FROM reservations WHERE project_root=? AND operation_id=? AND generation=1").run(prior.projectRoot, prior.id);
  blocker.exec("COMMIT");
  blocker.close();
  const queuedResult = await queued;
  assert.match(queuedResult.error || "", /Global volume admission refused/u,
    "a queued claimant uses the lower availability measured after it acquires BEGIN IMMEDIATE");
  assert.deepEqual(queuedResult.measurements, ["preliminary", "locked"]);
  process.stdout.write("storage-volume-registry: focused global admission checks passed\n");
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
