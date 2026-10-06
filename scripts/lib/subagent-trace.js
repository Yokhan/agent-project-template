"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const COMPLETE_STATUSES = new Set(["completed", "complete"]);
const SUCCESSFUL_TERMINAL_EVENTS = new Set(["thread.completed", "event_msg.task_complete"]);
const TRACE_PROVENANCE = "codex-child-rollout";

function parseJsonLines(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"))
    .map((line, index) => parseLine(line, index));
}

function parseLine(line, index) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
  }
}

function getItem(event) {
  return event && typeof event.item === "object" ? event.item :
    event?.payload && typeof event.payload.item === "object" ? event.payload.item : null;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCollabTool(event, pattern) {
  const item = getItem(event);
  return item?.type === "collab_tool_call" && pattern.test(String(item.tool || ""));
}

function collectReceiverIds(item) {
  const ids = [];
  if (Array.isArray(item?.receiver_thread_ids)) ids.push(...item.receiver_thread_ids);
  if (typeof item?.receiver_thread_id === "string") ids.push(item.receiver_thread_id);
  if (isRecord(item?.agents_states)) ids.push(...Object.keys(item.agents_states));
  return Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
}

function getSpawnValue(item, field) {
  let rawArgs = item?.arguments;
  if (typeof rawArgs === "string") {
    try { rawArgs = JSON.parse(rawArgs); } catch { rawArgs = null; }
  }
  const args = isRecord(rawArgs) ? rawArgs : {};
  const input = isRecord(item?.input) ? item.input : {};
  const direct = item?.[field];
  const argument = args[field];
  const inputValue = input[field];
  if (typeof direct === "string" && direct) return direct;
  if (typeof argument === "string" && argument) return argument;
  if (typeof inputValue === "string" && inputValue) return inputValue;
  return null;
}

function getRequestedProfile(item) {
  const requested = {
    role: getSpawnValue(item, "agent_type") || getSpawnValue(item, "role"),
    model: getSpawnValue(item, "model"),
    effort: getSpawnValue(item, "reasoning_effort") || getSpawnValue(item, "effort"),
  };
  const taskName = getSpawnValue(item, "task_name");
  if (taskName) requested.taskName = taskName;
  return requested;
}

function getChildSessionMeta(events, childId) {
  return events.find((event) => {
    const payload = event?.payload;
    return event.type === "session_meta" && isRecord(payload) &&
      event.session_id === childId &&
      (payload.session_id === childId || payload.id === childId) &&
      event._trace_provenance?.kind === TRACE_PROVENANCE;
  }) || null;
}

function getTrustedTurnContext(events, childId, sessionEvent) {
  return events.filter((event) => event.type === "turn_context" &&
    isLinkedChildEvidence(event, childId, sessionEvent));
}

function getEffectiveProfile(events, childId, sessionEvent, parentId) {
  const payload = sessionEvent?.payload;
  const source = payload?.source?.subagent;
  const spawn = source?.thread_spawn;
  const contexts = getTrustedTurnContext(events, childId, sessionEvent);
  const runtime = sessionEvent?._trace_provenance?.runtimeProfile || {};
  const turns = contexts.map((event) => event.payload).filter(isRecord);
  const role = payload?.agent_role || spawn?.agent_role || null;
  return {
    parentLinked: spawn?.parent_thread_id === parentId &&
      (!payload?.parent_thread_id || payload.parent_thread_id === parentId),
    spawnMetadataPresent: isRecord(source) && isRecord(spawn),
    role,
    model: runtime.model || null,
    effort: runtime.effort || null,
    turnModels: turns.map((turn) => turn.model || null),
    turnEfforts: turns.map((turn) => turn.effort || turn.reasoning_effort || null),
    agentPath: runtime.agentPath || null,
    turnContextCount: contexts.length,
  };
}

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCompleteStatus(value) {
  return typeof value === "string" && COMPLETE_STATUSES.has(value.toLowerCase());
}

function hasWaitCompletion(waitEvent, childId) {
  const item = getItem(waitEvent);
  const state = item?.agents_states?.[childId];
  const completedIds = item?.completed_thread_ids;
  return isCompleteStatus(state?.status) ||
    (Array.isArray(completedIds) && completedIds.includes(childId));
}

function isLinkedChildEvidence(event, childId, sessionEvent) {
  const provenance = event?._trace_provenance;
  const sessionProvenance = sessionEvent?._trace_provenance;
  return Boolean(sessionEvent && event.session_id === childId &&
    provenance?.kind === TRACE_PROVENANCE &&
    provenance.sourceFile === sessionProvenance.sourceFile &&
    provenance.rolloutId === sessionProvenance.rolloutId &&
    (!event.payload?.session_id || event.payload.session_id === childId) &&
    (!event.thread_id || event.thread_id === childId) &&
    (!event.payload?.thread_id || event.payload.thread_id === childId));
}

function latestChildLifecycle(events, childId, sessionEvent) {
  let latest = null;
  let currentTurnId = null;
  for (const event of events) {
    const type = event.type === "event_msg" ? `event_msg.${event.payload?.type}` : event.type;
    if (!isLinkedChildEvidence(event, childId, sessionEvent) ||
      ![...SUCCESSFUL_TERMINAL_EVENTS, "event_msg.task_started", "event_msg.turn_aborted"].includes(type)) continue;
    if (type === "event_msg.task_started") currentTurnId = event.payload?.turn_id || null;
    else if (currentTurnId && event.payload?.turn_id && currentTurnId !== event.payload.turn_id) continue;
    latest = { type, turnId: event.payload?.turn_id || null };
  }
  return latest;
}

function hasTerminalEvent(events, childId, sessionEvent) {
  return SUCCESSFUL_TERMINAL_EVENTS.has(latestChildLifecycle(events, childId, sessionEvent)?.type);
}

function hasTerminationEvent(events, childId, sessionEvent) {
  return latestChildLifecycle(events, childId, sessionEvent)?.type === "event_msg.turn_aborted";
}

function addProfileIssues(issues, requested, effective, options) {
  const explicitProfile = options.validationMode === "explicit-profile";
  for (const field of explicitProfile ? ["model", "effort"] : ["role", "model", "effort"]) {
    if (explicitProfile && !requested[field]) issues.push(`explicit spawn does not request ${field}`);
    if (!requested[field] && field === "role") issues.push("spawn does not identify requested role");
    if (!effective[field]) issues.push(`child metadata does not verify effective ${field}`);
    if (requested[field] && effective[field] &&
      normalize(requested[field]) !== normalize(effective[field])) {
      issues.push(`requested/effective ${field} mismatch`);
    }
    const expected = options[`expected${field[0].toUpperCase()}${field.slice(1)}`];
    if (expected && requested[field] && normalize(expected) !== normalize(requested[field])) {
      issues.push(`requested ${field} does not match expected ${expected}`);
    }
    if (expected && effective[field] && normalize(expected) !== normalize(effective[field])) {
      issues.push(`effective ${field} does not match expected ${expected}`);
    }
  }
  if (!explicitProfile && !effective.role && requested.taskName && options.expectedRole) {
    issues.push("custom-role-unsupported: task_name does not prove a configured or effective agent role");
  }
  if (effective.model && effective.turnModels.length === 0) {
    issues.push("child rollout has no turn_context model evidence");
  }
  if (effective.effort && effective.turnEfforts.length === 0) {
    issues.push("child rollout has no turn_context effort evidence");
  }
  if (effective.model && effective.turnModels.some((model) => !model)) {
    issues.push("child rollout has incomplete turn_context model evidence");
  } else if (effective.model && effective.turnModels.some((model) => normalize(model) !== normalize(effective.model))) {
    issues.push("child DB model does not match turn_context");
  }
  if (effective.effort && effective.turnEfforts.some((effort) => !effort)) {
    issues.push("child rollout has incomplete turn_context effort evidence");
  } else if (effective.effort && effective.turnEfforts.some((effort) => normalize(effort) !== normalize(effective.effort))) {
    issues.push("child DB effort does not match turn_context");
  }
}

function validateChild(events, childId, spawnEvent, parentId, options) {
  const issues = [];
  const collectionErrors = events.filter((event) =>
    event.type === "child_metadata_error" && event.child_thread_id === childId);
  issues.push(...collectionErrors.map((event) => event.issue));
  const sessionEvent = getChildSessionMeta(events, childId);
  const effective = getEffectiveProfile(events, childId, sessionEvent, parentId);
  const requested = getRequestedProfile(getItem(spawnEvent));
  const waitEvents = events.filter((event) => isCollabTool(event, /wait/iu) &&
    getItem(event)?.sender_thread_id === parentId &&
    collectReceiverIds(getItem(event)).includes(childId));
  if (getItem(spawnEvent)?.sender_thread_id && getItem(spawnEvent).sender_thread_id !== parentId) {
    issues.push(`spawn sender parent mismatch for ${childId}`);
  }
  const lifecycle = latestChildLifecycle(events, childId, sessionEvent);
  const completedByWait = lifecycle?.type !== "event_msg.task_started" &&
    waitEvents.some((event) => hasWaitCompletion(event, childId));
  if (!sessionEvent) issues.push(`missing trusted child session metadata for ${childId}`);
  if (sessionEvent && !effective.parentLinked) issues.push(`child session parent mismatch for ${childId}`);
  if (sessionEvent && !effective.spawnMetadataPresent) {
    issues.push(`child session lacks trusted spawn metadata for ${childId}`);
  }
  if (waitEvents.length === 0) issues.push(`no wait event references child ${childId}`);
  if (!completedByWait &&
    !hasTerminalEvent(events, childId, sessionEvent)) {
    issues.push(`missing child completion evidence for ${childId}`);
  }
  if (hasTerminationEvent(events, childId, sessionEvent)) {
    issues.push(`child rollout terminated with turn_aborted instead of successful completion for ${childId}`);
  }
  addProfileIssues(issues, requested, effective, options);
  return {
    childThreadId: childId,
    requested,
    effective: { role: effective.role, model: effective.model, effort: effective.effort },
    completionEvidence: {
      linkedWait: waitEvents.length > 0,
      completedByWait,
      terminalEvent: hasTerminalEvent(events, childId, sessionEvent),
      terminated: hasTerminationEvent(events, childId, sessionEvent),
      latestTurnId: lifecycle?.turnId || null,
    },
    provenance: sessionEvent?._trace_provenance ? {
      source: sessionEvent._trace_provenance.sourceFile,
      rolloutId: sessionEvent._trace_provenance.rolloutId,
      runtimeThreadId: sessionEvent._trace_provenance.runtimeProfile?.threadId || null,
      agentPath: effective.agentPath,
      turnContextCount: effective.turnContextCount,
    } : null,
    status: getStatus(issues),
    issues,
  };
}

function getStatus(issues) {
  if (issues.length === 0) return "verified";
  return issues.some((issue) => /mismatch|does not match|parent mismatch/iu.test(issue))
    ? "rejected"
    : "unverified";
}

async function readSessionEvidence(filePath) {
  const events = [];
  const lines = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim().startsWith("{") ||
      !/"type"\s*:\s*"(?:session_meta|turn_context|thread\.completed|event_msg)"/u.test(line)) continue;
    const event = JSON.parse(line);
    if (event.type === "session_meta" || event.type === "turn_context" ||
      event.type === "thread.completed" ||
      (event.type === "event_msg" && ["task_started", "task_complete", "turn_aborted"].includes(event.payload?.type))) events.push(event);
  }
  return events;
}

