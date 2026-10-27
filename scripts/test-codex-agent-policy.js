#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  AGENT_POLICY,
  getAgentProfiles,
  getFanoutDecision,
  validateWriteAssignments,
  getResourceRecommendation,
  isLikelySmallTask,
  validateResourceRequest,
  isImplementationRequest,
} = require("./codex-agent-policy.js");

const EXPECTED_PROFILES = {
  scout: ["gpt-6-luna", "high", "read-only"],
  log_analyst: ["gpt-6-luna", "high", "read-only"],
  summarizer: ["gpt-6-luna", "high", "read-only"],
  pr_explorer: ["gpt-6-luna", "high", "read-only"],
  docs_researcher: ["gpt-6-luna", "high", "read-only"],
  tester: ["gpt-6-luna", "high", "read-only"],
  writing_editor: ["gpt-6-luna", "high", "read-only"],
  implementer: ["gpt-6-luna", "high", "workspace-write"],
  reviewer: ["gpt-6.1-sol", "high", "read-only"],
  design_reviewer: ["gpt-6.1-sol", "high", "read-only"],
  product_reviewer: ["gpt-6.1-sol", "high", "read-only"],
  security_reviewer: ["gpt-6.1-sol", "high", "read-only"],
  systems_reviewer: ["gpt-6.1-sol", "high", "read-only"],
  architecture_consultant: ["gpt-6.1-sol", "high", "read-only"],
};

function getProfileSnapshot() {
  return Object.fromEntries(
    getAgentProfiles().map(({ name, model, effort, sandboxMode }) => [
      name,
      [model, effort, sandboxMode],
    ]),
  );
}

function assertFanoutDecision(decision, expected) {
  assert.strictEqual(decision.status, expected.status);
  assert.strictEqual(decision.reason, expected.reason);
  assert.strictEqual(decision.maxChildren, 3);
  assert.strictEqual(decision.maxDepth, 1);
  assert.strictEqual(decision.maxAutomaticWaves, 1);
  assert.strictEqual(decision.notifyUser, true);
  assert.strictEqual(decision.readOnlyFirst, true);
  assert.strictEqual(decision.requireRuntimeProfileEvidence, true);
}

function testFanoutDecisions() {
  assertFanoutDecision(
    getFanoutDecision({ task: "Что такое GPT-5.6?", risk: "MEDIUM", candidates: ["docs_researcher", "reviewer"] }),
    { status: "skip", reason: "xs-direct-task" },
  );
  assertFanoutDecision(
    getFanoutDecision({ task: "review docs", risk: "MEDIUM", candidates: ["docs_researcher"] }),
    { status: "conditional", reason: "parallel-value-not-yet-proven" },
  );
  assertFanoutDecision(
    getFanoutDecision({ task: "compare docs and implementation", risk: "MEDIUM", candidates: ["docs_researcher", "reviewer"] }),
    { status: "recommended", reason: "parallel-independent-lanes-available" },
  );
  const required = getFanoutDecision({
    task: "update and release the template",
    risk: "HIGH",
    candidates: ["pr_explorer", "systems_reviewer", "tester", "reviewer"],
  });
  assertFanoutDecision(required, {
    status: "required",
    reason: "high-risk-independent-verification",
  });
  assertFanoutDecision(
    getFanoutDecision({
      task: "Read-only template patch review; do not modify files",
      risk: "HIGH",
      modes: ["template"],
      candidates: ["systems_reviewer", "tester"],
    }),
    { status: "conditional", reason: "parallel-value-not-yet-proven" },
  );
  assert.strictEqual(required.candidates.length, 3);
}

