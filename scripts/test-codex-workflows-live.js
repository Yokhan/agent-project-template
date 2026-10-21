#!/usr/bin/env node
"use strict";
// Explicit opt-in. These are real model calls in disposable candidate snapshots.
const fs = require("fs");
const path = require("path");
const managedTemp = require("./lib/managed-temp.js");
const managedCache = require("./lib/managed-cache.js");
const { launchOwned } = require("./lib/managed-process.js");
const { spawnSync } = require("child_process");

const SCENARIOS = {
  implementation: "Исправь parseCount в src/count.js: строка с целым неотрицательным числом должна превращаться в число; пустая строка, дробь, отрицательное число и мусор должны приводить к понятной ошибке. Проверь поведение на этих случаях.",
  writing: "Сократи описание услуги до 45–60 слов, сохрани существенную пользу и условия: тренер составляет план под доступное оборудование и расписание; если упражнение выполнить нельзя, предлагает замену, чтобы человек мог продолжать занятия. Ведение включает обратную связь по технике. Цена и сроки не указаны.",
  tiny: "Исправь опечатку в README.md",
  optout: "Без субагентов объясни в 80–100 словах, почему успешная сборка ещё не подтверждает, что пользователь может пройти сценарий входа в приложение. Не давай советов по конкретным библиотекам.",
  "missing-application": "Сократи описание услуги до 45–60 слов, сохрани существенную пользу: тренер составляет план под оборудование и расписание; если упражнение выполнить нельзя, предлагает замену, чтобы человек мог продолжать занятия. Ведение включает обратную связь по технике. Цена и сроки не указаны.",
};
function snapshot(root, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ["AGENTS.md", "CLAUDE.md", ".gitignore", "scripts", "docs", ".agents", ".claude/library", ".claude/hooks", ".codex/agents", ".codex/hooks.json", "brain/03-knowledge/communication"]) {
    const source = path.join(root, file);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, file), { recursive: true, filter: value => !value.includes("node_modules") });
  }
  fs.writeFileSync(path.join(destination, ".codex/config.toml"), "[features]\nhooks = true\n[agents]\nmax_concurrent_threads_per_session = 3\nmax_depth = 1\n");
  fs.writeFileSync(path.join(destination, "PROJECT_SPEC.md"), "# Runtime acceptance fixture\nName: workflow-acceptance-fixture\nLocal disposable candidate; no release or external changes.\n");
  fs.mkdirSync(path.join(destination, "src"));
  fs.writeFileSync(path.join(destination, "src/count.js"), '"use strict";\nmodule.exports.parseCount = function parseCount(input) { return Number(input); };\n');
  fs.writeFileSync(path.join(destination, "README.md"), "# Counter\n\nTeh counter accepts nonnegative integer strings.\n");
  for (const args of [["init", "--quiet"], ["checkout", "-b", "codex/live-workflow", "--quiet"]]) {
    const result = spawnSync("git", args, { cwd: destination, encoding: "utf8", windowsHide: true });
    if (result.status) throw new Error(result.stderr);
  }
}
async function main(argv) {
  if (!argv.includes("--yes")) { console.log("SKIP: use --yes --scenario implementation|writing|tiny|optout --codex <current native executable>; consumes model quota, uses reviewed per-run hook trust."); return; }
  const get = flag => argv[argv.indexOf(flag) + 1];
  const scenario = get("--scenario");
  const codex = get("--codex");
  if (!SCENARIOS[scenario] || !codex || !fs.existsSync(codex)) throw new Error("Valid scenario and existing native Codex executable required");
  const root = path.resolve(__dirname, "..");
  const workspace = managedTemp.createRun(root, { label: "workflow-live-" + scenario });
  const destination = path.join(workspace.temp, "snapshot");
  const reportFile = path.join(root, ".session-cache", "workflow-acceptance-" + workspace.id + ".json");
  try {
  snapshot(root, destination);
  if (scenario === "missing-application") {
    // Fault injection belongs only to this disposable harness, never the payload.
    fs.renameSync(path.join(destination, "scripts/codex-hooks.js"), path.join(destination, "scripts/codex-hooks-engine.js"));
    fs.writeFileSync(path.join(destination, "scripts/codex-hooks.js"), `"use strict";
const fs=require('fs'),path=require('path'),engine=require('./codex-hooks-engine.js'),policy=require('./lib/codex-turn-policy.js');
exports.main=async function(){let raw='';for await(const c of process.stdin)raw+=c;const input=JSON.parse(raw);const root=engine.findRoot(input.cwd||process.cwd());const marker=path.join(root,'.session-cache/injected-once.json');
if(input.hook_event_name==='Stop'&&!fs.existsSync(marker)){const r=policy.findState(root,input);const app=path.join(r.directory,'application.json');if(fs.existsSync(app)){fs.renameSync(app,path.join(r.directory,'fault-original-application.json'));policy.writeJson(marker,{requestId:r.state.requestId,fault:'missing-application'});}}
process.stdout.write(JSON.stringify(await engine.handle(input,root))+'\\n');};
`);
  }
  const log = fs.openSync(path.join(destination, "native.jsonl"), "w");
  const errors = fs.openSync(path.join(destination, "native.stderr"), "w");
  const startedAt = new Date().toISOString();
  const args = ["--strict-config", "--dangerously-bypass-hook-trust", "-C", destination,
    "-c", 'model_reasoning_effort="high"', "-a", "never", "exec", "--json", "-s", "workspace-write", "-m", "gpt-6.1-sol", SCENARIOS[scenario]];
  let result;
  try {
  workspace.setLaunching(true);
  result = await launchOwned(codex, args, { cwd: destination, stdio: ["ignore", log, errors], env: { ...process.env, TEMP: workspace.temp, TMP: workspace.temp, TMPDIR: workspace.temp, AGENT_MANAGED_TEMP: workspace.root },
    onSpawn({ hostPid, pid }) { workspace.setChildPid(hostPid || pid); } });
  if (result.treeStopped) workspace.setChildPid(null);
  else throw new Error("Native workflow process family termination is unverified");
  } finally { fs.closeSync(log); fs.closeSync(errors); }
  const events = fs.readFileSync(path.join(destination, "native.jsonl"), "utf8").split(/\r?\n/u).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } });
  const threadId = events.find(x => x.type === "thread.started")?.thread_id;
  const finals = events.filter(x => x.item?.type === "agent_message").map(x => x.item.text);
  const ledgerRoot = path.join(destination, ".session-cache/codex-turns");
  const results = [];
  let groundingPacketCount = 0;
  function scan(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name === "result.json") results.push(JSON.parse(fs.readFileSync(file, "utf8")));
      else if (entry.name === "packet.json") groundingPacketCount += 1;
    }
  }
  scan(ledgerRoot);
  const report = { scenario, destination, reportFile, threadId, startedAt, completedAt: new Date().toISOString(), result, hookTrust: "reviewed-per-invocation; persisted trust unchanged", results, groundingPacketCount,
    finalMessageSha256: finals.length ? require("crypto").createHash("sha256").update(finals.at(-1)).digest("hex") : null,
    usage: events.filter(x => x.type === "turn.completed").map(x => x.usage) };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (result.code !== 0 || !results.length || results.some(x => x.state !== "passed")) process.exitCode = 1;
  if (scenario === "implementation" && !results.some(x => x.children.some(c => c.completedAt && c.profile.model === "gpt-6-luna" && c.profile.effort === "high"))) process.exitCode = 1;
  if (["tiny", "optout"].includes(scenario) && results.some(x => x.children.length)) process.exitCode = 1;
  if (scenario === "tiny" && (groundingPacketCount || results.some(x => x.repairCount > 0))) process.exitCode = 1;
  if (scenario === "missing-application" && (!results.some(x => x.repairCount > 0) || !fs.existsSync(path.join(destination, ".session-cache/injected-once.json")))) process.exitCode = 1;
  } catch (error) {
    fs.writeFileSync(reportFile, JSON.stringify({ scenario, reportFile, error: error.message, completedAt: new Date().toISOString() }, null, 2));
    throw error;
  } finally {
    if (fs.existsSync(destination)) {
      try {
        const candidateCache = managedCache.pruneCaches({ projectRoot: destination, maxAgeMs: 0, budgetMs: 5000 });
        const candidateCleanup = managedTemp.sweep(destination, { budgetMs: 5000 });
        const candidateRuns = managedTemp.status(destination);
        if (!candidateCache.complete || candidateCache.retained.length || candidateCleanup.errors.length || candidateCleanup.pending.length || candidateRuns.length) {
          // Its external namespace still needs this project root for safe discovery.
          workspace.retain("Candidate scratch unresolved; preserve snapshot root for cleanup: " + destination);
          console.error("Candidate scratch unresolved: " + JSON.stringify({ candidateCleanup, candidateRuns }));
          process.exitCode = 1;
        }
      } catch (error) {
        workspace.retain("Candidate scratch could not be inspected; preserve snapshot: " + destination);
        console.error("Candidate cleanup check failed: " + error.message);
        process.exitCode = 1;
      }
    }
    const cleanup = workspace.finish();
    if (!cleanup.removed) { console.error("Live workflow scratch cleanup incomplete: " + JSON.stringify(cleanup)); process.exitCode = 1; }
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { snapshot, SCENARIOS };