async function readParentToolEvidence(filePath, parentId) {
  const selected = [];
  let linkedMeta = false;
  const lines = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim().startsWith("{")) continue;
    if (!/"type"\s*:\s*"(?:session_meta|response_item|event_msg)"/u.test(line)) continue;
    const event = JSON.parse(line);
    if (event.type === "session_meta") {
      const payload = event.payload;
      if (payload?.id === parentId || payload?.session_id === parentId) linkedMeta = true;
      continue;
    }
    if (event.type === "response_item" &&
      ((event.payload?.type === "function_call" && ["spawn_agent", "wait_agent"].includes(event.payload.name)) ||
      event.payload?.type === "function_call_output")) selected.push(event);
    else if (event.type === "event_msg" && getItem(event)?.type === "SubAgentActivity") selected.push(event);
  }
  return linkedMeta ? selected.map((event) => ({
    ...event,
    _trace_provenance: { kind: "codex-parent-rollout", threadId: parentId, sourceFile: path.basename(filePath) },
  })) : [];
}

async function collectParentToolEvidence(events, options) {
  const parentId = events.find((event) => event.type === "thread.started")?.thread_id;
  if (!parentId || !options.stateDb || !options.sessionsRoot) return [];
  let DatabaseSync;
  try { ({ DatabaseSync } = require("node:sqlite")); } catch { return []; }
  const db = new DatabaseSync(options.stateDb, { readOnly: true });
  let row;
  try {
    row = db.prepare("SELECT id, rollout_path FROM threads WHERE id = ?").get(parentId);
  } finally { db.close(); }
  if (!row || row.id !== parentId) return [];
  let safePath;
  try { safePath = isSafeRolloutPath(options.sessionsRoot, row.rollout_path); }
  catch { return []; }
  if (!safePath) return [];
  try { return await readParentToolEvidence(safePath, parentId); }
  catch { return []; }
}

