#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
let DatabaseSync;
try { ({ DatabaseSync } = require("node:sqlite")); } catch { /* optional Node 22.5+ live collector */ }
const {
  collectChildRollouts,
  normalizeParentToolCalls,
  normalizeChildRollout,
  validateSubagentTrace,
} = require("./lib/subagent-trace.js");

const PARENT = "parent-thread";
const CHILD = "child-thread";

function event(item) {
  return { type: "item.completed", item };
}

function spawn(role = "scout", model = "gpt-6-luna", effort = "high") {
  return event({
    type: "collab_tool_call",
    tool: "spawn_agent",
    sender_thread_id: PARENT,
    receiver_thread_ids: [CHILD],
    agent_type: role,
    model,
    reasoning_effort: effort,
    sandbox_prompt: "--sandbox read-only",
  });
}

function spawnImplicitProfile(role = "scout") {
  return event({
    type: "collab_tool_call",
    tool: "spawn_agent",
    sender_thread_id: PARENT,
    receiver_thread_ids: [CHILD],
    agent_type: role,
  });
}

function rawChildSession(role = "scout", model = "gpt-6-luna", effort = "high") {
  return [
    {
      type: "session_meta",
      payload: {
        id: "rollout-record",
        session_id: CHILD,
        parent_thread_id: PARENT,
        agent_role: role,
        source: { subagent: { thread_spawn: { parent_thread_id: PARENT } } },
      },
    },
    { type: "turn_context", payload: { model, effort } },
  ];
}

function childSession(role = "scout", model = "gpt-6-luna", effort = "high") {
  return normalizeChildRollout(rawChildSession(role, model, effort), CHILD, PARENT, {
    model, effort, agentPath: "/repo/.codex/agents/scout.toml", threadId: CHILD,
  }, "rollout-record.jsonl");
}

function wait(status = "completed") {
  return event({
    type: "collab_tool_call",
    tool: "wait",
    sender_thread_id: PARENT,
    receiver_thread_ids: [CHILD],
    agents_states: { [CHILD]: { status } },
  });
}

function validTrace() {
  return [
    { type: "thread.started", thread_id: PARENT },
    spawn(),
    ...childSession(),
    event({ type: "agent_message", sender_thread_id: CHILD, text: "bounded result" }),
    wait(),
  ];
}

function assertStatus(events, status, options = {}) {
  const result = validateSubagentTrace(events, options);
  assert.strictEqual(result.status, status, result.issues.join("; "));
  assert.strictEqual(result.isValid, status === "verified");
  return result;
}

function testGenuineHappyPath() {
  const result = assertStatus(validTrace(), "verified", {
    expectedRole: "scout",
    expectedModel: "gpt-6-luna",
    expectedEffort: "high",
  });
  assert.deepStrictEqual(result.children[0].requested, {
    role: "scout", model: "gpt-6-luna", effort: "high",
  });
  assert.deepStrictEqual(result.children[0].effective, {
    role: "scout", model: "gpt-6-luna", effort: "high",
  });
  assert.deepStrictEqual(result.runtimePermissions, {
    status: "unknown",
    evidence: null,
    reason: "trace metadata does not prove runtime permission enforcement",
  });
}

function testForgedRequestedModel() {
  const events = [
    { type: "thread.started", thread_id: PARENT },
    spawn("scout", "gpt-6-luna", "high"),
    ...childSession("scout", "gpt-6.1-sol", "high"),
    wait(),
  ];
  assertStatus(events, "rejected", { expectedModel: "gpt-6-luna" });
}

function testIncompleteAndLegacyMetadata() {
  const events = [
    { type: "thread.started", thread_id: PARENT },
    event({
      type: "collab_tool_call", tool: "spawn_agent", receiver_thread_ids: [CHILD],
      agent_type: "scout", model: "gpt-6-luna", reasoning_effort: "high",
    }),
    event({ type: "agent_message", sender_thread_id: CHILD, text: "configured as gpt-6-luna" }),
    wait(),
  ];
  const result = assertStatus(events, "unverified");
  assert(result.issues.some((issue) => issue.includes("trusted child session metadata")));
}