function testXsAndReadOnlyBoundaries() {
  for (const task of ["Fix typo", "Check one line", "Update one comment"]) {
    assertFanoutDecision(
      getFanoutDecision({
        task,
        risk: "HIGH",
        candidates: ["scout", "tester", "reviewer"],
        modes: ["review"],
      }),
      { status: "skip", reason: "xs-direct-task" },
    );
  }

  assertFanoutDecision(
    getFanoutDecision({
      task: "Read-only review of AGENTS.md routing policy",
      risk: "HIGH",
      candidates: ["scout", "systems_reviewer", "tester"],
      modes: ["template", "review"],
    }),
    { status: "conditional", reason: "parallel-value-not-yet-proven" },
  );

  assertFanoutDecision(
    getFanoutDecision({
      task: "Comprehensive audit across modules without changes",
      risk: "HIGH",
      candidates: ["scout", "systems_reviewer", "tester"],
      modes: ["template", "review"],
    }),
    { status: "recommended", reason: "parallel-independent-lanes-available" },
  );
}

function testFanoutOptOuts() {
  for (const task of [
    "release without subagents",
    "do not delegate",
    "don't spawn subagents",
    "without any subagents",
    "no fan-out",
    "no swarm",
    "Do not spawn child agents",
    "don't use multiple agents",
    "не запускай дочерних агентов",
    "аудит без дочерних агентов",
    "review without swarm",
    "do not use swarm",
    "аудит без swarm",
    "не запускай рой",
    "проверь без роя",
    "релиз без субагентов",
    "не запускай субагентов",
    "не делегируй",
  ]) {
    assertFanoutDecision(
      getFanoutDecision({ task, risk: "HIGH", candidates: ["tester", "reviewer"] }),
      { status: "skip", reason: "explicit-user-opt-out" },
    );
  }
}

function testFanoutRiskBoundaries() {
  assertFanoutDecision(
    getFanoutDecision({
      task: "Patch the authentication vulnerability",
      risk: "HIGH",
      candidates: ["security_reviewer", "tester"],
      modes: ["security"],
    }),
    { status: "required", reason: "high-risk-independent-verification" },
  );
  assertFanoutDecision(
    getFanoutDecision({
      task: "How do I fix a typo?",
      risk: "MEDIUM",
      candidates: ["reviewer", "tester"],
    }),
    { status: "skip", reason: "xs-direct-task" },
  );
}