function parseMaybeJson(value) {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch { return null; }
}

function getRuntimeParentId(sourceValue) {
  const source = parseMaybeJson(sourceValue);
  return source?.parent_thread_id || source?.subagent?.thread_spawn?.parent_thread_id || null;
}

// Convert the CLI JSON function-call representation into the legacy trace
// shape. A task name is retained only as a lookup key; it is never role proof.
function normalizeParentToolCalls(events) {
  const parentId = events.find((event) => event.type === "thread.started")?.thread_id;
  const callOutputs = new Map();
  for (const event of events) {
    const payload = event?.payload;
    if (event?.type === "response_item" && payload?.type === "function_call_output" && payload.call_id) {
      callOutputs.set(payload.call_id, parseMaybeJson(payload.output));
    }
  }
  const functionCalls = events.filter((event) => event?.type === "response_item" &&
    event.payload?.type === "function_call" &&
    ["spawn_agent", "wait_agent"].includes(event.payload.name));
  const allActivities = events.flatMap((event) => {
    const item = getItem(event);
    return item?.type === "SubAgentActivity" ? [item] : [];
  });
  const uniqueActivityIds = Array.from(new Set(allActivities
    .map((item) => item.agent_thread_id || item.thread_id)
    .filter((id) => typeof id === "string" && id)));
  const spawnCalls = functionCalls.filter((event) => event.payload.name === "spawn_agent");
  return functionCalls.map((event) => {
    const payload = event.payload;
    const args = parseMaybeJson(payload.arguments) || {};
    const output = callOutputs.get(payload.call_id) || {};
    const exact = allActivities.filter((item) => item.call_id === payload.call_id);
    const activities = exact.length ? exact :
      spawnCalls.length === 1 && uniqueActivityIds.length === 1 ? allActivities : [];
    const receivers = activities.map((item) => item.agent_thread_id || item.thread_id)
      .filter((id) => typeof id === "string" && id);
    return {
      type: "item.completed",
      _trace_event_index: events.indexOf(event),
      item: {
        type: "collab_tool_call",
        tool: payload.name,
        sender_thread_id: parentId || event._trace_provenance?.threadId || null,
        receiver_thread_ids: Array.from(new Set(receivers)),
        arguments: args,
        task_name: output.task_name || args.task_name || null,
        call_id: payload.call_id,
        wait_scope: payload.name === "wait_agent" && !args.target && !args.targets
          ? "global-child-mailbox" : null,
        _trace_provenance: { kind: "parent-response-item-call-id" },
      },
    };
  });
}