function testRoleOverride() {
  const events = [
    { type: "thread.started", thread_id: PARENT },
    spawn("scout"),
    ...childSession("reviewer"),
    wait(),
  ];
  assertStatus(events, "rejected", { expectedRole: "scout" });
}

function testEffortMismatch() {
  const events = [
    { type: "thread.started", thread_id: PARENT },
    spawn("scout", "gpt-6-luna", "high"),
    ...childSession("scout", "gpt-6-luna", "medium"),
    wait(),
  ];
  assertStatus(events, "rejected", { expectedEffort: "high" });
}

function testImplicitModelAndEffort() {
  const events = [
    { type: "thread.started", thread_id: PARENT },
    spawnImplicitProfile(),
    ...childSession(),
    wait(),
  ];
  const result = assertStatus(events, "verified", {
    expectedRole: "scout", expectedModel: "gpt-6-luna", expectedEffort: "high",
  });
  assert.strictEqual(result.children[0].requested.model, null);
  assert.strictEqual(result.children[0].requested.effort, null);
}

async function testCollectorUsesLinkedRuntimeRowAndRollout() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-trace-test-"));
  const sessionsRoot = path.join(tempRoot, "sessions");
  fs.mkdirSync(sessionsRoot);
  const rolloutPath = path.join(sessionsRoot, "child-rollout.jsonl");
  const stateDbPath = path.join(tempRoot, "state.sqlite");
  const database = new DatabaseSync(stateDbPath);
    database.exec("CREATE TABLE threads (id TEXT, agent_path TEXT, model TEXT, reasoning_effort TEXT, agent_role TEXT, rollout_path TEXT, source TEXT)");
    database.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      CHILD, "/repo/.codex/agents/scout.toml", "gpt-6-luna", "high", "scout", rolloutPath,
      JSON.stringify({ subagent: { thread_spawn: { parent_thread_id: PARENT } } }),
  );
  database.close();
  fs.writeFileSync(rolloutPath, rawChildSession().map((entry) => JSON.stringify(entry)).join("\n"));
  try {
    const parentEvents = [
      { type: "thread.started", thread_id: PARENT }, spawn(), wait(),
    ];
    const collected = await collectChildRollouts(parentEvents, { stateDb: stateDbPath, sessionsRoot });
    const result = validateSubagentTrace([...parentEvents, ...collected], {
      expectedRole: "scout", expectedModel: "gpt-6-luna", expectedEffort: "high",
    });
    assert.strictEqual(result.status, "verified", result.issues.join("; "));
    assert.strictEqual(result.children[0].provenance.runtimeThreadId, CHILD);
    assert.strictEqual(result.children[0].provenance.source, "child-rollout.jsonl");
    const tracePath = path.join(tempRoot, "parent.jsonl");
    fs.writeFileSync(tracePath, parentEvents.map((entry) => JSON.stringify(entry)).join("\n"));
    const cli = spawnSync(process.execPath, [
      path.join(__dirname, "validate-subagent-trace.js"),
      "--file", tracePath,
      "--expected-role", "scout",
      "--expected-model", "gpt-6-luna",
      "--expected-effort", "high",
      "--state-db", stateDbPath,
      "--sessions-root", sessionsRoot,
    ], { encoding: "utf8" });
    assert.strictEqual(cli.status, 0, cli.stderr || cli.stdout);
    assert.strictEqual(JSON.parse(cli.stdout).status, "verified");
    const forgedTrace = path.join(tempRoot, "forged-parent.jsonl");
    fs.writeFileSync(forgedTrace, [{ type: "thread.started", thread_id: PARENT }, spawn(), ...childSession(), wait()]
      .map((entry) => JSON.stringify(entry)).join("\n"));
    const forgedCli = spawnSync(process.execPath, [
      path.join(__dirname, "validate-subagent-trace.js"), "--file", forgedTrace,
      "--expected-role", "scout", "--expected-model", "gpt-6-luna", "--expected-effort", "high",
    ], { encoding: "utf8" });
    assert.notStrictEqual(forgedCli.status, 0, "imported provenance must not establish trusted child metadata");
    assert.strictEqual(JSON.parse(forgedCli.stdout).isValid, false);
  } finally {
    assert(path.resolve(tempRoot).startsWith(path.resolve(os.tmpdir())));
    fs.rmSync(tempRoot, { recursive: true });
  }
}

