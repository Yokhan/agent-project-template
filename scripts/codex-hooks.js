#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const policy = require("./lib/codex-turn-policy.js");
const { recoverNativeDelegation, reconcileNativeFinal } = require("./lib/codex-request-recovery.js");
const { sha256 } = require("./lib/writing-library-store.js");
const { assertSupportedRuntime } = require("./lib/codex-runtime.js");
const managedTemp = require("./lib/managed-temp.js");
const managedCache = require("./lib/managed-cache.js");
const managedReports = require("./lib/managed-run-report.js");
const managedRunOwnership = require("./lib/managed-run-ownership.js");
const storageOperations = require("./lib/storage-operation-hooks.js");
const requestContext = require("./lib/codex-request-context.js");
const taskHandoffs = require("./lib/task-wave-handoff.js");
const LOADED_HANDLER_SHA256 = sha256(fs.readFileSync(__filename));

function assessTaskHandoff(record, finalText) {
  let checked;
  try { checked = taskHandoffs.checkHandoff(record, finalText); }
  catch (error) {
    checked = { applicable: true, state: "unresolved", progress: null,
      issues: [{ code: "task-handoff-validation", field: "handoff", message: String(error.message).slice(0, 1000) }] };
  }
  if (!checked.applicable || !checked.issues.length) return { ...checked, repeated: false };
  // Remember feedback, not authority: the same invalid exact artifact remains
  // unresolved, but cannot cause an unchanged automatic continuation loop.
  const fingerprint = sha256(JSON.stringify({ requestId: record.state.requestId,
    artifactSha256: sha256(String(finalText || "")), issues: checked.issues }));
  const file = policy.localFile(record.state.root, path.join(record.directory, `task-wave-handoff-check-${fingerprint}.json`));
  let repeated = false;
  try {
    if (!fs.lstatSync(file).isFile()) return { ...checked, repeated: true,
      issues: [{ code: "task-handoff-feedback-path", field: "handoff", message: "Feedback marker is not a regular file; preserve it for owner recovery" }] };
    repeated = true;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const issues = checked.issues.slice(0, 8).map(item => ({ ...item, message: String(item.message).slice(0, 800) }));
  if (checked.issues.length > issues.length) issues.push({ code: "task-handoff-additional-issues", field: "handoff",
    message: `${checked.issues.length - issues.length} additional validation issues; inspect the preserved handoff input through the CLI` });
  if (!repeated) policy.writeJson(file, { requestId: record.state.requestId, fingerprint,
    artifactSha256: sha256(String(finalText || "")), state: "unresolved", observedIssueCount: checked.issues.length, issues });
  return { ...checked, issues, repeated };
}

function currentTurnRecord(root, input, allowInitializing = true) {
  if (!input.turn_id) throw new Error("Native current turn_id is required");
  const session = policy.sessionRoot(root, input.session_id);
  const turnPointer = path.join(session, "turns", sha256(String(input.turn_id)) + ".json");
  if (fs.existsSync(turnPointer)) return policy.findState(root, input);
  if (input.agent_id) {
    // Native child tool events identify the child but carry the parent session.
    // Follow-up child turns do not emit another SubagentStart. Reuse only that
    // observed child's original request, never the session's current task.
    const record = policy.childRecord(root, { ...input, hook_event_name: "SubagentStop" });
    const child = policy.readJson(path.join(record.directory, "children", sha256(input.agent_id) + ".json"));
    if (child.id !== input.agent_id || !child.startedAt) throw new Error("Native child has no observed start for its original request");
    policy.writeJson(turnPointer, { file: record.file, childId: input.agent_id });
    return record;
  }
  // A session pointer may refer to a previous user request. Validate it without
  // treating it as evidence for the incoming turn or silently replacing damage.
  if (fs.existsSync(path.join(session, "current.json"))) {
    const previous = policy.findState(root, { session_id: input.session_id });
    if (previous.state.rootTurnId === input.turn_id) {
      if (allowInitializing && fs.existsSync(path.join(session, "recovery.lock"))) return null;
      // The owner may have published the turn pointer and released its lock
      // between our first pointer check and the lock check.
      if (fs.existsSync(turnPointer)) return policy.findState(root, input);
      throw new Error("Current request is missing its turn mapping; evidence was not replaced");
    }
  }
  return null;
}

async function ensureRequest(root, input, options = {}) {
  const session = policy.sessionRoot(root, input.session_id);
  const existing = currentTurnRecord(root, input);
  if (existing) return existing;
  fs.mkdirSync(session, { recursive: true });
  const lock = path.join(session, "recovery.lock");
  let fd;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fd = fs.openSync(lock, "wx"); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
      const concurrent = currentTurnRecord(root, input);
      if (concurrent) return concurrent;
    }
  }
  if (fd === undefined) throw new Error(`Native request recovery is busy; inspect ${lock} for an interrupted hook before retrying; request evidence was not replaced`);
  try {
    const concurrent = currentTurnRecord(root, input, false);
    if (concurrent) return concurrent;
    const recovered = recoverNativeDelegation(input, { ...options, ledgerAbsent: true });
    if (!recovered || recovered.status === "blocked") throw new Error(recovered?.reason || "No current native request evidence");
    const { record } = startRequestFromPrompt(root, input, recovered.prompt, {
      requestOrigin: recovered.origin,
      recoveryEvidence: { ...recovered.evidence, sourceThreadId: recovered.sourceThreadId },
    });
    return { ...record, recovered: true };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function startRequestFromPrompt(root, input, prompt, provenance = {}) {
  const { getRoute } = require("./codex-route-task.js");
  const session = policy.sessionRoot(root, input.session_id);
  const currentFile = path.join(session, "current.json");
  const previous = fs.existsSync(currentFile) ? policy.findState(root, { session_id: input.session_id }) : null;
  const acceptedFile = path.join(session, "accepted-execution.json");
  let accepted = null;
  if (fs.existsSync(acceptedFile)) {
    const pointer = policy.readJson(acceptedFile);
    if (typeof pointer.file === "string") {
      const candidate = policy.loadState(root, pointer.file);
      if (candidate.state.sessionId === input.session_id && candidate.state.delegation?.required === true) accepted = candidate;
    }
  }
  // An exact host mailbox notice is a control signal, not a new user goal.
  // Only the current same-session unresolved ledger can retain its intent.
  if (requestContext.isOrchestrationNotice(prompt) && previous) {
    const resultFile = path.join(previous.directory, "result.json");
    const result = fs.existsSync(resultFile) ? policy.readJson(resultFile) : null;
    if (!result || result.state === "unresolved") {
      policy.writeJson(path.join(session, "turns", sha256(input.turn_id) + ".json"), { file: previous.file, controlNoticeSha256: sha256(prompt) });
      return { record: previous, resolved: { kind: "orchestration-control-notice" }, route: null };
    }
  }
  const resolved = requestContext.isOrchestrationNotice(prompt)
    ? { task: prompt, routeTask: "", classificationTask: "", rawPromptSha256: sha256(prompt), kind: "orchestration-control-notice" }
    : requestContext.resolveRequestContext(prompt, previous, accepted);
  const route = getRoute(resolved.routeTask, { cwd: root });
  const continuationSource = resolved.kind === "accepted-task-continuation"
    ? [previous, accepted].find(candidate => candidate?.state.requestId === resolved.continuationOf) : null;
  const record = policy.startRequest(root, { ...input, prompt: resolved.task }, route, {
    ...provenance,
    rawPromptSha256: resolved.rawPromptSha256,
    rawPrompt: prompt,
    classificationTask: resolved.classificationTask,
    contextResolution: resolved.kind,
    continuationOf: resolved.continuationOf,
    sourcePromptSha256: continuationSource?.state.promptSha256,
  });
  if (record.state.delegation.required === true && resolved.kind !== "unlinked-continuation" && resolved.kind !== "unlinked-contextual-continuation" && resolved.kind !== "malformed-question-reply" && resolved.kind !== "unresolved-attachment-preamble") {
    policy.writeJson(acceptedFile, { file: record.file });
  } else if (resolved.kind !== "question-reply" && fs.existsSync(acceptedFile)) {
    fs.unlinkSync(acceptedFile);
  }
  return { record, resolved, route };
}

function recordLifecycle(root, input) {
  if (!input.session_id) return;
  const directory = policy.sessionRoot(root, input.session_id);
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(path.join(directory, "lifecycle.jsonl"), JSON.stringify({
    at: new Date().toISOString(), event: input.hook_event_name,
    storageCoordinationVersion: 1, managedRunOwnershipVersion: 1,
    handlerSha256: LOADED_HANDLER_SHA256,
    sessionId: input.session_id, turnId: input.turn_id || null, tool: input.tool_name || null,
    agentId: input.agent_id || null,
    ...(input.hook_event_name === "Stop" && typeof input.last_assistant_message === "string" ? {
      finalSha256: sha256(input.last_assistant_message), finalChars: input.last_assistant_message.length,
      finalEndsWithLf: input.last_assistant_message.endsWith("\n"),
      finalHasMemoryCitation: input.last_assistant_message.includes("<oai-mem-citation>"),
    } : {}),
  }) + "\n", "utf8");
}

function findRoot(start) {
  let root = path.resolve(start);
  while (!fs.existsSync(path.join(root, ".codex/hooks.json")) || !fs.existsSync(path.join(root, "scripts/codex-hooks.js"))) {
    const parent = path.dirname(root);
    if (parent === root) throw new Error("Template hook project root not found");
    root = parent;
  }
  return root;
}
function resolveBash() {
  const candidates = process.platform === "win32" ? [
    path.join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs/Git/bin/bash.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Git/bin/bash.exe"),
  ] : ["/bin/bash", "/usr/bin/bash"];
  return candidates.find(file => path.isAbsolute(file) && fs.existsSync(file)) || null;
}
function legacyCheck(root, name, input, blocking) {
  const script = path.join(root, ".claude/hooks", name);
  if (!fs.existsSync(script)) return;
  const bash = resolveBash();
  if (!bash) throw new Error("Git Bash/Bash unavailable: existing shared security checks cannot run; install/configure Bash without disabling checks");
  const tool = input.tool_input || {};
  const result = spawnSync(bash, [script], { cwd: root, encoding: "utf8", timeout: 5000, windowsHide: true,
    input: "", env: { ...process.env, TEST_MODE: "0", FILE_PATH: input.file_path || tool.file_path || tool.path || "",
      COMMAND: tool.command || tool.cmd || (typeof tool.input === "string" ? tool.input : ""), TOOL_NAME: input.tool_name || "" } });
  if (result.error || result.status !== 0) {
    const message = result.error?.message || result.stderr?.trim() || `${name} exited ${result.status}`;
    if (blocking) throw new Error(message);
    return message;
  }
}
function context(event, text) { return { hookSpecificOutput: { hookEventName: event, additionalContext: text } }; }
function failureCategory(error) {
  if (error instanceof SyntaxError) return "invalid-json";
  if (typeof error?.code === "string" && /^[A-Z0-9_]{2,48}$/u.test(error.code)) return error.code;
  return "operation-failed";
}
function cleanupAssessment(cleanup, record = null) {
  const owner = record ? {
    sessionId: record.state.sessionId,
    requestId: record.state.requestId,
    rootTurnId: record.state.rootTurnId,
  } : {};
  const pending = Array.isArray(cleanup?.pending) ? cleanup.pending : [];
  const errors = Array.isArray(cleanup?.errors) ? cleanup.errors : [];
  const entries = [...pending.map(item => ({ ...item, kind: "pending" })), ...errors.map(item => ({ ...item, kind: "error" }))];
  const assess = item => ({
    kind: item.kind,
    runId: typeof item.runId === "string" ? item.runId : null,
    path: typeof item.path === "string" ? item.path.slice(0, 300) : null,
    reason: String(item.reason || item.error || "unspecified").slice(0, 240),
    ownership: managedRunOwnership.classifyOwnership(item.ownership, owner),
  });
  const assessed = entries.map(assess);
  const current = assessed.filter(item => item.ownership === "current");
  const diagnostic = assessed.filter(item => item.ownership !== "current");
  for (const item of cleanup?.busy || []) diagnostic.push(assess({ ...item, kind: "busy" }));
  for (const item of cleanup?.skipped || []) diagnostic.push(assess({ ...item, kind: "skipped" }));
  const cache = cleanup?.cache;
  const cacheProblem = Boolean(cache && (cache.overBudget || (!cache.complete && cache.reason !== "operation-in-progress")));
  if (cacheProblem) diagnostic.push({
    kind: "cache-diagnostic", runId: null, path: null,
    reason: String(cache.reason || (cache.overBudget ? "over-budget" : "incomplete-scan")).slice(0, 240),
    paths: (Array.isArray(cache.retained) ? cache.retained : []).slice(0, 4).map(item => typeof item.path === "string" ? item.path.slice(0, 300) : null).filter(Boolean),
    ownership: "unknown",
  });
  return {
    current,
    diagnostics: diagnostic,
    cacheProblem,
    hasWarnings: entries.length > 0 || cacheProblem,
    summary: JSON.stringify({
      current: current.slice(0, 8),
      diagnostics: diagnostic.slice(0, 8),
      omitted: Math.max(0, current.length - 8) + Math.max(0, diagnostic.length - 8),
    }),
  };
}
function packetContext(record) {
  const packet = policy.groundRequest(record);
  const packetFile = path.join(record.directory, "packet.json");
  const sources = [...new Set(packet.passages.map(item => `${item.sourceId}: ${item.locator}`))];
  const checks = packet.readerPlan.topics.map(({ id, label }) => label ? `${id} (${label})` : id);
  const fixed = [
    `Full primary packet (complete sections retained): ${packetFile}`,
    "Read every selected complete section in packet.json, including needed surrounding context. The map is navigation, not comprehension.",
    "Local navigation: node scripts/writing-library.js contents --source <id>; examples --source <id> --query <editorial question>. Add missing primary context with codex-turn.js refresh --state <request.json> --query <question>, then reread and reapply notes.",
    "Selected navigation metadata:",
  ];
  const metadata = [
    ...sources.map(item => `Locator: ${item}`),
    ...checks.map(item => `Editorial check: ${item}`),
  ];
  const render = (included, omitted) => [...fixed, ...included, `Navigation metadata omitted: ${omitted}. Full packet is authoritative.`].join("\n");
  const minimum = render([], metadata.length);
  if (minimum.length > 2500) {
    throw new Error(`Required primary packet navigation is ${minimum.length} characters before optional metadata, exceeding the 2500-character limit; packet path: ${packetFile}`);
  }
  const included = [];
  for (const item of metadata) {
    const candidate = [...included, item];
    if (render(candidate, metadata.length - candidate.length).length <= 2500) included.push(item);
  }
  return render(included, metadata.length - included.length);
}
function instructions(record) {
  const base = `Request ledger: ${record.file}\nRequest id: ${record.state.requestId}. Original task remains authoritative across repairs.\n`;
  const exactRuns = `Bind managed checks to this request: node scripts/managed-temp.js run --request-state "${record.file}" -- <executable> <args>.\n`;
  if (record.state.direct) return base + exactRuns + "Do the small task and its narrow check directly. Small acknowledgements and short status need no book or review ritual. Substantive explanatory prose still needs fresh primary reading and application evidence.\n";
  const delegation = `Delegation: ${JSON.stringify(record.state.delegation)}. Derive exact scope/acceptance before dispatch; use only observed host capabilities. A completed child or fallback is not acceptance.\n`;
  const nonfiction = "For substantive nonfiction, read every selected complete primary section in packet.json, check reader situation, product facts and promised outcome, and add focused reading when needed. Save exact final bytes and source notes, then run codex-turn.js apply. Send the checked bytes unchanged.\n";
  const editorial = `Editorial policy: ${JSON.stringify(record.state.editorial)}. Material authored nonfiction uses a distinct read-only writing_editor. Assign the exact draft with codex-turn.js editorial-assignment, provide facts and approved examples, apply findings, and review changed bytes again. Record the observed native editor via review-accept; author-written review JSON is not its receipt. Report gaps honestly; this is not a universal stop barrier.\n`;
  return base + exactRuns + delegation + nonfiction + editorial + "Include required citation footer bytes in the saved response. Actual fiction, code-only output, and small acknowledgements keep their existing exemptions.\n";
}
async function handle(input, root = findRoot(input.cwd || process.cwd())) {
  assertSupportedRuntime();
  const event = input.hook_event_name;
  recordLifecycle(root, input);
  // Keep existing trusted hook definitions: cleanup only manager-owned scratch.
  // A live wrapper/child lease is never removed, including at another chat's Stop.
  let cleanup = null;
  if (["SessionStart", "PostToolUse", "Stop"].includes(event)) {
    const pruneCache = () => {
      try { return managedCache.pruneCaches({ projectRoot: root, budgetMs: 1000 }); }
      catch (error) { return { removed: [], retained: [], bytesRetained: null, complete: false, overBudget: false, activeOverBudget: false, reason: `cache-prune-${failureCategory(error)}` }; }
    };
    let cache = pruneCache();
    const cacheDeadline = Date.now() + 1500;
    while (cache.reason === "operation-in-progress" && Date.now() < cacheDeadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
      cache = pruneCache();
    }
    let swept;
    try { swept = managedTemp.sweep(root, { budgetMs: 1000 }); }
    catch (error) {
      swept = { removed: [], busy: [], skipped: [], pending: [], errors: [{ path: root, error: `managed-sweep-${failureCategory(error)}`, runId: null, ownership: null }] };
    }
    cleanup = { ...swept, cache };
    if (event === "PostToolUse") {
      const assessment = cleanupAssessment(cleanup);
      if (assessment.hasWarnings) return { systemMessage: "Nonblocking project cleanup diagnostics; these observations do not identify the current request's owned runs: " + assessment.summary +
        ". Inspect node scripts/managed-temp.js report and preserve unknown or active directories." };
    }
  }
  if (event === "SessionStart") {
    const assessment = cleanupAssessment(cleanup);
    return context(event,
    `Native template lifecycle hooks loaded. Root: ${root}. Node: ${process.version}. Shared safety shell: ${resolveBash() || "UNAVAILABLE; security calls will block"}. Follow AGENTS.md. Hooks must be trusted in the host; scripts passing unit tests do not establish native activation. Run tests through node scripts/managed-temp.js run -- <executable> <args>; choose --profile vite|tsc|cargo|browser for supported direct build/browser tools. Windows Job Objects stop the owned process family before cleanup; unsupported platforms fail closed. Generic commands must direct custom outputs into AGENT_RUN_OUTPUT/COPY_DIR/ARCHIVE_DIR/LOG_DIR (each variable has AGENT_RUN_ prefix). Defaults: disposable cache; optional --cache shared is owned, capped at 10 GiB/project and 7 idle days, preserving active leases. Required build output needs --keep-output NEW_DIRECTORY. Owned inactive scratch and idle owned caches are swept after tools and at Stop/SessionStart; existing shared browser binaries, MCP databases, books, history, sources and unknown paths are preserved. Read node scripts/managed-temp.js report for the last bounded measured cleanup result. Cleanup diagnostics (nonblocking and project-wide): ${assessment.summary}.\n${storageOperations.context(root, input)}`);
  }
  if (event === "UserPromptSubmit") {
    const { record, resolved } = startRequestFromPrompt(root, input, input.prompt || "");
    let primary = "";
    if (record.state.writingRequested && !record.state.writingExempt && !record.state.direct) {
      try { primary = packetContext(record); }
      catch (error) { primary = `source-grounding-blocked: ${error.message}. Continue safe non-writing work; do not replace books with model memory.`; }
    }
    const resolutionNote = resolved.kind === "unlinked-contextual-continuation"
      ? "This short instruction has no accepted same-session task. Read the current conversation, identify the specific work and constraints the user means, and prepare an exact scope and acceptance contract before execution. Do not treat it as blanket permission to implement everything discussed.\n"
      : resolved.kind === "unresolved-realtime-delegation"
      ? "A realtime delegation envelope was malformed or quoted and was not trusted. Its full raw text remains in the request ledger; provide the intended request directly so it can be routed safely.\n"
      : resolved.kind === "malformed-question-reply" || resolved.kind === "unresolved-attachment-preamble" || resolved.kind === "unlinked-continuation"
      ? `Request context was not safely resolved (${resolved.kind}); the raw prompt remains in the request ledger and no prior task was inherited.\n`
      : "";
    return context(event, instructions(record) + resolutionNote + primary + "\n" + storageOperations.context(root, input, record));
  }
  if (event === "SubagentStart" || event === "SubagentStop") {
    const record = policy.childRecord(root, input);
    policy.childEvent(record, input);
    return event === "SubagentStart" ? context(event,
      "Return only the assigned result and focused evidence. Preserve other workers' edits. Do not recursively delegate by default. The parent owns broad acceptance. For substantive nonfiction use fresh primary-source context for this assignment; the parent packet is available beside " + record.file) : {};
  }
  if (event === "PreToolUse") {
    const name = String(input.tool_name || "").replace(/^functions\./u, "");
    const shell = /^(?:Bash|shell|bash|exec_command)$/u.test(name);
    const edit = /^(?:apply_patch|Edit|Write|file_edit|file_write)$/u.test(name);
    if (!shell && !edit) return {};
    legacyCheck(root, "deny-sensitive-paths.sh", input, true);
    if (shell) legacyCheck(root, "pre-bash-safety.sh", input, true);
    if (shell) {
      const tool = input.tool_input || {};
      const command = String(tool.command || tool.cmd || (typeof tool.input === "string" ? tool.input : ""));
      const knownTest = /\b(?:node|bash)(?:\.exe)?\s+["']?(?:\.\/[\\/]?)?scripts[\\/]test-[\w.-]+\.(?:js|sh)\b/u.test(command);
      const knownBuild = /^\s*(?:(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?build\b|cargo(?:\.exe)?\s+(?:build|test|check|run|doc)\b|(?:vite(?:\.cmd)?\s+build|tsc(?:\.cmd)?)(?:\s|$)|(?:chrome|chromium|msedge)(?:\.exe)?(?:\s|$))/u.test(command);
      const ownedEntry = /^\s*(?:node(?:\.exe)?\s+["']?(?:\.\/)?scripts[\\/]managed-temp\.js["']?\s+run(?:\s+--[\w-]+\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s\r\n]+))*\s+--\s|bash\s+["']?(?:\.\/)?scripts[\\/]test-template\.sh["']?\s*$|node\s+["']?(?:\.\/)?scripts[\\/]test-codex-workflows-live\.js["']?(?:\s|$))/u.test(command);
      if ((knownTest || knownBuild) && !ownedEntry) throw new Error("Run template tests with owned scratch: node scripts/managed-temp.js run [--profile vite|tsc|cargo|browser] -- <executable> <args>. The aggregate test-template.sh and live harness own their scratch automatically. Keep required evidence outside scratch. This guard recognizes normal template invocations; it is not a general shell parser.");
    }
    const record = await ensureRequest(root, input);
    if (edit) legacyCheck(root, "pre-edit-safety.sh", input, true);
    if (shell) storageOperations.beforeTool(root, input, record);
    if (!record.recovered) return {};
    let primary = "";
    if (record.state.writingRequested && !record.state.writingExempt && !record.state.direct) {
      try { primary = packetContext(record); }
      catch (error) { primary = `source-grounding-blocked: ${error.message}. Continue safe non-writing work; do not replace books with model memory.`; }
    }
    return context(event, "Native create_thread task recovered from its current typed transcript output; UserPromptSubmit was not observed.\n" + instructions(record) + primary);
  }
  if (event === "PostToolUse") {
    if (/^(?:functions\.)?(?:apply_patch|Edit|Write|file_edit|file_write)$/u.test(String(input.tool_name || ""))) {
      const warning = legacyCheck(root, "check-encoding.sh", input, false);
      const result = spawnSync(process.execPath, [path.join(root, "scripts/validate-design-policy.js"), "--hook"], { cwd: root, encoding: "utf8", timeout: 5000, windowsHide: true });
      if (warning || result.status) return { systemMessage: warning || result.stdout?.slice(0, 1200) || "Design policy check failed" };
    }
    if (input.turn_id && storageOperations.inspect(root, input).registryPresent) {
      return context(event, storageOperations.context(root, input, currentTurnRecord(root, input)));
    }
    return {};
  }
  if (event === "Stop") {
    const record = await ensureRequest(root, input);
    let deliveredMessage = input.last_assistant_message;
    const applicationFile = path.join(record.directory, "application.json");
    if (fs.existsSync(applicationFile)) {
      try {
        const application = policy.readJson(applicationFile);
        const artifact = fs.readFileSync(policy.localFile(root, application.artifact), "utf8");
        if (artifact !== deliveredMessage) {
          const reconciled = reconcileNativeFinal(input, artifact);
          if (reconciled) {
            deliveredMessage = reconciled.message;
            policy.writeJson(path.join(record.directory, "native-final-carrier.json"), reconciled.evidence);
          }
        }
      } catch { /* Normal exact-output checks retain missing/invalid evidence. */ }
    }
    const result = policy.checkRequest(record, deliveredMessage);
    const handoff = assessTaskHandoff(record, deliveredMessage);
    if (handoff.applicable) {
      result.taskHandoff = { state: handoff.state, progress: handoff.progress, consistencyOnly: true };
      if (handoff.issues.length) {
        result.issues.push(...handoff.issues.map(({ code, field, message }) => `${code}: ${field}: ${message}`));
        result.state = "unresolved";
      }
      policy.writeJson(path.join(record.directory, "result.json"), result);
    }
    const unfinishedStorage = storageOperations.unfinished(root, input, record);
    if (unfinishedStorage) {
      result.issues.push("storage-operation-unfinished: " + unfinishedStorage);
      result.state = "unresolved";
      policy.writeJson(path.join(record.directory, "result.json"), result);
    }
    const cleanupState = cleanupAssessment(cleanup, record);
    if (cleanupState.current.length) {
      result.issues.push("current-request-managed-run-cleanup-incomplete: " + JSON.stringify(cleanupState.current.slice(0, 8)) +
        ". Diagnose these exact request-owned run paths; preserve markers until their ownership and process state are resolved.");
      result.state = "unresolved";
      policy.writeJson(path.join(record.directory, "result.json"), result);
    }
    if (result.issues.length) {
      const handoffOnly = result.issues.every(issue => issue.startsWith("task-handoff-"));
      if (handoffOnly && handoff.repeated) return {
        continue: false,
        stopReason: "Task handoff remains unresolved; identical feedback was already reported",
        systemMessage: result.issues.join("\n"),
      };
      // If a direct task produced substantive prose, provide reading on repair.
      let primary = "";
      if (!handoffOnly && !record.state.writingExempt && policy.substantive(input.last_assistant_message)) {
        try { primary = "\n" + packetContext(record); } catch { /* original issue remains visible */ }
      }
      const repair = policy.continuation(record, result.issues);
      if (repair.reason && record.recovered) primary = "\n" + instructions(record) + primary;
      if (repair.reason && primary) {
        // Persist exactly the reason returned to Codex for single-use matching.
        repair.reason += primary;
        const pending = path.join(policy.sessionRoot(root, input.session_id), "pending.json");
        policy.writeJson(pending, { file: record.file, reason: repair.reason, reasonSha256: require("./lib/writing-library-store.js").sha256(repair.reason) });
      }
      if (cleanupState.diagnostics.length) repair.systemMessage = `${repair.systemMessage ? repair.systemMessage + "\n" : ""}Nonblocking project cleanup diagnostics (not attributed to this request): ${cleanupState.summary}`;
      return repair;
    }
    let summary = cleanupState.diagnostics.length ? `Nonblocking project cleanup diagnostics (not attributed to this request): ${cleanupState.summary}` : null;
    if (record.state.delegation?.required && result.preferredProfileSource === "current-policy-fallback-snapshot-unavailable") summary = `${summary ? summary + " " : ""}Preferred worker snapshot unavailable; this request was checked against the current policy profile.`;
    if (handoff.applicable && handoff.state === "passed") summary =
      `Task handoff consistency checked; this is not product acceptance. ${taskHandoffs.formatProgress(handoff.progress)}` + (summary ? ` ${summary}` : "");
    let last = null;
    let reportReadFailure = null;
    try { last = managedReports.readReport(root); }
    catch (error) { reportReadFailure = failureCategory(error); }
    if (reportReadFailure) summary = `${summary ? summary + " " : ""}Latest project report could not be read (diagnostic only; no request ownership was established): ${reportReadFailure}`;
    let immutableReport = null;
    let immutableReportPath = null;
    if (last?.runId) {
      try {
        immutableReportPath = managedReports.reportFile(root, last.runId);
        immutableReport = managedReports.readReportPath(immutableReportPath);
      } catch { immutableReportPath = null; }
    }
    const report = immutableReport || last;
    const reportOwnership = managedRunOwnership.classifyOwnership(report?.ownership, {
      sessionId: record.state.sessionId, requestId: record.state.requestId, rootTurnId: record.state.rootTurnId,
    });
    if (immutableReport && reportOwnership === "current") {
      summary = `Current-request managed-run result: ${JSON.stringify({ runId: report.runId, report: immutableReportPath, completedAt: report.completedAt, scratchRemoved: report.scratchRemoved, observedBytesRemoved: report.cleanup?.accounting?.observedBytesRemoved ?? null })}. Inspect node scripts/managed-temp.js report --report-path "${immutableReportPath}".` + (summary ? ` ${summary}` : "");
    } else if (last) {
      summary = `${summary ? summary + " " : ""}Latest project report is diagnostic only (ownership=${reportOwnership}, runId=${report?.runId || "unknown"}, path=${immutableReportPath || "unavailable"}); it is not evidence for this request.`;
    }
    if (cleanup?.cache) summary = `${summary ? summary + " " : ""}Project cache observation: ${JSON.stringify({ bytesRetained: cleanup.cache.bytesRetained ?? null, activeOverBudget: cleanup.cache.activeOverBudget || false, complete: cleanup.cache.complete !== false })}.`;
    return result.exception ? { systemMessage: `Delegation exception: ${result.exception.category}: ${result.exception.reason}. Preferred-worker execution is not claimed. ${summary || ""}` } : summary ? { systemMessage: summary } : {};
  }
  throw new Error(`Unsupported native hook event: ${event}`);
}
async function main() {
  let raw = "";
  for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 2000000) throw new Error("Hook input exceeds bounded limit"); }
  let input;
  try { input = JSON.parse(raw); } catch { throw new Error("Native hook JSON input required"); }
  try {
    process.stdout.write(JSON.stringify(await handle(input)) + "\n");
  }
  catch (error) {
    if (input.hook_event_name === "Stop") process.stdout.write(JSON.stringify({ continue: false, stopReason: "Template hook failed closed", systemMessage: error.message }) + "\n");
    else if (input.hook_event_name === "PreToolUse") {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: {
        hookEventName: "PreToolUse", permissionDecision: "deny",
        permissionDecisionReason: String(error.message || error).slice(0, 2000),
      } }) + "\n");
    }
    else if (error.code === "ERR_UNSUPPORTED_CODEX_RUNTIME") { process.stderr.write(error.message); process.exitCode = 2; }
    else { process.stdout.write(JSON.stringify({ systemMessage: `Template lifecycle failure: ${error.message}. Do not claim workflow gates passed.` }) + "\n"); }
  }
}
if (require.main === module) main().catch(error => { process.stderr.write(error.message); process.exitCode = 2; });
module.exports = { handle, main, findRoot, resolveBash, ensureRequest, startRequestFromPrompt, packetContext };