function isSafeRolloutPath(sessionsRoot, rolloutPath) {
  if (typeof rolloutPath !== "string" || !rolloutPath) return null;
  const resolvedRoot = fs.realpathSync(sessionsRoot);
  const candidate = path.isAbsolute(rolloutPath)
    ? rolloutPath
    : path.resolve(resolvedRoot, rolloutPath);
  const resolvedFile = fs.realpathSync(candidate);
  const relative = path.relative(resolvedRoot, resolvedFile);
  return relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    ? resolvedFile
    : null;
}

function normalizeChildRollout(events, childId, parentId, runtimeProfile, sourceFile) {
  if (runtimeProfile?.threadId !== childId) return [];
  const meta = events.find((event) => event.type === "session_meta" &&
    (event.payload?.session_id === childId || event.payload?.id === childId));
  const spawn = meta?.payload?.source?.subagent?.thread_spawn;
  if (!meta || spawn?.parent_thread_id !== parentId) return [];
  if (meta.payload.parent_thread_id && meta.payload.parent_thread_id !== parentId) return [];
  const provenance = {
    kind: TRACE_PROVENANCE,
    sourceFile: path.basename(sourceFile),
    rolloutId: meta.payload.id || null,
    runtimeProfile,
  };
  return events.map((event) => ({
    ...event,
    // Fill a missing session ID from the trusted rollout, never rewrite a
    // contradictory ID into apparent child evidence.
    session_id: event.session_id ?? childId,
    _trace_provenance: event.type === "session_meta"
      ? provenance
      : {
        kind: TRACE_PROVENANCE,
        sourceFile: path.basename(sourceFile),
        rolloutId: meta.payload.id || null,
      },
  }));
}