function testRussianExecutionAndResearchIntents() {
  for (const task of [
    "Ну, перегенери уже, сделай классно.",
    "Теперь тебе нужно сделать выделение.",
    "Освободилось, сделай пожалуйста.",
    "Окей, делай дальше экраны с трекингом, а функциональный бэкенд уже делай сейчас.",
    "Переделывай, генери сначала.",
    "А давай попробуем сделать фаску, давай сделаем так.",
    "Ну давай сделаем это и выделим блок.",
    "Нужно просто ещё один предмет вставить.",
    "Можно его побольше растянуть.",
    "Давай-ка ты кодиком сделаешь так.",
    "Можем попробовать сгенерировать вариант.",
    "Так может ты сделаешь мне?",
    "Тебе надо как в играх брови и волосы на лице заменять.",
    "Задеплоишь апдейт?",
    "Давай подключим календарь и убедись, что синхронизация работает.",
    "Что можешь выделять оранжевым в аккаунте? А в мобильной версии сжимай блоки меньше, как на десктопе. И задеплой обновление.",
  ]) {
    assert.strictEqual(isImplementationRequest(task), true, task);
  }
  for (const task of [
    "Выясни, почему Luna редко используется в шести чатах.",
    "Не работает вход, выясни почему.",
    "Как подключить компонент?",
    "Что такое подключение?",
    "Ты переделал хуже, почему?",
    "Можно ли подключить библиотеку?",
    "Не подключай библиотеку, только посмотри конфиг.",
    "Не генерируй ничего, выясни ошибку.",
    "Не нужно переделывать текущий вариант.",
    "Не делай правок.",
    "Не делай правок: только выясни причину сбоя.",
    "Продумай варианты дизайна и посмотри на референсы.",
    "Что такое подключение?",
    "Ты переделал хуже, почему?",
    "Почему нужно подключить библиотеку?",
    "Как можно сделать эту кнопку заметнее?",
    "Что можно сгенерировать для этой страницы?",
    "Не переделывай экран, только объясни, что сломалось.",
    "Проверь формулировку «сделай новую страницу кабинета пользователя с доступными действиями».",
    "Проверь формулировку \"сделай новую страницу кабинета пользователя\".",
    "Проверь пример кода: `сделай новую страницу кабинета пользователя`.",
    "Проверь пример кода:\n```text\nсделай новую страницу кабинета пользователя\n```",
    "Проверь формулировку: сделай новую страницу кабинета пользователя.",
    "Проверь формулировку: сделай новую страницу кабинета и добавь доступные действия.",
    "Проверь формулировку: выбери вариант и сделай новую страницу кабинета пользователя.",
  ]) {
    assert.strictEqual(isImplementationRequest(task), false, task);
  }
  for (const task of [
    "Проверь компонент и исправь ошибку.",
    "Слушай, ну давай, вноси изменения, только чтобы реально улучшилось. Вот. И как бы поднимай версию релиза, если всё нормально будет работать.",
    "Проверь формулировку и добавь краткое предупреждение.",
    "Проверь формулировку «сделай страницу». Затем создай новую страницу кабинета.",
    "Проверь формулировку: сделай страницу кабинета. Затем создай новую страницу.",
    "Отредактируй текст лендинга по книге и верни готовый текст.",
    "Перепиши пост по приложенным фактам.",
    "Проверь формулировку: «создай страницу». Затем отредактируй сам текст.",
  ]) {
    assert.strictEqual(isImplementationRequest(task), true, task);
  }
  for (const task of [
    "тексты плохо пишет, выясни причину",
    "Почему релиз не работает? Выясни причину.",
    "Отредактируй текст в режиме только чтения.",
    "Проверь формулировку «Отредактируй текст лендинга».",
  ]) {
    assert.strictEqual(isImplementationRequest(task), false, task);
  }
  assert.strictEqual(isLikelySmallTask("Напиши краткий статус о проверке."), true);
}

function testWriteScopes() {
  const disjoint = validateWriteAssignments([
    { agent: "worker-a", files: ["src/a.js"] },
    { agent: "worker-b", files: ["src/b.js"] },
  ]);
  assert.strictEqual(disjoint.isValid, true);
}

function testWriteScopeConflicts() {
  const duplicate = validateWriteAssignments([
    { agent: "worker-a", files: ["src/shared.js"] },
    { agent: "worker-b", files: ["src/shared.js"] },
  ]);
  assert.strictEqual(duplicate.isValid, false);
  assert.strictEqual(duplicate.conflicts.length, 1);

  const nested = validateWriteAssignments([
    { agent: "worker-a", files: ["src/feature"] },
    { agent: "worker-b", files: ["src/feature/index.js"] },
  ]);
  assert.strictEqual(nested.isValid, false);

  const missing = validateWriteAssignments([{ agent: "worker-a", files: [] }]);
  assert.deepStrictEqual(missing.missingScopes, ["worker-a"]);
}

function testWriteScopeAliases() {
  const rootScope = validateWriteAssignments([
    { agent: "worker-a", files: ["."] },
    { agent: "worker-b", files: ["src/a.js"] },
  ]);
  assert.strictEqual(rootScope.isValid, false);
  assert.deepStrictEqual(rootScope.invalidScopes, [{ agent: "worker-a", scope: "." }]);

  const caseAlias = validateWriteAssignments([
    { agent: "worker-a", files: ["src/A.js"] },
    { agent: "worker-b", files: ["src/a.js"] },
  ]);
  assert.strictEqual(caseAlias.isValid, false);
}

