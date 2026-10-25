"use strict";

// Real cross-process admission scenario. The parent owns when this live check runs.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const base = process.env.AGENT_RUN_COPY_DIR || process.env.AGENT_RUN_OUTPUT;
if (!base) throw new Error("Run this test through managed-temp so fixtures stay in its owned output");
const fixtureRoot = path.join(base, "storage-volume-live-fixtures");
fs.mkdirSync(fixtureRoot, { recursive: true });
process.env.AGENT_STORAGE_COORDINATION_TEST_DB = path.join(fixtureRoot, "global-registry.sqlite");
const volume = require("./lib/storage-volume-registry.js");
const operations = require("./lib/storage-operation-registry.js");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");

function makeProject(name) {
  const root = path.join(fixtureRoot, name);
  fs.mkdirSync(root, { recursive: true });
  const source = path.join(root, "source.bin");
  fs.writeFileSync(source, "small immutable source");
  return { root, source };
}
function spawnClaim(project, suffix, reserveBytes, barrierPath) {
  const modulePath = path.resolve(__dirname, "lib/storage-operation-registry.js");
  const script = `const fs=require('node:fs');const r=require(${JSON.stringify(modulePath)});const root=process.argv[1],input=JSON.parse(process.argv[2]),barrier=process.argv[3];const wait=()=>new Promise(resolve=>{const poll=()=>fs.existsSync(barrier)?resolve():setTimeout(poll,10);poll()});wait().then(()=>{try{process.stdout.write(JSON.stringify(r.claim(root,input)))}catch(error){process.stdout.write(JSON.stringify({error:error.message}))}})`;
  const input = {
    source: project.source, digest: digest(suffix), purpose: "cross-project-volume-live", target: path.join(project.root, "target"),
    reserveBytes, session: `live-session-${suffix}`, request: `live-request-${suffix}`,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script, project.root, JSON.stringify(input), barrierPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve({ input, result: JSON.parse(stdout) }) : reject(new Error(`claim child exited ${code}: ${stderr}`)));
  });
}
function publishTiny(project, claim, input) {
  fs.mkdirSync(claim.target);
  fs.writeFileSync(path.join(claim.target, "verified.txt"), "verified");
  return operations.publish(project.root, {
    ...claim, ...input,
    manifest: [{ path: "verified.txt", size: 8, sha256: digest("verified") }],
  });
}

async function main() {
  const a = makeProject("проект-a space"), b = makeProject("проект-b space");
  const targetA = path.join(a.root, "target"), targetB = path.join(b.root, "target");
  const identityA = volume.resolveVolume(targetA), identityB = volume.resolveVolume(targetB);
  assert.equal(identityA.id, identityB.id, "the live fixtures must resolve to the same host and volume identity");
  const budget = identityA.availableBytes - volume.MIN_FREE_BYTES;
  assert.ok(budget >= 10, "the measured volume must have headroom above the fixed floor");
  const reserveBytes = Math.floor(budget * 0.6);
  assert.ok(reserveBytes > 0);
  volume.initialize();

  const barrier = path.join(fixtureRoot, "start-claims");
  const pending = [
    spawnClaim(a, "project-a", reserveBytes, barrier),
    spawnClaim(b, "project-b", reserveBytes, barrier),
  ];
  fs.writeFileSync(barrier, "go");
  const results = await Promise.all(pending);
  assert.equal(results.filter(item => item.result.state === "writer").length, 1, "only one real child process receives a writer claim");
  assert.equal(results.filter(item => /Global volume admission refused/u.test(item.result.error || "")).length, 1,
    "the other project is refused by the measured shared-volume budget");
  const winner = results.find(item => item.result.state === "writer");
  const loser = results.find(item => item.result.error);
  const winnerProject = winner.input.session.endsWith("project-a") ? a : b;
  const loserProject = winnerProject === a ? b : a;
  const published = publishTiny(winnerProject, winner.result, winner.input);
  assert.equal(published.published, true);
  assert.equal(published.volumeReservationReleased, true, "verified ready publication releases global capacity");
  const loserRetry = operations.claim(loserProject.root, loser.input);
  assert.equal(loserRetry.state, "writer", "the refused project can claim after the winner releases its reservation");

  const crashProject = makeProject("crash-after-external-commit");
  const crashInput = { source: crashProject.source, digest: digest("claim-with-private-pending-token"), purpose: "crash-recovery-live",
    target: path.join(crashProject.root, "never-created"), reserveBytes: 1, session: "pending-owner", request: "pending-request" };
  const operationModulePath = path.resolve(__dirname, "lib/storage-operation-registry.js");
  const crashScript = `const r=require(${JSON.stringify(operationModulePath)});r.claim(process.argv[1],JSON.parse(process.argv[2]),{volumeOptions:{afterExternalReservation:()=>process.exit(73)}})`;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", crashScript, crashProject.root, JSON.stringify(crashInput)], { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", code => code === 73 ? resolve() : reject(new Error(`claim crash fixture exited ${code}; expected injected exit 73`)));
  });
  const afterCrash = volume.status(crashProject.root);
  assert.equal(afterCrash.reservations.length, 1, "a real claim process crash leaves its precommitted volume reservation");
  assert.equal(Object.hasOwn(afterCrash.reservations[0], "token"), false, "public status never reveals the token recovered from the private project journal");
  const pendingStatus = operations.status(crashProject.root);
  assert.equal(pendingStatus.pendingClaims.length, 1, "the project journal retains bounded recovery metadata after the crash");
  assert.equal(Object.hasOwn(pendingStatus.pendingClaims[0], "token"), false, "project status omits the private pending token");
  assert.throws(() => operations.reconcile(crashProject.root, { ...crashInput, id: afterCrash.reservations[0].id, generation: 1, token: "wrong-token" }), /owner\/token fence rejected/u);
  const recovered = operations.claim(crashProject.root, crashInput);
  assert.equal(recovered.state, "writer", "a fresh claim recovers the durable owner token after the external-commit crash");
  assert.equal(operations.status(crashProject.root).pendingClaims.length, 0);
  process.stdout.write("storage-volume-live: real cross-project admission and conservative crash retention passed\n");
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