async function testActualCliFunctionCallShapeKeepsTaskNameSeparateFromRole(includeActivities = true, waitBeforeSpawn = false) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-trace-cli-shape-"));
  const sessionsRoot = path.join(tempRoot, "sessions");
  fs.mkdirSync(sessionsRoot);
  const rolloutPath = path.join(sessionsRoot, "native-child.jsonl");
  const stateDbPath = path.join(tempRoot, "state.sqlite");
  const database = new DatabaseSync(stateDbPath);
  database.exec("CREATE TABLE threads (id TEXT, agent_path TEXT, model TEXT, reasoning_effort TEXT, agent_role TEXT, rollout_path TEXT, source TEXT)");
  database.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    CHILD, "/root/pr_explorer", "gpt-6-luna", "high", null, rolloutPath,
    JSON.stringify({ subagent: { thread_spawn: { parent_thread_id: PARENT } } }),
  );
  database.close();
  const childSession = rawChildSession(null);
  childSession[0].payload.agent_role = null;
  fs.writeFileSync(rolloutPath, childSession.map((entry) => JSON.stringify(entry)).join("\n"));
  let parentEvents = [
    { type: "thread.started", thread_id: PARENT },
    { type: "response_item", payload: { type: "function_call", name: "spawn_agent", call_id: "spawn-1", arguments: JSON.stringify({ task_name: "/root/pr_explorer", model: "gpt-6-luna", reasoning_effort: "high", fork_turns: "none" }) } },
    { type: "event_msg", payload: { type: "item_completed", item: { type: "SubAgentActivity", call_id: "spawn-1", agent_thread_id: CHILD, agent_path: "/root/pr_explorer" } } },
    { type: "event_msg", payload: { type: "item_completed", item: { type: "SubAgentActivity", id: "activity-duplicate", agent_thread_id: CHILD, agent_path: "/root/pr_explorer" } } },
    { type: "response_item", payload: { type: "function_call_output", call_id: "spawn-1", output: JSON.stringify({ task_name: "/root/pr_explorer" }) } },
    wait(),
  ];
  if (!includeActivities) {
    parentEvents = parentEvents.filter((entry) => entry.type !== "event_msg" && entry.item?.tool !== "wait");
    parentEvents.push({ type: "response_item", payload: { type: "function_call", name: "wait_agent",
      call_id: "wait-1", arguments: JSON.stringify({ timeout_ms: 10000 }) } });
    parentEvents.push({ type: "response_item", payload: { type: "function_call_output",
      call_id: "wait-1", output: "A child agent has an update" } });
    childSession.push({ type: "event_msg", payload: { type: "task_complete" } });
    fs.writeFileSync(rolloutPath, childSession.map((entry) => JSON.stringify(entry)).join("\n"));
  }
  if (waitBeforeSpawn) {
    const waitCall = parentEvents.find((entry) => entry.payload?.call_id === "wait-1" && entry.payload?.type === "function_call");
    parentEvents = parentEvents.filter((entry) => entry !== waitCall);
    parentEvents.splice(1, 0, waitCall);
  }
  try {
    const normalizedSpawn = normalizeParentToolCalls(parentEvents).find((entry) => entry.item.tool === "spawn_agent");
    assert.deepStrictEqual(normalizedSpawn.item.receiver_thread_ids, includeActivities ? [CHILD] : []);
    const collected = await collectChildRollouts(parentEvents, { stateDb: stateDbPath, sessionsRoot });
    assert(collected.some((entry) => entry.item?.tool === "spawn_agent" &&
      entry.item.receiver_thread_ids.includes(CHILD)), "collector must return amended child lookup");
    if (!includeActivities) assert.strictEqual(collected.some((entry) => entry.item?.tool === "wait_agent" &&
      entry.item.receiver_thread_ids.includes(CHILD)), !waitBeforeSpawn,
    "global mailbox wait must reference only preceding resolved spawns");
    const result = validateSubagentTrace([...parentEvents, ...collected], {
      expectedRole: "pr_explorer", expectedModel: "gpt-6-luna", expectedEffort: "high",
    });
    assert.strictEqual(result.children[0].requested.taskName, "/root/pr_explorer");
    assert.strictEqual(result.children[0].effective.role, null);
    assert(result.issues.some((issue) => issue.startsWith("custom-role-unsupported:")));
    assert.strictEqual(result.children[0].effective.model, "gpt-6-luna");
    assert.strictEqual(result.children[0].effective.effort, "high");
    const explicit = validateSubagentTrace([...parentEvents, ...collected], {
      validationMode: "explicit-profile", expectedModel: "gpt-6-luna", expectedEffort: "high",
    });
    assert.strictEqual(explicit.status, waitBeforeSpawn ? "unverified" : "verified", explicit.issues.join("; "));
    assert.strictEqual(explicit.nativeRoleStatus, "unverified");
    assert.strictEqual(explicit.roleContractDelivery.status, "unverified");
    assert.strictEqual(explicit.children[0].effective.role, null);
    const wrongProfile = validateSubagentTrace([...parentEvents, ...collected], {
      validationMode: "explicit-profile", expectedModel: "gpt-6.1-sol", expectedEffort: "high",
    });
    assert.strictEqual(wrongProfile.isValid, false);
    const missingExpected = validateSubagentTrace([...parentEvents, ...collected], {
      validationMode: "explicit-profile",
    });
    assert.strictEqual(missingExpected.isValid, false);
  } finally {
    assert(path.resolve(tempRoot).startsWith(path.resolve(os.tmpdir())));
    fs.rmSync(tempRoot, { recursive: true });
  }
}