function getParentAndChildIds(events) {
  const parentId = events.find((event) => event.type === "thread.started")?.thread_id;
  const spawnEvents = events.filter((event) => isCollabTool(event, /spawn/iu));
  const childIds = Array.from(new Set(spawnEvents.flatMap((event) =>
    collectReceiverIds(getItem(event)),
  ))).filter((id) => id !== parentId);
  return { parentId, childIds };
}

function resolveTaskNamesToChildIds(stateDbPath, parentId, events) {
  const spawns = events.filter((event) => isCollabTool(event, /spawn/iu));
  const unresolved = spawns.filter((event) =>
    collectReceiverIds(getItem(event)).length === 0 && getSpawnValue(getItem(event), "task_name"));
  if (unresolved.length === 0) return { events, issue: null };
  let DatabaseSync;
  try { ({ DatabaseSync } = require("node:sqlite")); }
  catch { return { events, issue: "node:sqlite is unavailable; trusted runtime metadata cannot be collected" }; }
  let db;
  try { db = new DatabaseSync(stateDbPath, { readOnly: true }); }
  catch { return { events, issue: "trusted app-server runtime metadata is unavailable" }; }
  try {
    const byPath = db.prepare("SELECT id, agent_path, source FROM threads WHERE agent_path = ? AND source LIKE ?");
    const resolved = new Map();
    for (const spawn of unresolved) {
      const taskName = getSpawnValue(getItem(spawn), "task_name");
      const candidates = byPath.all(taskName, `%${parentId}%`).filter((row) =>
        row.agent_path === taskName && getRuntimeParentId(row.source) === parentId);
      if (candidates.length === 1) resolved.set(spawn, candidates[0].id);
    }
    const amended = events.map((event) => {
      const item = getItem(event);
      const id = item?.type === "collab_tool_call" ? resolved.get(event) : null;
      if (!id) return event;
      return { ...event, item: { ...item, receiver_thread_ids: [id] } };
    });
    return { events: amended, issue: null };
  } finally { db.close(); }
}