function testCandidateRanking() {
  const decision = getFanoutDecision({
    task: "Update the OpenAI agent template and review release docs",
    risk: "HIGH",
    modes: ["template", "release", "openai"],
    candidates: [
      "pr_explorer",
      "systems_reviewer",
      "tester",
      "reviewer",
      "docs_researcher",
    ],
  });
  assert.deepStrictEqual(
    decision.candidates.map(({ name }) => name),
    ["docs_researcher", "systems_reviewer", "tester"],
  );
  assert.strictEqual(decision.candidateInventory.length, 5);
}

function createValidatorFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-policy-"));
  fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
  fs.cpSync(path.join(__dirname, "../.codex/agents"), path.join(root, ".codex/agents"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "../.codex/config.toml"), path.join(root, ".codex/config.toml"));
  return root;
}

function runValidator(root) {
  return spawnSync(
    process.execPath,
    [path.join(__dirname, "validate-codex-agents.js")],
    { cwd: root, encoding: "utf8" },
  );
}

function withValidatorFixture(mutate, expectedText) {
  const root = createValidatorFixture();
  try {
    mutate(root);
    const result = runValidator(root);
    assert.notStrictEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, expectedText);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testValidatorRejections() {
  withValidatorFixture((root) => {
    const file = path.join(root, ".codex/agents/scout.toml");
    const content = fs.readFileSync(file, "utf8").replace(
      'model = "gpt-6-luna"',
      'model = "gpt-6.1-sol"',
    );
    fs.writeFileSync(file, content, "utf8");
  }, /scout must use gpt-6-luna/);

  withValidatorFixture((root) => {
    const file = path.join(root, ".codex/agents/pr-explorer.toml");
    const content = fs.readFileSync(file, "utf8").replace(
      'model_reasoning_effort = "high"',
      'model_reasoning_effort = "max"',
    );
    fs.writeFileSync(file, content, "utf8");
  }, /must use high effort/);

  withValidatorFixture((root) => {
    const file = path.join(root, ".codex/config.toml");
    const content = fs.readFileSync(file, "utf8").replace("max_depth = 1", "max_depth = 2");
    fs.writeFileSync(file, content, "utf8");
  }, /expected max_depth = 1/);

  withValidatorFixture((root) => {
    const file = path.join(root, ".codex/config.toml");
    fs.appendFileSync(file, '\nmodel = "gpt-5.6-sol"\n', "utf8");
  }, /contains user\/IDE-owned defaults/);
}

function testValidatorGlobalThreadCapacity() {
  for (const key of ["max_threads", "max_concurrent_threads_per_session"]) {
    for (const value of ["6", "1_000"]) {
      const root = createValidatorFixture();
      try {
        const file = path.join(root, ".codex/config.toml");
        const configured = fs.readFileSync(file, "utf8").replace(
          /^max_concurrent_threads_per_session[ \t]*=[ \t]*3\r?$/m,
          `${key} = ${value}`,
        );
        assert.notStrictEqual(configured, fs.readFileSync(file, "utf8"));
        fs.writeFileSync(file, configured, "utf8");
        const beforeValidation = fs.readFileSync(file);
        const result = runValidator(root);
        assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
        const count = Number(value.replaceAll("_", ""));
        assert.match(result.stdout, new RegExp(`global concurrency capacity \\(${count}\\).*per-task fan-out ceiling \\(3\\)`));
        assert.deepStrictEqual(fs.readFileSync(file), beforeValidation);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  }

  for (const [key, value] of [
    ["max_concurrent_threads_per_session", "0"],
    ["max_threads", "1__0"],
    ["max_threads", "6.5"],
    ["max_threads", "9007199254740992"],
  ]) {
    withValidatorFixture((root) => {
      const file = path.join(root, ".codex/config.toml");
      const content = fs.readFileSync(file, "utf8").replace(
        /^max_concurrent_threads_per_session[ \t]*=[ \t]*3\r?$/m,
        `${key} = ${value}`,
      );
      assert.notStrictEqual(content, fs.readFileSync(file, "utf8"));
      fs.writeFileSync(file, content, "utf8");
    }, /agents concurrency limit must be a positive safe integer/);
  }
}

function testResourceSelection() {
  const bounded = { role: "implementer", scope: ["src/isolated.js"], acceptance: ["unit tests pass"] };
  assert.strictEqual(getResourceRecommendation(bounded).recommendedModel, "gpt-6-luna");
  assert.strictEqual(getResourceRecommendation(bounded).recommendedEffort, "high");
  const fastWorker = {
    needSpeed: true,
    role: "implementer",
    risk: "LOW",
    assignment: { scope: bounded.scope, acceptance: bounded.acceptance, uncertainty: "low", operation: "write" },
    requiredCapabilities: ["write"],
    observedHost: { available: true, authorized: true, transport: "Orca/OpenCode", observedAt: new Date().toISOString(),
      selectedModel: "opencode-go/deepseek-v4.1-flash", toolCapabilities: ["write"] },
  };
  const fastReady = getResourceRecommendation({ ...bounded, hostDispatchCapabilities: ["explicit-model-contract"], fastWorker });
  assert.strictEqual(fastReady.recommendedModel, "gpt-6-luna", "native profile remains separate from optional external execution");
  assert.strictEqual(fastReady.recommendedEffort, "high");
  assert.strictEqual(fastReady.dispatch.callContract.model, "gpt-6-luna");
  assert.strictEqual(fastReady.externalExecution.state, "external-fast-ready");
  assert.strictEqual(fastReady.externalExecution.selectedModel, "opencode-go/deepseek-v4.1-flash");
  assert.strictEqual(fastReady.externalExecution.aliasIsOfficialApiId, false);
  assert.strictEqual(fastReady.externalExecution.effectiveModel, null);
  assert.deepStrictEqual(fastReady.externalExecution.nativeFallbackProfile, { model: "gpt-6-luna", effort: "high" });
  const noSpeed = getResourceRecommendation({ ...bounded, fastWorker: { ...fastWorker, needSpeed: false } });
  assert.strictEqual(noSpeed.externalExecution.state, "native-luna-fallback");
  assert.strictEqual(noSpeed.recommendedModel, "gpt-6-luna");
  const highRisk = getResourceRecommendation({ ...bounded, fastWorker: { ...fastWorker, risk: "HIGH" } });
  assert.strictEqual(highRisk.externalExecution.state, "native-luna-fallback", "high-risk work stays on its native gated route");
  assert.strictEqual(highRisk.recommendedModel, "gpt-6-luna");
  const integration = getResourceRecommendation({ ...bounded, integration: true, fastWorker });
  assert.strictEqual(integration.externalExecution.state, "native-luna-fallback", "integration stays with the parent rather than the fast executor");
  const parentIntegration = getResourceRecommendation({ ...bounded, integration: true });
  assert.strictEqual(parentIntegration.recommendedModel, "gpt-6.1-sol");
  assert.strictEqual(parentIntegration.dispatch.customRole, null);
  assert.strictEqual(parentIntegration.dispatch.owner, "orchestrator");
  assert.strictEqual(getResourceRecommendation({ role: "implementer" }).dispatch.ready, false);
  const unreadyContract = getResourceRecommendation(bounded);
  assert.strictEqual(unreadyContract.dispatch.ready, false);
  assert.strictEqual(unreadyContract.dispatch.callContract, null);
  const consultant = getResourceRecommendation({ ...bounded, role: "architecture_consultant", strategy: true, deepRisk: true });
  assert.strictEqual(consultant.recommendedModel, "gpt-6.1-sol");
  assert.strictEqual(consultant.recommendedEffort, "high");
  assert.strictEqual(consultant.dispatch.customRole, null);
  assert.strictEqual(consultant.effectiveModel, null);
  assert.strictEqual(consultant.runtimeStatus, "recommendation-only");
  assert.strictEqual(validateResourceRequest({ model: "gpt-6.1-terra", effort: "max" }).isValid, false);
  const elevated = { model: "gpt-6.1-terra", effort: "max", reason: "hard bounded module", budget: { maxTokens: 5000, maxAttempts: 2 } };
  assert.strictEqual(validateResourceRequest(elevated).isValid, true);
  assert.strictEqual(validateResourceRequest(elevated).hostStatus, "unverified");
  assert.strictEqual(validateResourceRequest({ ...elevated, hostCapabilities: { "gpt-6.1-terra": ["medium"] } }).isValid, false);
  assert.strictEqual(validateResourceRequest({ model: "gpt-6.1-sol", effort: "none" }).isValid, false);
  assert.strictEqual(validateResourceRequest({ model: "gpt-6.1-terra", effort: "none" }).isValid, true);
  const lunaMax = getResourceRecommendation({ ...bounded, requestedEffort: "max",
    reason: "hard bounded task", budget: { maxTokens: 5000, maxAttempts: 2 },
    hostCapabilities: { "gpt-6-luna": ["high", "max"] } });
  assert.strictEqual(lunaMax.recommendedEffort, "max");
  assert.strictEqual(lunaMax.dispatch.customRole, null);
  assert.strictEqual(lunaMax.dispatch.strategy, "explicit-model-contract");
  assert.strictEqual(lunaMax.dispatch.ready, false);
  const explicit = getResourceRecommendation({ ...bounded, hostDispatchCapabilities: ["explicit-model-contract"] });
  assert.strictEqual(explicit.dispatch.ready, true);
  assert.strictEqual(explicit.dispatch.callContract.model, "gpt-6-luna");
  assert.strictEqual(explicit.dispatch.callContract.fork_turns, "none");
  const native = getResourceRecommendation({ ...bounded, hostDispatchCapabilities: ["native-custom-role"] });
  assert.strictEqual(native.dispatch.customRole, "implementer");
  assert.strictEqual(native.dispatch.ready, true);
  assert.strictEqual(native.dispatch.callContract.agent_type, "implementer");
  assert.strictEqual(native.dispatch.callContract.model, undefined);
  assert.strictEqual(getResourceRecommendation({ ...bounded, requestedEffort: "max" }).dispatch.ready, false);
  for (const invalid of [null, "contract", [], { scope: "src/file.js" }, { acceptance: "done" }, { hostCapabilities: { "gpt-6-luna": "max" } }, { scope: ["../outside"] }]) {
    assert.throws(() => getResourceRecommendation(invalid), /contract|hostCapabilities/);
  }
  for (const scope of ["../secret", "src/../../secret", "C:/outside.js", "src/*.js", "/outside"]) {
    assert.strictEqual(validateWriteAssignments([{ agent: "worker", files: [scope] }]).isValid, false, scope);
  }
}

function main() {
  for (const availableSlots of ["0", null, NaN, Infinity, -1, 0.5, {}, Number.MAX_SAFE_INTEGER + 1]) {
    assertFanoutDecision(getFanoutDecision({ task: "Review security across modules",
      candidates: ["tester", "scout"], availableSlots }),
    { status: "skip", reason: "invalid-host-child-slots" });
  }
  assert.deepStrictEqual(getProfileSnapshot(), EXPECTED_PROFILES);
  assert.strictEqual(AGENT_POLICY.parent.modelSource, "user-or-ide");
  assert.strictEqual(AGENT_POLICY.parent.effortCeiling, "max");
  testResourceSelection();
  testFanoutDecisions();
  testXsAndReadOnlyBoundaries();
  testFanoutOptOuts();
  testFanoutRiskBoundaries();
  testRussianExecutionAndResearchIntents();
  testWriteScopes();
  testWriteScopeConflicts();
  testWriteScopeAliases();
  testCandidateRanking();
  testValidatorRejections();
  testValidatorGlobalThreadCapacity();
  console.log("Codex agent policy tests passed");
}

main();