function testSiblingCompletionAndAbortStayBoundToTheirSession() {
  const secondId = "second-child";
  const secondRaw = rawChildSession();
  secondRaw[0].payload.id = "second-record";
  secondRaw[0].payload.session_id = secondId;
  const first = childSession();
  const second = normalizeChildRollout(secondRaw, secondId, PARENT, {
    model: "gpt-6-luna", effort: "high", threadId: secondId,
  }, "second-rollout.jsonl");
  const secondSpawn = spawn();
  secondSpawn.item.receiver_thread_ids = [secondId];
  const secondWait = wait("running");
  secondWait.item.receiver_thread_ids = [secondId];
  secondWait.item.agents_states = { [secondId]: { status: "running" } };
  const terminal = (session, id, type) => ({ type: "event_msg", payload: { type },
    session_id: id, _trace_provenance: session[0]._trace_provenance });
  const base = [{ type: "thread.started", thread_id: PARENT }, spawn(), secondSpawn,
    ...first, ...second, wait("running"), secondWait];
  const onlyFirstDone = validateSubagentTrace([...base, terminal(first, CHILD, "task_complete")]);
  assert.strictEqual(onlyFirstDone.children[0].status, "verified");
  assert.strictEqual(onlyFirstDone.children[1].status, "unverified");
  assert.strictEqual(onlyFirstDone.children[1].completionEvidence.terminalEvent, false);
  const bothDone = assertStatus([...base, terminal(first, CHILD, "task_complete"),
    terminal(second, secondId, "task_complete")], "verified");
  assert(bothDone.children.every((child) => child.completionEvidence.terminalEvent));
  const firstAborted = validateSubagentTrace([...base, terminal(first, CHILD, "turn_aborted"),
    terminal(second, secondId, "task_complete")]);
  assert.strictEqual(firstAborted.children[0].completionEvidence.terminated, true);
  assert.strictEqual(firstAborted.children[1].completionEvidence.terminated, false);
  assert.strictEqual(firstAborted.children[1].status, "verified");
  for (const changed of [
    { ...terminal(first, CHILD, "task_complete"), session_id: secondId },
    { ...terminal(first, CHILD, "task_complete"), _trace_provenance: second[0]._trace_provenance },
    { ...terminal(first, CHILD, "task_complete"), payload: { type: "task_complete", thread_id: secondId } },
  ]) {
    const invalid = validateSubagentTrace([...base, changed]);
    assert(invalid.children.every((child) => !child.completionEvidence.terminalEvent), "wrong session/source/id must not complete either child");
  }
}