function readRuntimeRows(stateDbPath, childIds, taskNames = [], parentId = "") {
  let DatabaseSync;
  try { ({ DatabaseSync } = require("node:sqlite")); }
  catch {
    return { rows: childIds.map(() => null), issue: "node:sqlite is unavailable; trusted runtime metadata cannot be collected" };
  }
  const db = new DatabaseSync(stateDbPath, { readOnly: true });
  try {
    const queryById = db.prepare(
      "SELECT id, agent_path, model, reasoning_effort, agent_role, rollout_path, source FROM threads WHERE id = ?",
    );
    const queryByPath = db.prepare(
      "SELECT id, agent_path, model, reasoning_effort, agent_role, rollout_path, source FROM threads WHERE agent_path = ? AND source LIKE ?",
    );
    const rows = childIds.map((childId) => queryById.get(childId) || null);
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index] || !taskNames[index]) continue;
      const taskName = taskNames[index];
      const candidates = queryByPath.all(taskName, `%${parentId}%`).filter((row) => {
        const source = parseMaybeJson(row.source);
        return getRuntimeParentId(row.source) === parentId && row.agent_path === taskName;
      });
      if (candidates.length === 1) rows[index] = candidates[0];
    }
    return { rows, issue: null };
  } finally {
    db.close();
  }
}

async function collectChildRollouts(events, options = {}) {
  const parentEvidence = await collectParentToolEvidence(events, options);
  const knownCallIds = new Set(events.filter((event) => event.type === "response_item")
    .map((event) => event.payload?.call_id).filter(Boolean));
  events = [...events, ...parentEvidence.filter((event) =>
    !event.payload?.call_id || !knownCallIds.has(event.payload.call_id))];
  let normalizedParentTools = normalizeParentToolCalls(events);
  events = [...events.map((event, index) => ({ ...event, _trace_event_index: index })),
    ...normalizedParentTools].sort((left, right) => left._trace_event_index - right._trace_event_index);
  let { parentId, childIds } = getParentAndChildIds(events);
  const collectionErrors = [];
  if (parentId) {
    const resolved = resolveTaskNamesToChildIds(options.stateDb, parentId, events);
    events = resolved.events;
    const precedingChildren = new Set();
    events = events.map((event) => {
      if (isCollabTool(event, /spawn/iu)) {
        collectReceiverIds(getItem(event)).filter((id) => id !== parentId)
          .forEach((id) => precedingChildren.add(id));
      }
      const item = getItem(event);
      if (item?.wait_scope === "global-child-mailbox" && collectReceiverIds(item).length === 0) {
        return { ...event, item: { ...item, receiver_thread_ids: [...precedingChildren] } };
      }
      return event;
    });
    normalizedParentTools = events.filter((event) => isCollabTool(event, /spawn|wait/iu));
    childIds = getParentAndChildIds(events).childIds;
    if (resolved.issue) collectionErrors.push({ type: "trace_collection_error", issue: resolved.issue });
  }
  if (!options.stateDb || !options.sessionsRoot) {
    return [...normalizedParentTools, ...collectionErrors, ...childIds.map((childId) => ({
      type: "child_metadata_error", child_thread_id: childId,
      issue: "child rollout collection requires --state-db and --sessions-root",
    }))];
  }
  const spawnEvents = events.filter((event) => isCollabTool(event, /spawn/iu));
  const taskNames = childIds.map((childId) => {
    const spawn = spawnEvents.find((event) => collectReceiverIds(getItem(event)).includes(childId));
    return getSpawnValue(getItem(spawn), "task_name");
  });
  let lookup;
  try { lookup = readRuntimeRows(options.stateDb, childIds, taskNames, parentId); }
  catch {
    lookup = {
      rows: childIds.map(() => null),
      issue: "trusted app-server runtime metadata is unavailable",
    };
  }
  const collected = await Promise.all(lookup.rows.map(async (row, index) => {
    const childId = childIds[index];
    if (!row) return metadataError(childId, lookup.issue || "no app-server thread row linked to child id and parent");
    if (getRuntimeParentId(row.source) !== parentId) {
      return metadataError(childId, "app-server child row is not linked to parent thread");
    }
    let safePath;
    try {
      safePath = isSafeRolloutPath(options.sessionsRoot, row.rollout_path);
    } catch {
      return metadataError(childId, "child rollout file is unavailable");
    }
    if (!safePath) return metadataError(childId, "child rollout path is outside sessions root");
    let rawEvents;
    try {
      rawEvents = await readSessionEvidence(safePath);
    } catch {
      return metadataError(childId, "child rollout file is unreadable or invalid");
    }
    const runtimeProfile = {
      model: row.model || null,
      effort: row.reasoning_effort || null,
      agentPath: row.agent_path || null,
      role: row.agent_role || null,
      threadId: row.id,
    };
    const normalized = normalizeChildRollout(
      rawEvents, childId, parentId, runtimeProfile, safePath,
    );
    return normalized.length > 0 && runtimeProfile.model && runtimeProfile.effort
      ? normalized
      : metadataError(childId, "child rollout metadata is not linked to parent thread");
  }));
  return [...normalizedParentTools, ...collectionErrors, ...collected.flat()];
}

