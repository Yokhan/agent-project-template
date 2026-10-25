"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const base = process.env.AGENT_RUN_COPY_DIR || process.env.AGENT_RUN_OUTPUT;
if (!base) throw new Error("Run this test through managed-temp so fixtures stay in its owned output");
const fixtureRoot = path.join(base, "storage-registry-fixtures");
fs.mkdirSync(fixtureRoot, { recursive: true });
process.env.AGENT_STORAGE_COORDINATION_TEST_DB = path.join(fixtureRoot, "global-volume-registry.sqlite");
process.env.AGENT_STORAGE_COORDINATION_TEST_VOLUME_ID = "fixture-host:fixture-volume";
process.env.AGENT_STORAGE_COORDINATION_TEST_AVAILABLE_BYTES = String(Number.MAX_SAFE_INTEGER);
const registry = require("./lib/storage-operation-registry.js");
const cli = path.resolve(__dirname, "storage-operation.js");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const waitForFile = async (file, timeoutMs = 10000) => {
  const started = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for child marker: ${path.basename(file)}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
function resetGlobalRegistry() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(`${process.env.AGENT_STORAGE_COORDINATION_TEST_DB}${suffix}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
const newProject = name => {
  const root = path.join(fixtureRoot, name);
  fs.mkdirSync(root, { recursive: true });
  const source = path.join(root, "source.bin");
  fs.writeFileSync(source, "immutable source bytes");
  return { root, source };
};
function childClaim(root, input, name, availableBytes) {
  const script = `const r=require(${JSON.stringify(path.resolve(__dirname, "lib/storage-operation-registry.js"))});const x=r.claim(process.argv[1],JSON.parse(process.argv[2]),{availableBytes:Number(process.argv[3])});process.stdout.write(JSON.stringify(x));`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script, root, JSON.stringify(input), String(availableBytes)], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : resolve({ error: stderr, exitCode: code }));
  });
}
function childStatus(root) {
  const script = `const r=require(${JSON.stringify(path.resolve(__dirname, "lib/storage-operation-registry.js"))});process.stdout.write(JSON.stringify(r.status(process.argv[1])));`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script, root], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`status exited ${code}: ${stderr}`)));
  });
}
function childClaimAtHook(root, input, hook, marker, resume, exitCode) {
  const script = `const fs=require('node:fs');const r=require(${JSON.stringify(path.resolve(__dirname, "lib/storage-operation-registry.js"))});const input=JSON.parse(process.argv[2]),hook=process.argv[3],marker=process.argv[4],resume=process.argv[5],exitCode=Number(process.argv[6]);const volumeOptions={};volumeOptions[hook]=()=>{if(exitCode){process.exit(exitCode)}fs.writeFileSync(marker,'ready');const cell=new Int32Array(new SharedArrayBuffer(4));while(!fs.existsSync(resume))Atomics.wait(cell,0,0,10)};try{process.stdout.write(JSON.stringify(r.claim(process.argv[1],input,{volumeOptions})))}catch(error){process.stdout.write(JSON.stringify({error:error.message}))}`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script, root, JSON.stringify(input), hook, marker, resume, String(exitCode || 0)], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => resolve({ code, output: stdout ? JSON.parse(stdout) : null, stderr }));
  });
}
function cliOp(command, root, input, name) {
  const json = path.join(fixtureRoot, `${name}.json`);
  fs.writeFileSync(json, JSON.stringify(input));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, command, "--root", root, "--input", json], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}
function opInput(project, suffix, target, reserveBytes = 1024) {
  return { source: project.source, digest: digest(suffix), purpose: "test-output", target, reserveBytes, session: `session-${suffix}`, request: `request-${suffix}` };
}
const testClaim = (root, input) => registry.claim(root, input, { availableBytes: Number.MAX_SAFE_INTEGER });
const claimDiagnostics = results => results.map(({ token, ...result }) => result);

async function main() {
  const absent = newProject("absent-status");
  const beforeStatus = registry.status(absent.root);
  assert.equal(beforeStatus.registryPresent, false);
  assert.equal(fs.existsSync(registry.registryPath(absent.root)), false, "read-only status must not create a registry");

  const sharedDatabase = process.env.AGENT_STORAGE_COORDINATION_TEST_DB;
  process.env.AGENT_STORAGE_COORDINATION_TEST_DB = path.join(fixtureRoot, "first-claim-global-volume-registry.sqlite");
  const firstClaimsProject = newProject("first-ever-global-concurrent-claims");
  const firstClaims = await Promise.all(Array.from({ length: 5 }, (_, index) => childClaim(firstClaimsProject.root,
    opInput(firstClaimsProject, `first-global-${index}`, path.join(firstClaimsProject.root, `out-${index}`)), `first-global-${index}`, Number.MAX_SAFE_INTEGER)));
  assert.equal(firstClaims.filter(item => item.state === "writer").length, 5,
    `first-ever global registry initialization preserves unrelated concurrent claims; child results: ${JSON.stringify(claimDiagnostics(firstClaims))}`);
  assert.equal(registry.status(firstClaimsProject.root).volumeAdmission.reservations.length, 5,
    "all five first-use claims retain their committed global reservations");
  process.env.AGENT_STORAGE_COORDINATION_TEST_DB = sharedDatabase;

  const initializing = newProject("initializing-status");
  const registryFile = registry.registryPath(initializing.root);
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  const sqlite = require("node:sqlite").DatabaseSync;
  const initializer = new sqlite(registryFile);
  initializer.exec("BEGIN IMMEDIATE; CREATE TABLE uncommitted_init_marker(value TEXT)");
  const initializingStatus = await childStatus(initializing.root);
  assert.equal(initializingStatus.initializing, true, "status observes an atomic schema initialization in progress");
  assert.deepEqual(initializingStatus.operations, [], "initializing status does not read partial tables");
  initializer.exec("ROLLBACK");
  initializer.close();
  assert.equal(testClaim(initializing.root, opInput(initializing, "init-complete", path.join(initializing.root, "output"))).state, "writer",
    "the writer initializes the schema after the incomplete transaction rolls back");

  const same = newProject("same-resource");
  const target = path.join(same.root, "output");
  const contenders = await Promise.all(Array.from({ length: 5 }, (_, index) => childClaim(same.root, opInput(same, "shared", target), `same-${index}`, Number.MAX_SAFE_INTEGER)));
  assert.equal(contenders.filter(item => item.state === "writer").length, 1, "one concurrent writer owns the resource");
  assert.equal(contenders.filter(item => item.state === "busy").length, 4, `other clients observe the current writer: ${JSON.stringify(claimDiagnostics(contenders))}`);
  const writer = contenders.find(item => item.state === "writer");
  assert.equal(registry.status(same.root).volumeAdmission.reservations[0].id, writer.id,
    "the external volume reservation is committed before a writer is returned");
  const alternateTarget = path.join(same.root, "output-r2");
  const duplicateWriter = testClaim(same.root, opInput(same, "shared", alternateTarget));
  assert.equal(duplicateWriter.state, "busy", "same resource key cannot create a second revision target");
  assert.equal(duplicateWriter.target, target, "busy result points at the existing writer target");
  const fenced = { id: writer.id, generation: writer.generation, token: writer.token, session: "wrong-session", request: "wrong-request" };
  assert.throws(() => registry.abandon(same.root, fenced), /owner mismatch/u);
  assert.throws(() => registry.release(same.root, fenced), /owner mismatch/u);

  fs.mkdirSync(target);
  const output = path.join(target, "payload.txt");
  fs.writeFileSync(output, "verified output");
  const manifest = [{ path: "payload.txt", size: Buffer.byteLength("verified output"), sha256: digest("verified output") }];
  const publishInput = { ...writer, ...opInput(same, "shared", target), manifest };
  const published = await cliOp("publish", same.root, publishInput, "publish-ready");
  assert.equal(published.published, true);
  assert.equal(published.volumeReservationReleased, true, "verified publication releases its global reservation");
  assert.equal(registry.status(same.root).volumeAdmission.reservations.length, 0);
  const reuse = testClaim(same.root, opInput(same, "shared", target));
  assert.equal(reuse.state, "reuse");
  const duplicateReuse = testClaim(same.root, opInput(same, "shared", alternateTarget));
  assert.equal(duplicateReuse.state, "reuse", "same resource key reuses the existing ready target across revision paths");
  assert.equal(duplicateReuse.target, target);
  fs.writeFileSync(output, "tampered output");
  assert.throws(() => testClaim(same.root, opInput(same, "shared", target)), /Manifest mismatch/u);
  fs.writeFileSync(output, "verified output");

  const independent = newProject("independent");
  const independentClaims = await Promise.all(Array.from({ length: 5 }, (_, index) => childClaim(independent.root,
    opInput(independent, `independent-${index}`, path.join(independent.root, `out-${index}`)), `independent-${index}`, Number.MAX_SAFE_INTEGER)));
  assert.equal(independentClaims.filter(item => item.state === "writer").length, 5,
    `unrelated concurrent claims are preserved; child results: ${JSON.stringify(claimDiagnostics(independentClaims))}`);
  const scopedStatus = registry.status(independent.root, { owner: "session-independent-0", request: "request-independent-0" });
  assert.equal(scopedStatus.operations.length, 5, "status exposes bounded global resources to each caller");
  assert.equal(scopedStatus.unfinishedWrites.length, 1, "unfinished writes are scoped to the current owner and request");
  assert.equal(Object.hasOwn(scopedStatus.operations[0], "token"), false, "status never exposes fencing tokens");
  const protectPath = path.join(independent.root, "legacy");
  fs.mkdirSync(protectPath);
  const [protectionA, protectionB] = await Promise.all([
    cliOp("protect", independent.root, { path: protectPath, reason: "legacy-reference", session: "owner-a", request: "protect-a" }, "protect-a"),
    cliOp("protect", independent.root, { path: protectPath, reason: "legacy-reference", session: "owner-b", request: "protect-b" }, "protect-b"),
  ]);
  assert.notEqual(protectionA.id, protectionB.id, "concurrent owners retain distinct protection identities");
  assert.notEqual(protectionA.token, protectionB.token, "concurrent owners receive distinct release tokens");
  assert.equal(registry.status(independent.root).protections.length, 2);
  assert.equal(registry.release(independent.root, { protectionId: protectionA.id, token: protectionA.token, session: "owner-a", request: "protect-a" }).released, true);
  const protectionStatus = registry.status(independent.root);
  assert.equal(protectionStatus.protections.length, 1, "releasing owner A preserves owner B's protection");
  assert.equal(protectionStatus.protections[0].id, protectionB.id);
  const protectedPath = protectionB;
  assert.throws(() => testClaim(independent.root, opInput(independent, "protected-descendant", path.join(protectPath, "child"))), /pinned or protected/u);
  const protectedSourceRead = testClaim(independent.root, {
    ...opInput(independent, "protected-source-read", path.join(independent.root, "derived-from-legacy")), source: protectPath,
  });
  assert.equal(protectedSourceRead.state, "writer", "a protected path remains readable as a source");
  const pin = registry.pin(independent.root, { path: protectPath, session: "owner", request: "pin" });
  assert.equal(registry.status(independent.root).pins.length, 2, "status pins include explicit protection registrations");
  assert.equal(registry.status(independent.root).protections.length, 1);
  assert.throws(() => registry.release(independent.root, { protectionId: protectedPath.id, token: protectedPath.token, session: "owner-a", request: "protect-a" }), /owner fence rejected/u);
  assert.equal(registry.status(independent.root).protections.length, 1, "another owner cannot release a protection");
  const concurrentPins = await Promise.all(Array.from({ length: 5 }, (_, index) => cliOp("pin", independent.root,
    { path: protectPath, session: `pin-owner-${index}`, request: `pin-request-${index}` }, `pin-${index}`)));
  assert.equal(concurrentPins.filter(result => result.pinned).length, 5, "unrelated concurrent pins are preserved");
  const db = new sqlite(registry.registryPath(independent.root));
  db.prepare("UPDATE protections SET created_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(protectedPath.id);
  db.close();
  assert.equal(registry.status(independent.root).protections.length, 1, "old protection timestamps do not expire protection");

  const overlap = newProject("source-target-overlap");
  const sourceDirectory = path.join(overlap.root, "input-tree");
  fs.mkdirSync(sourceDirectory);
  fs.writeFileSync(path.join(sourceDirectory, "input.txt"), "input");
  assert.throws(() => testClaim(overlap.root, { ...opInput(overlap, "overlap-inside", path.join(sourceDirectory, "output")), source: sourceDirectory }), /must not overlap/u);
  assert.throws(() => testClaim(overlap.root, { ...opInput(overlap, "overlap-parent", sourceDirectory), source: path.join(sourceDirectory, "input.txt") }), /must not overlap/u);

  if (process.platform === "win32") {
    const caseProject = newProject("windows-case-collision");
    const upperTarget = path.join(caseProject.root, "CaseTarget");
    const lowerTarget = path.join(caseProject.root, "casetarget");
    const firstCaseClaim = testClaim(caseProject.root, opInput(caseProject, "case-first", upperTarget));
    assert.equal(firstCaseClaim.state, "writer");
    assert.throws(() => testClaim(caseProject.root, opInput(caseProject, "case-second", lowerTarget)), /overlaps/u);
    const aliasSource = caseProject.source.toUpperCase();
    const sourceAliasClaim = testClaim(caseProject.root, { ...opInput(caseProject, "case-first", path.join(caseProject.root, "another-target")), source: aliasSource });
    assert.equal(sourceAliasClaim.state, "busy", "drive and case aliases resolve to the same source identity");
  }

  const traversal = { ...opInput(independent, "traversal", path.join(independent.root, "bad")), source: independent.source };
  const traversalClaim = testClaim(independent.root, traversal);
  fs.mkdirSync(traversal.target);
  assert.throws(() => registry.publish(independent.root, { ...traversalClaim, session: traversal.session, request: traversal.request, manifest: [{ path: "../escape", size: 1, sha256: digest("x") }] }), /Invalid manifest path/u);
  const linkPath = path.join(traversal.target, "linked");
  try {
    fs.symlinkSync(independent.source, linkPath, "file");
    assert.throws(() => registry.publish(independent.root, { ...traversalClaim, session: traversal.session, request: traversal.request, manifest: [] }), /link or special/u);
  } catch (error) {
    if (error.code !== "EPERM" && error.code !== "EACCES") throw error;
  }

  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(`${process.env.AGENT_STORAGE_COORDINATION_TEST_DB}${suffix}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const legacyDebt = newProject("legacy-admission-debt");
  const legacyFile = registry.registryPath(legacyDebt.root);
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  const legacyDb = new (require("node:sqlite").DatabaseSync)(legacyFile);
  legacyDb.exec(`CREATE TABLE operations (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, source_key TEXT NOT NULL, digest TEXT NOT NULL, purpose TEXT NOT NULL,
    target TEXT NOT NULL, target_key TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('writing','ready','abandoned')),
    session TEXT NOT NULL, request TEXT NOT NULL, token TEXT NOT NULL, generation INTEGER NOT NULL,
    manifest TEXT, reserved_bytes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(source_key,digest,purpose), UNIQUE(target_key));
    CREATE TABLE protections (id TEXT PRIMARY KEY,path TEXT NOT NULL,reason TEXT NOT NULL,session TEXT NOT NULL,request TEXT NOT NULL,token TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE pins (id TEXT PRIMARY KEY,resource_id TEXT,path TEXT NOT NULL,session TEXT NOT NULL,request TEXT NOT NULL,token TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE registry_meta (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
    INSERT INTO registry_meta(id,revision) VALUES(1,0);
    CREATE TRIGGER operations_insert_revision AFTER INSERT ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER operations_update_revision AFTER UPDATE ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    CREATE TRIGGER operations_delete_revision AFTER DELETE ON operations BEGIN UPDATE registry_meta SET revision=revision+1 WHERE id=1; END;
    PRAGMA user_version=1;`);
  const legacyTarget = path.join(legacyDebt.root, "old-target");
  const legacyIds = [];
  for (const [state, suffix] of [["writing", "legacy-writing"], ["abandoned", "legacy-abandoned"]]) {
    const target = path.join(legacyDebt.root, `${suffix}-target`), sourceIdentity = fs.realpathSync.native(legacyDebt.source);
    const targetIdentity = path.resolve(target), sourceKey = process.platform === "win32" ? sourceIdentity.toLocaleLowerCase("en-US") : sourceIdentity;
    const targetKey = process.platform === "win32" ? targetIdentity.toLocaleLowerCase("en-US") : targetIdentity;
    const id = crypto.randomUUID(), now = new Date().toISOString();
    legacyIds.push(id);
    legacyDb.prepare("INSERT INTO operations(id,source,source_key,digest,purpose,target,target_key,state,session,request,token,generation,reserved_bytes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, sourceIdentity, sourceKey, digest(suffix), "legacy-debt", target, targetKey, state, `session-${suffix}`, `request-${suffix}`, crypto.randomUUID(), 1, 1200, now, now);
  }
  legacyDb.close();
  assert.equal(registry.status(legacyDebt.root).pendingClaims.length, 0);
  const beforeMigration = new (require("node:sqlite").DatabaseSync)(legacyFile, { readOnly: true });
  assert.equal(beforeMigration.prepare("PRAGMA user_version").get().user_version, 1, "read-only status does not migrate a legacy project database");
  beforeMigration.close();
  const newDebtClaim = opInput(legacyDebt, "new-digest-after-legacy-debt", legacyTarget, 1);
  assert.throws(() => registry.claim(legacyDebt.root, newDebtClaim, { availableBytes: 2 * 1024 ** 3 + 1000 }),
    /Global volume admission refused/u, "existing project debt blocks a different new digest when the volume has no headroom");
  const legacyVolumeStatus = registry.status(legacyDebt.root).volumeAdmission;
  assert.equal(legacyVolumeStatus.reservations.length, 2, "writing and abandoned rows are backfilled before a new claim");
  assert.deepEqual(new Set(legacyVolumeStatus.reservations.map(row => row.id)), new Set(legacyIds));
  const afterMigration = new (require("node:sqlite").DatabaseSync)(legacyFile, { readOnly: true });
  assert.equal(afterMigration.prepare("PRAGMA user_version").get().user_version, 2, "the first claim safely adds the private recovery journal");
  afterMigration.close();
  resetGlobalRegistry();

  const unfunded = newProject("unfunded-pending-intent");
  const unfundedInput = opInput(unfunded, "pending-intent", path.join(unfunded.root, "pending-target"), 1);
  const beforeGlobal = await childClaimAtHook(unfunded.root, unfundedInput, "beforeExternalReservation",
    path.join(fixtureRoot, "unfunded-before-global"), path.join(fixtureRoot, "unused-resume"), 72);
  assert.equal(beforeGlobal.code, 72, "the child stops after durable intent but before global admission");
  assert.equal(registry.status(unfunded.root).operations.length, 0);
  assert.equal(registry.status(unfunded.root).pendingClaims.length, 1);
  assert.equal(registry.status(unfunded.root).volumeAdmission.reservations.length, 0);
  const floorOnly = { availableBytes: 2 * 1024 ** 3 };
  assert.throws(() => registry.claim(unfunded.root, unfundedInput, floorOnly), /Global volume admission refused/u,
    "an intent-only row cannot be promoted when normal admission cannot fund it");
  const unrelatedUnfunded = opInput(unfunded, "unrelated-intent", path.join(unfunded.root, "unrelated-target"), 1);
  assert.throws(() => registry.claim(unfunded.root, unrelatedUnfunded, floorOnly), /Global volume admission refused/u,
    "a different claim does not import an unfunded pending intent as over-capacity debt");
  assert.equal(registry.status(unfunded.root).operations.length, 0);
  assert.equal(registry.status(unfunded.root).volumeAdmission.reservations.length, 0);
  resetGlobalRegistry();

  const fundedPending = newProject("funded-pending-owner-fence");
  const fundedInput = opInput(fundedPending, "funded-pending", path.join(fundedPending.root, "target"), 40);
  const fundedCrash = await childClaimAtHook(fundedPending.root, fundedInput, "afterExternalReservation",
    path.join(fixtureRoot, "funded-before-promotion"), path.join(fixtureRoot, "unused-resume-2"), 73);
  assert.equal(fundedCrash.code, 73, "the child stops after the external reservation commit");
  const wrongOwner = { ...fundedInput, session: `${fundedInput.session}-wrong`, request: `${fundedInput.request}-wrong` };
  assert.equal(registry.claim(fundedPending.root, wrongOwner, { availableBytes: Number.MAX_SAFE_INTEGER }).state, "busy",
    "a wrong owner cannot promote or consume the funded pending grant");
  assert.equal(registry.status(fundedPending.root).operations.length, 0);
  const wrongBytes = { ...fundedInput, reserveBytes: fundedInput.reserveBytes + 1 };
  assert.equal(registry.claim(fundedPending.root, wrongBytes, { availableBytes: Number.MAX_SAFE_INTEGER }).state, "busy",
    "a byte-count mismatch cannot claim the funded pending row");
  const wrongTarget = { ...fundedInput, target: path.join(fundedPending.root, "alternate-target") };
  assert.equal(registry.claim(fundedPending.root, wrongTarget, { availableBytes: Number.MAX_SAFE_INTEGER }).state, "busy",
    "a target mismatch cannot claim the funded pending row");
  const boundedAvailable = { availableBytes: 2 * 1024 ** 3 + 50 };
  const wrongDigest = opInput(fundedPending, "different-digest", path.join(fundedPending.root, "different-digest-target"), 20);
  assert.throws(() => registry.claim(fundedPending.root, wrongDigest, boundedAvailable), /Global volume admission refused/u,
    "a different digest must make a separately funded claim rather than adopt the pending token");
  const wrongPurpose = { ...opInput(fundedPending, "funded-pending", path.join(fundedPending.root, "different-purpose-target"), 20), purpose: "different-purpose" };
  assert.throws(() => registry.claim(fundedPending.root, wrongPurpose, boundedAvailable), /Global volume admission refused/u,
    "a different purpose must make a separately funded claim rather than adopt the pending token");
  assert.equal(registry.status(fundedPending.root).operations.length, 0);
  assert.equal(registry.status(fundedPending.root).pendingClaims.length, 3, "failed unrelated intents remain private and unfunded");
  assert.equal(registry.status(fundedPending.root).volumeAdmission.reservations.length, 1);
  const recoveredFunded = registry.claim(fundedPending.root, fundedInput, { availableBytes: Number.MAX_SAFE_INTEGER });
  assert.equal(recoveredFunded.state, "writer", "the exact owner recovers its fully fenced funded intent");
  assert.equal(registry.status(fundedPending.root).pendingClaims.length, 2);
  resetGlobalRegistry();

  for (const [label, winner] of [["recovery-wins", "retry"], ["original-wins", "original"]]) {
    const race = newProject(`grant-cas-${label}`);
    const raceInput = opInput(race, `grant-cas-${label}`, path.join(race.root, "target"), 100);
    const entered = path.join(fixtureRoot, `${label}-external-committed`), resume = path.join(fixtureRoot, `${label}-resume-original`);
    const original = childClaimAtHook(race.root, raceInput, "afterExternalReservation", entered, resume, 0);
    await waitForFile(entered);
    if (winner === "retry") {
      const retry = registry.claim(race.root, raceInput, { availableBytes: Number.MAX_SAFE_INTEGER });
      assert.equal(retry.state, "writer", "the matching retry can recover a funded intent and consume its grant");
      fs.writeFileSync(resume, "resume");
      const resumedOriginal = await original;
      assert.equal(resumedOriginal.code, 0);
      assert.equal(resumedOriginal.output.state, "busy", "the resumed original cannot issue a second writer after CAS consumption");
    } else {
      fs.writeFileSync(resume, "resume");
      const originalResult = await original;
      assert.equal(originalResult.code, 0);
      assert.equal(originalResult.output.state, "writer", "the original may win the shared grant CAS");
      const retry = registry.claim(race.root, raceInput, { availableBytes: Number.MAX_SAFE_INTEGER });
      assert.equal(retry.state, "busy", "a later retry is busy after the original consumed the grant");
    }
    resetGlobalRegistry();
  }

  const lostReply = newProject("grant-committed-response-lost");
  const lostReplyInput = opInput(lostReply, "grant-response-lost", path.join(lostReply.root, "target"), 100);
  const grantCrash = await childClaimAtHook(lostReply.root, lostReplyInput, "afterWriterGrant",
    path.join(fixtureRoot, "unused-grant-marker"), path.join(fixtureRoot, "unused-grant-resume"), 74);
  assert.equal(grantCrash.code, 74, "the child exits after grant CAS commit without delivering its response");
  const statusBeforeRetry = registry.status(lostReply.root);
  const revisionBeforeRetry = statusBeforeRetry.revision;
  const lostReplyRetry = registry.claim(lostReply.root, lostReplyInput, { availableBytes: Number.MAX_SAFE_INTEGER });
  assert.equal(lostReplyRetry.state, "busy", "an issued but undelivered one-time grant is never reissued");
  const statusAfterRetry = registry.status(lostReply.root);
  assert.equal(statusAfterRetry.revision, revisionBeforeRetry, "status and a busy retry do not mutate the grant state");
  assert.equal(statusAfterRetry.operations[0].state, "writing");
  assert.equal(statusAfterRetry.volumeAdmission.reservations.length, 1, "the reservation remains until explicit owner reconciliation");
  const ownerReconciled = registry.reconcile(lostReply.root, { id: statusAfterRetry.operations[0].id,
    generation: statusAfterRetry.operations[0].generation, session: lostReplyInput.session, request: lostReplyInput.request });
  assert.equal(ownerReconciled.released, true, "explicit owner-fenced reconciliation can clear an absent-target lost reply");
  resetGlobalRegistry();

  const budget = newProject("space-admission");
  const available = 2 * 1024 ** 3 + 1000;
  const reservation = 700;
  const admitted = await Promise.all(Array.from({ length: 5 }, (_, index) => childClaim(budget.root,
    opInput(budget, `budget-${index}`, path.join(budget.root, `budget-out-${index}`), reservation), `budget-${index}`, available)));
  assert.equal(admitted.filter(item => item.state === "writer").length, 1, `concurrent reservations honor one shared available-space fixture: ${JSON.stringify(claimDiagnostics(admitted))}`);
  assert.equal(admitted.filter(item => item.state === "busy").length, 0);
  assert.equal(admitted.filter(item => item.error).length, 4);
  assert.equal(registry.status(budget.root).operations.length, 1);

  const missingReserve = newProject("missing-reservation");
  const noReserveInput = opInput(missingReserve, "no-reserve", path.join(missingReserve.root, "target"));
  delete noReserveInput.reserveBytes;
  assert.throws(() => testClaim(missingReserve.root, noReserveInput), /positive safe integer/u);

  const boundedTargets = newProject("bounded-targets");
  assert.throws(() => testClaim(boundedTargets.root, opInput(boundedTargets, "outside-project", path.join(fixtureRoot, "outside-target"))), /descendants of the project root/u);
  assert.throws(() => testClaim(boundedTargets.root,
    opInput(boundedTargets, "registry-overlap", path.join(boundedTargets.root, ".session-cache", "storage-operations", "output"))), /overlap the registry directory/u);

  const oversize = newProject("oversized-publish");
  const oversizeTarget = path.join(oversize.root, "output");
  const oversizeInput = opInput(oversize, "oversize", oversizeTarget, 2);
  const oversizeWriter = testClaim(oversize.root, oversizeInput);
  fs.mkdirSync(oversizeTarget);
  fs.writeFileSync(path.join(oversizeTarget, "too-large.txt"), "three");
  assert.throws(() => registry.release(oversize.root, { ...oversizeWriter, session: oversizeInput.session, request: oversizeInput.request }), /target still exists/u,
    "a writing reservation cannot be released while output remains");
  assert.equal(registry.status(oversize.root).unfinishedWrites[0].id, oversizeWriter.id, "failed release retains the writer and its reservation");
  assert.throws(() => registry.publish(oversize.root, { ...oversizeWriter, ...oversizeInput,
    manifest: [{ path: "too-large.txt", size: 5, sha256: digest("three") }] }), /exceeds its reserved peak bytes/u);
  registry.abandon(oversize.root, { ...oversizeWriter, session: oversizeInput.session, request: oversizeInput.request });
  assert.equal(registry.status(oversize.root).volumeAdmission.reservations.length, 1,
    "abandonment keeps global capacity reserved until the owner confirms the target is absent");
  assert.throws(() => registry.release(oversize.root, { ...oversizeWriter, session: oversizeInput.session, request: oversizeInput.request }), /target still exists/u);
  fs.rmSync(oversizeTarget, { recursive: true });
  assert.equal(registry.release(oversize.root, { ...oversizeWriter, session: oversizeInput.session, request: oversizeInput.request }).released, true,
    "owner can release an abandoned reservation after confirming the target is absent");
  assert.equal(registry.status(oversize.root).volumeAdmission.reservations.length, 0);

  const abandonedNoTarget = newProject("abandoned-no-target");
  const absentTargetInput = opInput(abandonedNoTarget, "abandoned-absent", path.join(abandonedNoTarget.root, "never-created"));
  const absentTargetWriter = testClaim(abandonedNoTarget.root, absentTargetInput);
  registry.abandon(abandonedNoTarget.root, { ...absentTargetWriter, session: absentTargetInput.session, request: absentTargetInput.request });
  assert.equal(registry.release(abandonedNoTarget.root, { ...absentTargetWriter, session: absentTargetInput.session, request: absentTargetInput.request }).released, true,
    "abandoned reservation is releasable when no target was created");
  const writingNoTarget = newProject("writing-no-target");
  const writingNoTargetInput = opInput(writingNoTarget, "writing-absent", path.join(writingNoTarget.root, "never-created"));
  const writingNoTargetClaim = testClaim(writingNoTarget.root, writingNoTargetInput);
  assert.equal(registry.release(writingNoTarget.root, { ...writingNoTargetClaim, session: writingNoTargetInput.session, request: writingNoTargetInput.request }).released, true,
    "writing reservation is releasable only after confirming its target is absent");

  process.stdout.write("storage-operation-registry: all focused checks passed\n");
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
