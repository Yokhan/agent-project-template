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
    const { getRoute } = require("./codex-route-task.js");
    const record = policy.startRequest(root, { ...input, prompt: recovered.prompt }, getRoute(recovered.prompt, { cwd: root }), {
      requestOrigin: recovered.origin,
      recoveryEvidence: { ...recovered.evidence, sourceThreadId: recovered.sourceThreadId },
    });
    return { ...record, recovered: true };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function recordLifecycle(root, input) {
  if (!input.session_id) return;
  const directory = policy.sessionRoot(root, input.session_id);
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(path.join(directory, "lifecycle.jsonl"), JSON.stringify({
    at: new Date().toISOString(), event: input.hook_event_name,
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
    input: "", env: { ...process.env, FILE_PATH: input.file_path || tool.file_path || tool.path || "",
      COMMAND: tool.command || tool.cmd || (typeof tool.input === "string" ? tool.input : ""), TOOL_NAME: input.tool_name || "" } });
  if (result.error || result.status !== 0) {
    const message = result.error?.message || result.stderr?.trim() || `${name} exited ${result.status}`;
    if (blocking) throw new Error(message);
    return message;
  }
}
function context(event, text) { return { hookSpecificOutput: { hookEventName: event, additionalContext: text } }; }
function packetContext(record) {
  const packet = policy.groundRequest(record);
  return `Mapped reading: ${path.join(record.directory, "packet.json")}\nEditorial questions: ${JSON.stringify(packet.readerPlan.topics.map(({ id, question }) => ({ id, question })))}\nRead every selected complete section in packet.json even if this hook preview is shortened. The map is navigation, not comprehension.\n` + referenceIndexContext(packet, record.state.task) +
    packet.passages.map(p => `PRIMARY ${p.sourceId} | ${p.locator} | passageSha256=${p.passageSha256}\n${p.text}`).join("\n\n");
}
function referenceIndexContext(packet, task) {
  const index = require("./lib/writing-library-index.js");
  const status = index.libraryIndexStatus();
  if (status.state !== "ready") return "Local contents/example index is unavailable or stale. Read the pinned originals directly; build the local derived index with node scripts/writing-library.js index before using copied references.\n";
  const navigation = [];
  for (const sourceId of packet.selection.sourceIds) {
    const found = index.searchExamples(task, { sourceId, limit: 2 });
    navigation.push({ sourceId, examples: (found.examples || []).map(({ locator, passageSha256, label }) => ({ locator, passageSha256, label })) });
  }
  return `Literal contents/examples are available locally: ${status.indexPath}. Inspect the actual contents for applicable sources via node scripts/writing-library.js contents --source <id>, and copied examples via examples --source <id> --query <Russian editorial question>. Matched navigation: ${JSON.stringify(navigation)}. Read the full copied excerpt and surrounding source before applying it; candidates are not verified before/after pairs and extracted PDF tables may need the original layout. Bring relevant extra context into the current packet with codex-turn refresh --query <focused question>, read it, then reapply notes and review changed bytes. Navigation and copied examples do not substitute for fresh primary reading or editorial judgment.\n`;
}
function instructions(record) {
  if (record.state.direct) return `Template request evidence: ${record.file}\nDirect small task: complete it and the smallest relevant check without a child or routing ceremony. A literal typo correction and short completion status need no book/application ritual. If you add substantive explanatory prose, read fresh primary passages and apply them to its exact bytes using scripts/codex-turn.js; Stop checks that output separately.\n`;
  return `Template request evidence: ${record.file}\nLogical request: ${record.state.requestId}. Original task and requirements survive Stop repair continuations.\n` +
    `Delegation: ${JSON.stringify(record.state.delegation)}. When required, derive scope/acceptance and launch bounded Luna High; a sequential worker is valid. CLI contract shape: {assignments:{implementer:{scope:[exact paths],acceptance:[observable checks]}},hostDispatchCapabilities:[observed native-custom-role or explicit-model-contract]}; pass it via --contract-file. Use only capabilities actually exposed by the tool schema. Wait and integrate its result. Record assignment/result with codex-turn.js integrate; a concrete host/ownership/judgment/cost fallback is visible, not Luna success. Do not spawn irrelevant work to satisfy a quota.\n` +
    "Before substantive nonfiction output, read the mapped complete primary sections and refine/add reading when context is insufficient. Refresh a stale or insufficient packet with codex-turn.js refresh --state <ledger> [--query <Russian editorial question>]; query supplements never replace mapped coverage. Read the fresh packet and reapply notes. Before final delivery save exact response bytes to an ignored local file; create principles.json with one {sourceId,passageSha256,principle,effect} per passage, then run node scripts/codex-turn.js apply --state <ledger> --artifact <file> --notes <principles.json>. Send exactly that response; no extra trailing newline. Use --target file for separate written deliverables.\n" +
    "Include any required memory-citation footer and its separator newlines in the saved exact response. Do not drop the footer or trim the body to work around a Stop mismatch: the runner can verify the host's omitted citation metadata against the actual current-turn transcript without changing draft bytes.\n" +
    "Use the local copied contents and examples to check whether the mapped reading covers the actual writing problem. Native planned reading now allows up to 96000 characters; a full packet does not silently cut sections or imply the entire book was read.\n" +
    `Editorial policy: ${JSON.stringify(record.state.editorial)}. Material authored nonfiction requires a distinct read-only writing_editor (Luna High). Generate its exact draft/source assignment via codex-turn.js editorial-assignment --state <ledger> --artifact <draft>. Give the returned assignmentFile plus project facts/approved examples to the editor. Wait for its JSON final, fix findings, and request a new review of changed bytes. Record the actual child review via codex-turn.js review-accept --state <ledger> --artifact <draft> --child <native-editor-id>. Writer-authored review JSON cannot substitute for the native child final. A short technical explanation can self-check; user opt-out stays explicit. If required review cannot run, report the acceptance gap; do not silently downgrade it. Receipts alone are insufficient. See codex-turn.js help. Small acknowledgements, actual fiction and code-only output are exempt; ambiguous substantive explanations are not.\n`;
}
async function handle(input, root = findRoot(input.cwd || process.cwd())) {
  assertSupportedRuntime();
  const event = input.hook_event_name;
  recordLifecycle(root, input);
  // Keep existing trusted hook definitions: cleanup only manager-owned scratch.
  // A live wrapper/child lease is never removed, including at another chat's Stop.
  let cleanup = null;
  if (["SessionStart", "PostToolUse", "Stop"].includes(event)) {
    let cache = managedCache.pruneCaches({ projectRoot: root, budgetMs: 1000 });
    const cacheDeadline = Date.now() + 1500;
    while (cache.reason === "operation-in-progress" && Date.now() < cacheDeadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
      cache = managedCache.pruneCaches({ projectRoot: root, budgetMs: 1000 });
    }
    cleanup = { ...managedTemp.sweep(root, { budgetMs: 1000 }), cache };
    if ((cleanup.errors.length || cleanup.pending.length || cache.overBudget || (!cache.complete && cache.reason !== "operation-in-progress")) && event !== "Stop") {
      return { systemMessage: "Temporary test cleanup needs attention: " + JSON.stringify(cleanup) +
        ". Run node scripts/managed-temp.js sweep --budget-ms 10000; preserve unknown and active directories." };
    }
  }
  if (event === "SessionStart") return context(event,
    `Native template lifecycle hooks loaded. Root: ${root}. Node: ${process.version}. Shared safety shell: ${resolveBash() || "UNAVAILABLE; security calls will block"}. Follow AGENTS.md. Hooks must be trusted in the host; scripts passing unit tests do not establish native activation. Run tests through node scripts/managed-temp.js run -- <executable> <args>; choose --profile vite|tsc|cargo|browser for supported direct build/browser tools. Windows Job Objects stop the owned process family before cleanup; unsupported platforms fail closed. Generic commands must direct custom outputs into AGENT_RUN_OUTPUT/COPY_DIR/ARCHIVE_DIR/LOG_DIR (each variable has AGENT_RUN_ prefix). Defaults: disposable cache; optional --cache shared is owned, capped at 10 GiB/project and 7 idle days, preserving active leases. Required build output needs --keep-output NEW_DIRECTORY. Owned inactive scratch and idle owned caches are swept after tools and at Stop/SessionStart; existing shared browser binaries, MCP databases, books, history, sources and unknown paths are preserved. Read node scripts/managed-temp.js report for the last bounded measured cleanup result. Cleanup: ${JSON.stringify(cleanup)}.`);
  if (event === "UserPromptSubmit") {
    const { getRoute } = require("./codex-route-task.js");
    const route = getRoute(input.prompt || "", { cwd: root });
    const record = policy.startRequest(root, input, route);
    let primary = "";
    if (record.state.writingRequested && !record.state.writingExempt && !record.state.direct) {
      try { primary = packetContext(record); }
      catch (error) { primary = `source-grounding-blocked: ${error.message}. Continue safe non-writing work; do not replace books with model memory.`; }
    }
    return context(event, instructions(record) + primary);
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
      const ownedEntry = /^\s*(?:node(?:\.exe)?\s+["']?(?:\.\/)?scripts[\\/]managed-temp\.js["']?\s+run(?:\s+--[\w-]+\s+[^\s]+)*\s+--\s|bash\s+["']?(?:\.\/)?scripts[\\/]test-template\.sh["']?\s*$|node\s+["']?(?:\.\/)?scripts[\\/]test-codex-workflows-live\.js["']?(?:\s|$))/u.test(command);
      if ((knownTest || knownBuild) && !ownedEntry) throw new Error("Run template tests with owned scratch: node scripts/managed-temp.js run [--profile vite|tsc|cargo|browser] -- <executable> <args>. The aggregate test-template.sh and live harness own their scratch automatically. Keep required evidence outside scratch. This guard recognizes normal template invocations; it is not a general shell parser.");
    }
    const record = await ensureRequest(root, input);
    if (edit) legacyCheck(root, "pre-edit-safety.sh", input, true);
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
    const cacheIncomplete = cleanup?.cache && (cleanup.cache.overBudget && !cleanup.cache.activeOverBudget || !cleanup.cache.complete && cleanup.cache.reason !== "operation-in-progress");
    if (cleanup?.errors.length || cleanup?.pending.length || cacheIncomplete) {
      result.issues.push("temporary-test-cleanup-incomplete: " + JSON.stringify(cleanup) +
        ". Run node scripts/managed-temp.js sweep --budget-ms 10000; preserve active, unknown and unresolved ownership. Diagnose refused paths; never erase markers to bypass the gate");
      result.state = "unresolved";
      policy.writeJson(path.join(record.directory, "result.json"), result);
    }
    if (result.issues.length) {
      // If a direct task produced substantive prose, provide reading on repair.
      let primary = "";
      if (!record.state.writingExempt && policy.substantive(input.last_assistant_message)) {
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
      return repair;
    }
    const last = managedReports.readReport(root);
    const summary = last ? `Owned resource result: ${JSON.stringify({ completedAt: last.completedAt, scratchRemoved: last.scratchRemoved, observedBytesRemoved: last.cleanup?.accounting?.observedBytesRemoved ?? null, cacheBytesRetained: cleanup?.cache?.bytesRetained ?? null, activeCacheOverBudget: cleanup?.cache?.activeOverBudget || false })}. Inspect node scripts/managed-temp.js report.` : null;
    return result.exception ? { systemMessage: `Delegation exception: ${result.exception.category}: ${result.exception.reason}. Luna execution is not claimed. ${summary || ""}` } : summary ? { systemMessage: summary } : {};
  }
  throw new Error(`Unsupported native hook event: ${event}`);
}
async function main() {
  let raw = "";
  for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 2000000) throw new Error("Hook input exceeds bounded limit"); }
  let input;
  try { input = JSON.parse(raw); } catch { throw new Error("Native hook JSON input required"); }
  try { process.stdout.write(JSON.stringify(await handle(input)) + "\n"); }
  catch (error) {
    if (input.hook_event_name === "Stop") process.stdout.write(JSON.stringify({ continue: false, stopReason: "Template hook failed closed", systemMessage: error.message }) + "\n");
    else if (input.hook_event_name === "PreToolUse") { process.stderr.write(error.message); process.exitCode = 2; }
    else if (error.code === "ERR_UNSUPPORTED_CODEX_RUNTIME") { process.stderr.write(error.message); process.exitCode = 2; }
    else { process.stdout.write(JSON.stringify({ systemMessage: `Template lifecycle failure: ${error.message}. Do not claim workflow gates passed.` }) + "\n"); }
  }
}
if (require.main === module) main().catch(error => { process.stderr.write(error.message); process.exitCode = 2; });
module.exports = { handle, main, findRoot, resolveBash, ensureRequest };
