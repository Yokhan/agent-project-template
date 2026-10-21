#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const policy = require("./lib/codex-turn-policy.js");
const { run } = require("./codex-turn.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "codex-native-hooks-"));
const cleanupRoot = path.join(fixture, "cleanup-hooks");
try {
  const input = { session_id: "session-one", turn_id: "turn-one", prompt: "Спасибо" };
  const record = policy.startRequest(fixture, input, { workflowDepth: "direct", delegationDecision: { required: false } });
  assert.equal(record.state.writingExempt, true);
  const shortLetter = policy.startRequest(fixture, { session_id: "short-letter", turn_id: "letter", prompt: "Напиши короткое письмо клиенту" }, { workflowDepth: "direct" });
  assert.equal(shortLetter.state.direct, false, "a short authored deliverable still needs mapped reading and an editor");
  assert.equal(shortLetter.state.editorial.independentRequired, true);
  assert(policy.checkRequest(shortLetter, "Готово: [letter.md](letter.md)").issues.some(x => x.includes("writing-application-missing")), "a standalone authored letter cannot use the file-delivery acknowledgement path");
  fs.writeFileSync(path.join(fixture, "report.md"), "verified delivery artifact", "utf8");
  const registeredArtifact = [{ artifact: path.join(fixture, "report.md") }];
  assert.equal(policy.deliveryAcknowledgement("Готово: [report.md](report.md)", registeredArtifact, fixture), true);
  const absoluteArtifact = path.resolve(fixture, "report.md").replace(/\\/gu, "/");
  assert.equal(policy.deliveryAcknowledgement(`Готово: [report.md](${absoluteArtifact})`, registeredArtifact, fixture), true);
  assert.equal(policy.deliveryAcknowledgement(`Сохранено. [документ](/${absoluteArtifact})`, registeredArtifact, fixture), process.platform === "win32", "the extra slash is a Windows drive UI alias only");
  assert.equal(policy.deliveryAcknowledgement(`Saved: [report](${absoluteArtifact})`, registeredArtifact, fixture), true);
  fs.mkdirSync(path.join(fixture, "My Project"));
  fs.writeFileSync(path.join(fixture, "My Project", "draft report.md"), "verified spaced artifact", "utf8");
  const spacedArtifact = path.join(fixture, "My Project", "draft report.md");
  const spacedRelative = path.relative(fixture, spacedArtifact).replace(/\\/gu, "/");
  const spacedAbsolute = path.resolve(spacedArtifact).replace(/\\/gu, "/");
  const registeredSpacedArtifact = [{ artifact: spacedArtifact }];
  assert.equal(policy.deliveryAcknowledgement(`Done: [draft report.md](<${spacedRelative}>)`, registeredSpacedArtifact, fixture), true, "balanced CommonMark brackets preserve exact relative paths with spaces");
  assert.equal(policy.deliveryAcknowledgement(`Done: [file](<${spacedAbsolute}>)`, registeredSpacedArtifact, fixture), true, "balanced CommonMark brackets preserve exact absolute paths with spaces");
  assert.equal(policy.deliveryAcknowledgement(`Done: [file](</${spacedAbsolute}>)`, registeredSpacedArtifact, fixture), process.platform === "win32", "the Windows /C:/ alias supports paths with spaces");
  fs.writeFileSync(path.join(fixture, "My Project", "draft (final).md"), "verified parenthesized artifact", "utf8");
  const parenthesizedArtifact = path.join(fixture, "My Project", "draft (final).md");
  const parenthesizedRelative = path.relative(fixture, parenthesizedArtifact).replace(/\\/gu, "/");
  const parenthesizedAbsolute = path.resolve(parenthesizedArtifact).replace(/\\/gu, "/");
  const registeredParenthesizedArtifact = [{ artifact: parenthesizedArtifact }];
  assert.equal(policy.deliveryAcknowledgement(`Done: [draft (final).md](<${parenthesizedAbsolute}>)`, registeredParenthesizedArtifact, fixture), true, "CommonMark angle targets support balanced parentheses");
  assert.equal(policy.deliveryAcknowledgement(`Saved: [document](</${parenthesizedAbsolute}>)`, registeredParenthesizedArtifact, fixture), process.platform === "win32", "the Windows alias supports bracketed spaces and parentheses");
  assert.equal(policy.deliveryAcknowledgement(`Saved: [document](${parenthesizedRelative})`, registeredParenthesizedArtifact, fixture), false, "bare spaces do not make a CommonMark link");
  fs.writeFileSync(path.join(fixture, "draft(final).md"), "balanced bare destination", "utf8");
  assert.equal(policy.deliveryAcknowledgement("Done: [file](draft(final).md)", [{ artifact: path.join(fixture, "draft(final).md") }], fixture), true);
  const bracketName = path.join(fixture, "report[final.md");
  fs.writeFileSync(bracketName, "neutral label required", "utf8");
  assert.equal(policy.deliveryAcknowledgement("Done: [report[final.md](<report[final.md>)", [{ artifact: bracketName }], fixture), false);
  assert.equal(policy.deliveryAcknowledgement("Done: [file](<report[final.md>)", [{ artifact: bracketName }], fixture), true);
  const encodedParenthesized = encodeURI(parenthesizedRelative).replace(/\(/gu, "%28").replace(/\)/gu, "%29");
  assert.equal(policy.deliveryAcknowledgement(`Done: [draft (final).md](${encodedParenthesized})`, registeredParenthesizedArtifact, fixture), true, "URI-encoded spaces and parentheses resolve to the exact artifact");
  for (const message of [
    "Готово: [other.md](other.md)",
    "    Done: [file](report.md)",
    "\tDone: [file](report.md)",
    "Done:\n\n    [file](report.md)",
    "Done:\n\n\t[file](report.md)",
    "Готово: [file](My Project/draft report.md)",
    "Готово: [report.md](report.md) Подробности ниже.",
    "Готово: [report.md](report.md)\n\nПроверка завершена.",
    "Рекламный текст: [report.md](report.md)",
    "Готово: [Купите сейчас!](report.md)",
    "Готово: [report.md](report.md), проверил и всё исправлено.",
    "Готово: [report.md](https://example.test/report.md)",
    "Готово: [draft report.md](<<My Project/draft report.md>>)",
    "Готово: [draft report.md](<My Project/draft report.md)",
    "Готово: [draft report.md](My Project/draft report.md>)",
    "Готово: [draft report.md](<My Project/draft report.md> extra)",
    "Готово: [draft report.md](<My Project/draft report.md>)[other](other)",
    "Готово: [draft (final).md](<My Project/draft (final).md>) extra",
  ]) assert.equal(policy.deliveryAcknowledgement(message, [...registeredArtifact, ...registeredSpacedArtifact, ...registeredParenthesizedArtifact], fixture), false, `unverified delivery wording must stay on the writing gate: ${message}`);
  assert.equal(policy.deliveryAcknowledgement("Готово: [report.md](report.md)", [], fixture), false, "an acknowledgement without registered files cannot bypass the writing gate");
  assert.equal(policy.checkRequest(record, "Пожалуйста.").state, "passed");
  const typo = policy.startRequest(fixture, { session_id: "typo", turn_id: "typo", prompt: "Исправь опечатку в README.md" }, { workflowDepth: "direct", delegationDecision: { required: false } });
  assert.equal(policy.checkRequest(typo, "В README.md исправлено Teh на The.").state, "passed", "a direct typo confirmation needs no writing ceremony");
  assert(policy.checkRequest(typo, "Содержательное объяснение ".repeat(12)).issues.some(x => x.includes("writing-application-missing")), "direct tasks do not exempt substantive explanations");
  const repair = policy.continuation(record, ["writing missing"]);
  const continued = policy.startRequest(fixture, { ...input, turn_id: "turn-two", prompt: repair.reason }, {});
  assert.equal(continued.state.requestId, record.state.requestId);
  assert.equal(continued.state.repairs, 1);
  assert.equal(policy.findState(fixture, { ...input, turn_id: "turn-two" }).state.requestId, record.state.requestId);
  const replay = policy.startRequest(fixture, { ...input, turn_id: "turn-three", prompt: repair.reason }, {});
  assert.notEqual(replay.state.requestId, record.state.requestId, "continuation token is single-use");
  const next = policy.startRequest(fixture, { ...input, turn_id: "turn-four", prompt: "Спасибо" }, { workflowDepth: "direct" });
  assert.notEqual(next.state.requestId, record.state.requestId, "ordinary user request cannot inherit prior evidence");
  assert(policy.checkRequest(next, null).issues.some(x => x.includes("unavailable")));
  const required = policy.startRequest(fixture, { session_id: "other", turn_id: "t", prompt: "Inspect independent code modules" }, { delegationDecision: { required: true } });
  required.state.writingExempt = true;
  policy.writeJson(required.file, required.state);
  assert(policy.checkRequest(required, "Done").issues.some(x => x.includes("delegation-missing")));
  policy.childEvent(required, { agent_id: "unknown-id", agent_type: "scout", hook_event_name: "SubagentStart" });
  const steered = policy.startRequest(fixture, { session_id: "other", turn_id: "steered", prompt: "Спасибо" }, {});
  const completion = { session_id: "other", turn_id: "child-turn", agent_id: "unknown-id", agent_type: "scout", hook_event_name: "SubagentStop", last_assistant_message: "Done" };
  assert.equal(policy.childRecord(fixture, completion).state.requestId, required.state.requestId);
  assert.notEqual(policy.childRecord(fixture, completion).state.requestId, steered.state.requestId);
  policy.childEvent(required, completion);
  assert(policy.checkRequest(required, "Done").issues.some(x => x.includes("delegation-missing")), "role labels don't prove effective Luna");
  assert.throws(() => policy.fallback(fixture, required.file, "preference", "just use parent"));
  policy.fallback(fixture, required.file, "host-unavailable", "This host does not expose subagent dispatch tools in its active tool schema.");
  assert.equal(policy.checkRequest(required, "Done").state, "passed");
  const result = policy.checkRequest(required, "Done");
  assert(result.exception && !result.children.some(x => x.profile.status === "runtime-correlated"));
  assert.throws(() => run(["integrate", "--state", required.file, "--child", "x"], fixture));
  const writing = policy.startRequest(fixture, { session_id: "writing", turn_id: "w", prompt: "Объяснить причину ошибки" }, {});
  assert(policy.checkRequest(writing, "Это содержательный ответ с объяснением причины ошибки, результатами проверки и конкретным следующим действием для пользователя. Проверка должна обнаружить отсутствие чтения.").issues.some(x => x.includes("writing-application-missing")));
  policy.continuation(writing, ["missing"]);
  policy.continuation(writing, ["missing"]);
  assert.equal(policy.continuation(writing, ["missing"]).continue, false, "retry exhaustion cannot become success");
  assert.throws(() => policy.localFile(fixture, "../escape"));
  for (const prompt of ["Explain the difference between a novel and a short story", "Объясни, как устроен диалог и как разрешать конфликты в отношениях", "Write a novel publication plan", "Write a scene analysis", "Напиши план публикации романа"]) {
    const nonfic = policy.startRequest(fixture, { session_id: "nonfic", turn_id: prompt, prompt }, {});
    assert.equal(nonfic.state.writingExempt, false, "literary nouns don't exempt explanations");
    assert(policy.checkRequest(nonfic, "Краткое объяснение.").issues.some(x => x.includes("writing-application-missing")));
  }
  for (const prompt of ["Напиши сцену диалога двух героев в романе", "Write a short story about a business owner", "Write a story about a business plan", "Напиши сцену технического спора двух инженеров", "Draft a poem"]) {
    const narrative = policy.startRequest(fixture, { session_id: "fiction", turn_id: prompt, prompt }, {});
    assert.equal(narrative.state.writingExempt, true, "the subject of actual fiction does not change its artifact kind");
  }
  const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, "../.codex/hooks.json"), "utf8"));
  for (const event of ["SessionStart", "UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop"]) assert(hooks.hooks[event]?.length);
  for (const name of ["Bash", "exec_command", "apply_patch", "functions.exec_command"]) assert(new RegExp(hooks.hooks.PreToolUse[0].matcher).test(name));
  const native = spawnSync(process.execPath, [path.join(__dirname, "codex-hooks.js")], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: path.resolve(__dirname, "..") }), encoding: "utf8", windowsHide: true });
  assert.equal(native.status, 0, native.stderr);
  assert(JSON.parse(native.stdout).hookSpecificOutput.additionalContext.includes("Native template lifecycle"));
  // Exercise real handler entrypoints in separate processes, with abandoned owned scratch.
  fs.mkdirSync(cleanupRoot);
  const engine = path.join(__dirname, "codex-hooks.js");
  const manager = path.join(__dirname, "lib/managed-temp.js");
  const cacheManager = path.join(__dirname, "lib/managed-cache.js");
  for (const event of ["SessionStart", "PostToolUse", "Stop"]) {
    const allocate = spawnSync(process.execPath, ["-e", "const m=require(process.argv[1]),fs=require('fs'),p=require('path'),c=require(process.argv[3]);const retry=fn=>{const until=Date.now()+1500;for(;;){try{const value=fn();if(value?.reason!=='operation-in-progress')return value}catch(error){if(!error.message.endsWith('operation-in-progress'))throw error}if(Date.now()>=until)throw Error('Timed out waiting for the managed-cache fixture operation claim');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25)}};const r=m.createRun(process.argv[2]);fs.writeFileSync(p.join(r.temp,'test-cache'),Buffer.alloc(4096));const l=retry(()=>c.acquireCache(process.argv[2],'hook-fixture',{runRoot:r.root}));fs.writeFileSync(p.join(l.path,'cache'),Buffer.alloc(8192));retry(()=>l.release());const f=p.join(l.path,c.CACHE_MARKER),v=JSON.parse(fs.readFileSync(f));v.lastUsedAt='2000-01-01T00:00:00Z';fs.writeFileSync(f,JSON.stringify(v));", manager, cleanupRoot, cacheManager], { encoding: "utf8", windowsHide: true });
    assert.equal(allocate.status, 0, allocate.stderr);
    const invoke = spawnSync(process.execPath, ["-e", "const root=process.argv[2],event=process.argv[3],policy=require(process.argv[4]);const input={hook_event_name:event,session_id:'cleanup-hook',turn_id:event,prompt:'Спасибо',tool_name:'exec_command',last_assistant_message:'Пожалуйста.'};policy.startRequest(root,input,{workflowDepth:'direct',delegationDecision:{required:false}});require(process.argv[1]).handle(input,root).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1});", engine, cleanupRoot, event, path.join(__dirname, "lib/codex-turn-policy.js")], { encoding: "utf8", windowsHide: true });
    assert.equal(invoke.status, 0, invoke.stderr);
    assert(!JSON.parse(invoke.stdout).stopReason, invoke.stdout);
    assert.deepEqual(require(manager).status(cleanupRoot), [], event + " must remove abandoned owned work");
    assert(!fs.existsSync(require(cacheManager).cachePath(cleanupRoot, "hook-fixture")), event + " must remove expired inactive owned cache");
  }
  const guard = spawnSync(process.execPath, ["-e", "require(process.argv[1]).handle({hook_event_name:'PreToolUse',tool_name:'exec_command',tool_input:{cmd:'node scripts/test-sync-template.js'}},process.argv[2]).then(()=>{console.error('unmanaged test accepted');process.exitCode=1}).catch(e=>{if(!e.message.includes('owned scratch')){console.error(e);process.exitCode=1}});", engine, cleanupRoot], { encoding: "utf8", windowsHide: true });
  assert.equal(guard.status, 0, guard.stderr);
  for (const command of ["cargo build --offline", "npm run build", "chrome.exe --headless"]) {
    const buildGuard = spawnSync(process.execPath, ["-e", "require(process.argv[1]).handle({hook_event_name:'PreToolUse',tool_name:'exec_command',tool_input:{cmd:process.argv[3]}},process.argv[2]).then(()=>{process.exitCode=1}).catch(e=>{if(!e.message.includes('owned scratch')){console.error(e);process.exitCode=1}});", engine, cleanupRoot, command], { encoding: "utf8", windowsHide: true });
    assert.equal(buildGuard.status, 0, buildGuard.stderr);
  }
  const stalled = spawnSync(process.execPath, ["-e", "const m=require(process.argv[1]),fs=require('fs'),p=require('path');const r=m.createRun(process.argv[2]);fs.writeFileSync(p.join(p.dirname(r.root),r.id+'.cleanup-claim'),'');", manager, cleanupRoot], { encoding: "utf8", windowsHide: true });
  assert.equal(stalled.status, 0, stalled.stderr);
  const blocked = spawnSync(process.execPath, ["-e", "const root=process.argv[2],input={hook_event_name:'Stop',session_id:'cleanup-block',turn_id:'cleanup-block',prompt:'Спасибо',last_assistant_message:'Пожалуйста.'};require(process.argv[3]).startRequest(root,input,{workflowDepth:'direct',delegationDecision:{required:false}});require(process.argv[1]).handle(input,root).then(r=>console.log(JSON.stringify(r)));", engine, cleanupRoot, path.join(__dirname, "lib/codex-turn-policy.js")], { encoding: "utf8", windowsHide: true });
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).decision, "block", "unresolved cleanup must block completion");
  assert(JSON.parse(blocked.stdout).reason.includes("temporary-test-cleanup-incomplete"));
  const blockedRecord = policy.findState(cleanupRoot, { session_id: "cleanup-block", turn_id: "cleanup-block" });
  assert.equal(policy.readJson(path.join(blockedRecord.directory, "result.json")).state, "unresolved");
  console.log("Native hooks: request isolation, continuation/replay, missing reading/delegation, unknown model, fallback and bounded failure checks passed");
} finally {
  // This test deliberately leaves malformed claims. Remove only its exact
  // randomly allocated namespace before deleting the fixture project root.
  if (fs.existsSync(cleanupRoot)) {
    const managed = require("./lib/managed-temp.js");
    const namespace = managed.managedBase(cleanupRoot);
    const expected = path.join(os.homedir(), ".cache", "apt-t",
      require("crypto").createHash("sha256").update(fs.realpathSync.native(cleanupRoot), "utf8").digest("hex").slice(0, 32));
    assert.equal(namespace, expected);
    managed.assertNoLinks(namespace, { allowMissing: true });
    fs.rmSync(namespace, { recursive: true, force: true });
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}
