#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const policy = require("./lib/codex-turn-policy.js");
const managed = require("./lib/managed-temp.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "managed-stop-scope-live-"));
const sessionA = "5618bf93-5df9-43ec-a07d-f6902ad712f8";
const sessionForeign = "4723524e-f2d5-4ac0-babe-49db2d3d2357";
const turns = {
  earlier: "254e60fd-f372-474e-9c47-60e60267507f",
  current: "96f66c1b-f11a-4b1d-9e4a-3b7903d2742b",
  foreign: "b87c9e18-49a5-4ad1-9065-cd7e6f511957",
};

function request(sessionId, turnId, prompt) {
  return policy.startRequest(fixture, { session_id: sessionId, turn_id: turnId, prompt }, {
    workflowDepth: "direct", delegationDecision: { required: false, state: "skip", reason: "fixture" },
  });
}

function retainedRun(record, { legacy = false, observedOnly = false } = {}) {
  const manager = path.join(__dirname, "lib/managed-temp.js");
  const source = [
    "const fs=require('fs'),path=require('path'),m=require(process.argv[1]);",
    "const env={...process.env,CODEX_SESSION_ID:process.argv[4]};delete env.AGENT_MANAGED_TEMP;delete env.AGENT_MANAGED_RUN_BINDING;",
    "const r=m.createRun(process.argv[2],{requestStatePath:process.argv[3]||undefined,env});",
    "r.retain('process-family-termination-unverified');",
    "const evidence=path.join(r.temp,'retained-evidence.txt');fs.writeFileSync(evidence,'protected fixture payload');",
    "if(process.argv[5]==='legacy'){const f=path.join(r.root,'.managed-temp-owner.json'),o=JSON.parse(fs.readFileSync(f,'utf8'));o.version=1;delete o.ownership;fs.writeFileSync(f,JSON.stringify(o)+'\\n');}",
    "console.log(JSON.stringify({runId:r.id,runRoot:r.root,evidence}));",
  ].join("");
  const result = spawnSync(process.execPath, ["-e", source, manager, fixture,
    observedOnly ? "" : record?.file || "", observedOnly ? sessionA : record.state.sessionId,
    legacy ? "legacy" : ""], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

function stop(record) {
  const engine = path.join(__dirname, "codex-hooks.js");
  const turnId = record.state.rootTurnId;
  const runSource = "const fs=require('fs'),e=require(process.argv[1]),input=JSON.parse(fs.readFileSync(0,'utf8'));e.handle(input,process.argv[2]).then(x=>process.stdout.write(JSON.stringify(x)+'\\n')).catch(err=>{console.error(err);process.exitCode=1});";
  const input = { hook_event_name: "Stop", cwd: fixture, session_id: record.state.sessionId,
    turn_id: turnId, prompt: record.state.task, last_assistant_message: "Готово." };
  const result = spawnSync(process.execPath, ["-e", runSource, engine, fixture], {
    input: JSON.stringify(input), encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

function markerExists(run) {
  return fs.existsSync(path.join(run.runRoot, '.managed-temp-owner.json')) &&
    fs.existsSync(run.evidence) && fs.readFileSync(run.evidence, 'utf8') === 'protected fixture payload';
}

try {
  const earlier = request(sessionA, turns.earlier, "Спасибо");
  const current = request(sessionA, turns.current, "Спасибо");
  const foreign = request(sessionForeign, turns.foreign, "Спасибо");
  const runs = {
    earlierSameSession: retainedRun(earlier),
    otherSession: retainedRun(foreign),
    legacy: retainedRun(null, { legacy: true, observedOnly: true }),
    sessionOnly: retainedRun(null, { observedOnly: true }),
  };

  const unrelated = stop(current);
  const unrelatedMarkers = Object.fromEntries(Object.entries(runs).map(([key, run]) => [key, markerExists(run)]));
  assert.notEqual(unrelated.decision, "block", "other and unknown project markers do not block an unrelated request");
  assert(Object.values(unrelatedMarkers).every(Boolean), "the unrelated Stop must preserve every observed marker");

  const ownEarlier = stop(earlier);
  const ownMarkers = Object.fromEntries(Object.entries(runs).map(([key, run]) => [key, markerExists(run)]));
  assert.equal(ownEarlier.decision, "block", "an exact current-request retained run blocks its own Stop even after a later request exists");
  assert(Object.values(ownMarkers).every(Boolean), "the exact-owned Stop must preserve its marker and all foreign/legacy markers");

  process.stdout.write(JSON.stringify({
    project: fixture,
    unrelatedStop: { decision: unrelated.decision ?? null, allowed: unrelated.decision !== "block", reason: unrelated.reason || null, markerExists: unrelatedMarkers },
    exactOwnerStop: { decision: ownEarlier.decision ?? null, allowed: ownEarlier.decision !== "block", reason: ownEarlier.reason || null, markerExists: ownMarkers },
  }, null, 2) + "\n");
} finally {
  const namespace = managed.managedBase(fixture);
  const expected = path.join(os.homedir(), ".cache", "apt-t",
    crypto.createHash("sha256").update(fs.realpathSync.native(fixture), "utf8").digest("hex").slice(0, 32));
  assert.equal(namespace, expected);
  managed.assertNoLinks(namespace, { allowMissing: true });
  if (fs.existsSync(namespace)) fs.rmSync(namespace, { recursive: true, force: true });
  fs.rmSync(fixture, { recursive: true, force: true });
}