function metadataError(childId, issue) {
  return { type: "child_metadata_error", child_thread_id: childId, issue };
}

function validateSubagentTrace(events, options = {}) {
  events = [...events, ...normalizeParentToolCalls(events)];
  const issues = [];
  const validationMode = options.validationMode || "native-role";
  if (!["native-role", "explicit-profile"].includes(validationMode)) issues.push("unknown validation mode");
  if (validationMode === "explicit-profile" && (!options.expectedModel || !options.expectedEffort)) {
    issues.push("explicit profile validation requires expected model and effort");
  }
  issues.push(...events.filter((event) => event.type === "trace_collection_error").map((event) => event.issue));
  const parentId = events.find((event) => event.type === "thread.started")?.thread_id;
  if (!parentId) issues.push("missing parent thread.started event");
  const spawnEvents = events.filter((event) => isCollabTool(event, /spawn/iu));
  if (spawnEvents.length === 0) issues.push("missing genuine spawn tool event");
  const spawnCalls = new Map();
  for (const event of spawnEvents) {
    const item = getItem(event);
    const ids = collectReceiverIds(item).filter((id) => id !== parentId);
    const key = item.call_id || (ids.length ? `children:${ids.join(",")}` : event);
    const prior = spawnCalls.get(key);
    if (!prior || collectReceiverIds(getItem(prior)).length < ids.length) spawnCalls.set(key, event);
  }
  for (const [key, event] of spawnCalls) {
    if (collectReceiverIds(getItem(event)).filter((id) => id !== parentId).length === 0) {
      issues.push(`spawn call ${typeof key === "string" ? key : "without call id"} has no resolved distinct child thread id`);
    }
  }
  const childIds = Array.from(new Set(spawnEvents.flatMap((event) =>
    collectReceiverIds(getItem(event)),
  ))).filter((id) => id !== parentId);
  if (childIds.length === 0) issues.push("spawn event has no distinct child thread id");
  const children = childIds.map((childId) => {
    const spawnEvent = spawnEvents.find((event) =>
      collectReceiverIds(getItem(event)).includes(childId));
    return validateChild(events, childId, spawnEvent, parentId, options);
  });
  const childIssues = children.flatMap((child) => child.issues);
  issues.push(...childIssues);
  return {
    isValid: issues.length === 0,
    status: getStatus(issues),
    issues,
    parentThreadId: parentId || null,
    childThreadIds: childIds,
    children,
    validationMode,
    nativeRoleStatus: children.length && children.every((child) => child.effective.role) ? "verified" : "unverified",
    roleContractDelivery: { status: "unverified", reason: "profile evidence does not prove embedded role-instruction delivery" },
    expectedRole: options.expectedRole || null,
    expectedModel: options.expectedModel || null,
    expectedEffort: options.expectedEffort || null,
    runtimePermissions: {
      status: "unknown",
      evidence: null,
      reason: "trace metadata does not prove runtime permission enforcement",
    },
  };
}

module.exports = {
  collectChildRollouts,
  normalizeParentToolCalls,
  normalizeChildRollout,
  parseJsonLines,
  validateSubagentTrace,
};