function testNormalizationDoesNotEraseContradictoryEventIdentity() {
  for (const extra of [{ session_id: "other-child" },
    { payload: { type: "task_complete", session_id: "other-child" } },
    { thread_id: "other-child" }, { payload: { type: "task_complete", thread_id: "other-child" } }]) {
    const raw = [...rawChildSession(), { type: "event_msg", payload: { type: "task_complete" }, ...extra }];
    const normalized = normalizeChildRollout(raw, CHILD, PARENT, {
      model: "gpt-6-luna", effort: "high", threadId: CHILD,
    }, "contradictory-child.jsonl");
    const result = assertStatus([{ type: "thread.started", thread_id: PARENT }, spawn(),
      ...normalized, wait("running")], "unverified");
    assert.strictEqual(result.children[0].completionEvidence.terminalEvent, false);
  }
}

function testUnresolvedSecondSpawnCannotDisappearBehindSuccessfulFirst() {
  const unresolved = event({ type: "collab_tool_call", tool: "spawn_agent",
    call_id: "spawn-2", task_name: "/root/unresolved", receiver_thread_ids: [] });
  const first = spawn();
  first.item.call_id = "spawn-1";
  const result = assertStatus([...validTrace().filter((entry) => entry.item?.tool !== "spawn_agent"),
    first, unresolved], "unverified");
  assert(result.issues.some((issue) => issue.includes("spawn-2") && issue.includes("no resolved")));
  const duplicateUnresolvedFirst = event({ type: "collab_tool_call", tool: "spawn_agent",
    call_id: "spawn-1", receiver_thread_ids: [] });
  assertStatus([...validTrace().filter((entry) => entry.item?.tool !== "spawn_agent"),
    first, duplicateUnresolvedFirst], "verified");
}

function testLatestTurnLifecycleSupersedesOlderCompletionOrAbort() {
  const session = childSession();
  const lifecycle = (type, turnId) => ({ type: "event_msg", payload: { type, turn_id: turnId },
    session_id: CHILD, _trace_provenance: session[0]._trace_provenance });
  const base = [{ type: "thread.started", thread_id: PARENT }, spawn(), ...session, wait()];
  const oldDone = lifecycle("task_complete", "turn-1");
  const newStart = lifecycle("task_started", "turn-2");
  const pending = assertStatus([...base, oldDone, newStart], "unverified");
  assert.strictEqual(pending.children[0].completionEvidence.terminalEvent, false);
  assert.strictEqual(pending.children[0].completionEvidence.completedByWait, false);
  assertStatus([...base, oldDone, newStart, lifecycle("task_complete", "turn-1")], "unverified");
  const retry = assertStatus([...base, lifecycle("turn_aborted", "turn-1"), newStart,
    lifecycle("task_complete", "turn-2")], "verified");
  assert.strictEqual(retry.children[0].completionEvidence.terminated, false);
  assert.strictEqual(retry.children[0].completionEvidence.latestTurnId, "turn-2");
  assertStatus([...base, newStart, lifecycle("task_complete", "turn-2"),
    lifecycle("turn_aborted", "turn-1")], "verified");
}

function testWaitFromDifferentParentCannotProveCompletion() {
  const forgedWait = wait();
  forgedWait.item.sender_thread_id = "other-parent";
  const result = assertStatus([{ type: "thread.started", thread_id: PARENT }, spawn(),
    ...childSession(), forgedWait], "unverified");
  assert.strictEqual(result.children[0].completionEvidence.linkedWait, false);
  assert.strictEqual(result.children[0].completionEvidence.completedByWait, false);
}

function testShutdownIsNotSuccessfulCompletion() {
  const result = assertStatus([
    { type: "thread.started", thread_id: PARENT }, spawn(), ...childSession(), wait("shutdown"),
  ], "unverified");
  assert(result.issues.some((issue) => issue.includes("completion evidence")));
}

function testTrustedChildTaskCompleteIsSuccessfulEvidence() {
  const trusted = childSession();
  trusted.push({
    type: "event_msg", payload: { type: "task_complete" },
    session_id: CHILD, _trace_provenance: trusted[0]._trace_provenance,
  });
  const result = assertStatus([
    { type: "thread.started", thread_id: PARENT }, spawn(), ...trusted, wait("shutdown"),
  ], "verified");
  assert.strictEqual(result.children[0].completionEvidence.terminalEvent, true);
}

function testInterruptedTurnIsNotSuccessfulCompletion() {
  const trusted = childSession();
  trusted.push({
    type: "event_msg", payload: { type: "turn_aborted", reason: "interrupted" },
    session_id: CHILD, _trace_provenance: trusted[0]._trace_provenance,
  });
  const result = assertStatus([
    { type: "thread.started", thread_id: PARENT }, spawn(), ...trusted, wait("shutdown"),
  ], "unverified");
  assert(result.issues.some((issue) => issue.includes("turn_aborted")));
  assert.strictEqual(result.children[0].completionEvidence.terminated, true);
}

function testLaterTurnModelChangeIsRejected() {
  const rollout = rawChildSession();
  rollout.push({ type: "turn_context", payload: { model: "gpt-6.1-sol", effort: "high" } });
  const trustedEvents = normalizeChildRollout(rollout, CHILD, PARENT, {
    model: "gpt-6-luna", effort: "high", agentPath: "/repo/.codex/agents/scout.toml",
    threadId: CHILD,
  }, "changed-profile.jsonl");
  assertStatus([
    { type: "thread.started", thread_id: PARENT }, spawn(), ...trustedEvents, wait(),
  ], "rejected");
}

function testSelfReportAndChildActivityAreNotEvidence() {
  const events = validTrace().filter((entry) => entry.type !== "session_meta" &&
    entry.type !== "turn_context" && entry.item?.tool !== "wait");
  const result = assertStatus(events, "unverified");
  assert(result.issues.some((issue) => issue.includes("completion evidence")));
}

async function main() {
  testGenuineHappyPath();
  testForgedRequestedModel();
  testIncompleteAndLegacyMetadata();
  testRoleOverride();
  testEffortMismatch();
  testImplicitModelAndEffort();
  if (DatabaseSync) {
    await testCollectorUsesLinkedRuntimeRowAndRollout();
    await testActualCliFunctionCallShapeKeepsTaskNameSeparateFromRole();
    await testActualCliFunctionCallShapeKeepsTaskNameSeparateFromRole(false);
    await testActualCliFunctionCallShapeKeepsTaskNameSeparateFromRole(false, true);
  } else {
    console.log("SKIP: optional SQLite collector integration requires Node 22.5+");
  }
  testShutdownIsNotSuccessfulCompletion();
  testSiblingCompletionAndAbortStayBoundToTheirSession();
  testNormalizationDoesNotEraseContradictoryEventIdentity();
  testUnresolvedSecondSpawnCannotDisappearBehindSuccessfulFirst();
  testLatestTurnLifecycleSupersedesOlderCompletionOrAbort();
  testWaitFromDifferentParentCannotProveCompletion();
  testTrustedChildTaskCompleteIsSuccessfulEvidence();
  testInterruptedTurnIsNotSuccessfulCompletion();
  testLaterTurnModelChangeIsRejected();
  testSelfReportAndChildActivityAreNotEvidence();
  console.log("Subagent trace tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
