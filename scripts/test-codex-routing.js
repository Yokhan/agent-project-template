#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { formatSummary, getRoute: getProductionRoute } = require("./codex-route-task.js");
const { runRouteCli } = require("./lib/codex-route-cli.js");
const { evaluateDiscoveryReroute, getDecisionBinding } =
  require("./lib/codex-discovery-reroute.js");
const { AGENT_POLICY, getAgentProfiles } = require("./codex-agent-policy.js");
const { runRouteCasesA } = require("./codex-routing-cases-a.js");
const { runRouteCasesB } = require("./codex-routing-cases-b.js");
const { makeArchitectureDecision, makeDecision } = require("./test-change-strategy.js");

const BASE_ROUTE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "codex-route-base-"));

function getRoute(task, options = {}) {
  return getProductionRoute(task, { cwd: BASE_ROUTE_ROOT, ...options });
}

function assertIncludes(values, expected, message) {
  assert(
    values.includes(expected),
    `${message}: expected ${expected}, got ${values.join(", ")}`,
  );
}

function testRoute(task, expectations) {
  const route = getRoute(task, expectations.options || {});
  if (expectations.exactModes) {
    assert.deepStrictEqual(
      new Set(route.modes),
      new Set(expectations.exactModes),
      `${task} exact modes`,
    );
  }
  if (expectations.exactSubagents) {
    assert.deepStrictEqual(
      route.subagents,
      expectations.exactSubagents,
      `${task} exact subagents`,
    );
  }
  for (const mode of expectations.modes || []) {
    assertIncludes(route.modes, mode, `${task} modes`);
  }
  for (const mode of expectations.notModes || []) {
    assert(
      !route.modes.includes(mode),
      `${task} modes: expected no ${mode}, got ${route.modes.join(", ")}`,
    );
  }
  for (const skill of expectations.skills || []) {
    assertIncludes(route.skills, skill, `${task} skills`);
  }
  for (const skill of expectations.notSkills || []) {
    assert(
      !route.skills.includes(skill),
      `${task} skills: expected no ${skill}, got ${route.skills.join(", ")}`,
    );
  }
  for (const rule of expectations.sharedRules || []) {
    assertIncludes(route.sharedRules, rule, `${task} shared rules`);
  }
  for (const subagent of expectations.subagents || []) {
    assertIncludes(route.subagents, subagent, `${task} subagents`);
  }
  for (const subagent of expectations.notSubagents || []) {
    assert(
      !route.subagents.includes(subagent),
      `${task} subagents: expected no ${subagent}, got ${route.subagents.join(", ")}`,
    );
  }
  for (const gate of expectations.qualityGates || []) {
    assertIncludes(route.qualityGates || [], gate, `${task} quality gates`);
  }
  if (expectations.risk) {
    assert.strictEqual(route.risk, expectations.risk, `${task} risk`);
  }
  if (expectations.pipeline) {
    assert.strictEqual(route.pipeline, expectations.pipeline, `${task} pipeline`);
  }
  if (expectations.workflowDepth) {
    assert.strictEqual(route.workflowDepth, expectations.workflowDepth, `${task} workflow depth`);
  }
  if (expectations.orchestrator) {
    assert.strictEqual(
      route.orchestrator.owner,
      expectations.orchestrator,
      `${task} orchestrator`,
    );
  }
  if (typeof expectations.needsFreshDocs === "boolean") {
    assert.strictEqual(
      route.needsFreshDocs,
      expectations.needsFreshDocs,
      `${task} fresh docs`,
    );
  }
  if (typeof expectations.planRequired === "boolean") {
    assert.strictEqual(
      route.planContract.required,
      expectations.planRequired,
      `${task} plan required`,
    );
  }
  if (expectations.fanoutStatus) {
    assert.strictEqual(
      route.fanout.status,
      expectations.fanoutStatus,
      `${task} fanout status`,
    );
  }
  if (typeof expectations.changeStrategyRequired === "boolean") {
    assert.strictEqual(
      route.changeStrategy.required,
      expectations.changeStrategyRequired,
      `${task} change strategy activation`,
    );
  }
  if (expectations.changeStrategyRecordMode) {
    assert.strictEqual(
      route.changeStrategy.recordMode,
      expectations.changeStrategyRecordMode,
      `${task} change strategy record mode`,
    );
  }
  if (typeof expectations.blockEdits === "boolean") {
    assert.strictEqual(route.blockEdits, expectations.blockEdits, `${task} block edits`);
  }
  if (expectations.discoveryKind) {
    assert.strictEqual(route.discovery.kind, expectations.discoveryKind, `${task} discovery kind`);
  }
  for (const mode of expectations.semanticMatches || []) {
    assertIncludes(route.semanticMatches || [], mode, `${task} semantic matches`);
  }
  for (const mode of expectations.exactMatches || []) {
    assertIncludes(route.exactMatches || [], mode, `${task} exact matches`);
  }
}

function withTempProject(setup, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-route-"));
  try {
    setup(root);
    callback(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

function main() {
  const direct = getRoute("Fix typo in README");
  assert.strictEqual(direct.workflowDepth, "direct");
  assert.deepStrictEqual(direct.skills, []);
  assert.deepStrictEqual(direct.sharedRules, []);
  assert.strictEqual(direct.fanout.status, "skip");
  assert.strictEqual(direct.resourceDecision.recommendedModel, "gpt-6.1-sol");
  const readyWorker = { role: "implementer", scope: ["src/a.js"], acceptance: ["tests pass"],
    hostDispatchCapabilities: ["explicit-model-contract"] };
  for (const [task, options, reason] of [
    ["Implement approved isolated module without subagents", { availableSlots: 0 }, "explicit-user-opt-out"],
    ["Implement approved isolated module", { availableSlots: 0 }, "host-has-no-child-slots"],
    ["Fix typo in README", {}, "xs-direct-task"],
    ["Review security and tests across modules without swarm", {}, "explicit-user-opt-out"],
    ["Проверь несколько модулей без swarm", {}, "explicit-user-opt-out"],
    ["Review security and tests across modules. Do not spawn child agents", {}, "explicit-user-opt-out"],
    ["Review security and tests across modules", { availableSlots: "0" }, "invalid-host-child-slots"],
  ]) {
    const blocked = getRoute(task, { ...options, workerContract: readyWorker });
    assert.strictEqual(blocked.fanout.status, "skip", task);
    assert.strictEqual(blocked.fanout.reason, reason, task);
    assert.strictEqual(blocked.resourceDecision.dispatch.ready, false, task);
    assert.strictEqual(blocked.resourceDecision.dispatch.callContract, null, task);
    assert(blocked.workerContracts.every((worker) => !worker.dispatch.ready));
  }
  for (const task of ["Проведи независимый аудит безопасности и тестов в нескольких модулях",
    "Проверь несколько модулей через swarm", "Review security and tests across modules",
    "Review correctness in subagent trace child identity completion isolation and task router opt-out slot XS dispatch gates. Two independent bounded read-only review lanes."]) {
    const parallel = getRoute(task);
    assert.strictEqual(parallel.fanout.status, "recommended", task);
    assert(parallel.skills.includes("codex-subagent-orchestration"), task);
    assert(parallel.subagents.length <= 3);
  }
  const sensitive = getRoute("Fix typo in auth permissions");
  assert.strictEqual(sensitive.workflowDepth, "routed");
  assert.strictEqual(sensitive.risk, "HIGH");
  for (const task of ["What is this error and fix it", "Why is the app crashing for all users?", "Fix typo and rebuild the entire app", "Fix typo in commit hook"]) {
    const routed = getRoute(task);
    assert.strictEqual(routed.workflowDepth, "routed", task);
    assert(routed.sharedRules.length > 0, task);
  }
  for (const task of ["Разреши неоднозначную архитектуру", "Разбери конфликтующие требования", "Разбери системный тупик"]) {
    assert.strictEqual(getRoute(task).resourceDecision.recommendedModel, "gpt-6-astra", task);
  }
  const assigned = getRoute("Comprehensive template audit across modules", {
    workerContract: { evidenceRefs: ["parent-report"], assignments: {
      scout: { scope: ["src/module.js"], acceptance: ["report findings"], evidenceRefs: ["ADR42"] },
    } },
  });
  assert.deepStrictEqual(assigned.workerContracts.find((worker) => worker.role === "scout").evidenceRefs, ["parent-report", "ADR42"]);
  const bounded = getRoute("Implement isolated module according to approved contract", {
    workerContract: { role: "implementer", scope: ["src/module.js"], acceptance: ["unit contract passes"] },
  });
  assert.strictEqual(bounded.resourceDecision.recommendedModel, "gpt-6-luna");
  assert.strictEqual(bounded.resourceDecision.dispatch.customRole, null);
  assert.strictEqual(bounded.resourceDecision.dispatch.strategy, "explicit-model-contract");
  assert.strictEqual(bounded.resourceDecision.dispatch.ready, false);
  assert.strictEqual(bounded.resourceDecision.runtimeStatus, "recommendation-only");
  // A single implementation worker is useful even without a parallel lane.
  const sequential = getRoute("Implement the approved isolated module", {
    availableSlots: 1, workerContract: readyWorker,
  });
  assert.deepStrictEqual(sequential.subagents, ["implementer"]);
  assert.strictEqual(sequential.fanout.reason, "bounded-implementation-delegation");
  assert.strictEqual(sequential.resourceDecision.dispatch.ready, true);
  assert.strictEqual(sequential.workerContracts[0].dispatch.ready, true);
  assert.strictEqual(sequential.workerContracts[0].dispatch.callContract.model, "gpt-6-luna");
  assert.strictEqual(sequential.workerContracts[0].dispatch.callContract.fork_turns, "none");
  for (const task of ["Implement approved homepage component design", "Implement the approved feature"]) {
    const planned = getRoute(task, { workerContract: readyWorker });
    assert(planned.subagents.includes("implementer"), task);
    assert.strictEqual(planned.resourceDecision.recommendedModel, "gpt-6-luna", task);
    assert.strictEqual(planned.resourceDecision.dispatch.ready, true, task);
    const unbounded = getRoute(task);
    assert(unbounded.subagents.includes("implementer"), task);
    assert.strictEqual(unbounded.resourceDecision.dispatch.ready, false, task);
  }
  for (const task of ["Read-only review of the implementation", "Inspect the homepage; do not modify files",
    "Audit the proposed fix for homepage implementation",
    "Проверь предложенное исправление компонента главной страницы",
    "How do I implement this component?", "Explain how to fix the homepage component",
    "Review implementation plan for update", "Explain the build and deploy pipeline",
    "Explain how to inspect and implement the approved component",
    "Review the build and deploy pipeline",
    "Audit the build and fix process",
    "Inspect update and release workflow"]) {
    const readOnly = getRoute(task, { workerContract: readyWorker });
    assert(!readOnly.subagents.includes("implementer"), task);
    assert.strictEqual(readOnly.resourceDecision.dispatch.ready, false, task);
    assert.strictEqual(readOnly.resourceDecision.dispatch.callContract, null, task);
  }
  for (const task of ["Review the component and implement the approved fix", "Проверь компонент и исправь ошибку",
    "Add the approved search component", "Добавь согласованный компонент поиска",
    "Refactor the approved isolated module", "Отрефакторь согласованный модуль"]) {
    assert.strictEqual(getRoute(task, { workerContract: readyWorker }).resourceDecision.dispatch.ready, true, task);
  }
  const constrainedRisk = getRoute("Implement approved security-sensitive authentication module", {
    availableSlots: 1, workerContract: readyWorker,
  });
  assert.strictEqual(constrainedRisk.fanout.status, "required");
  assert.deepStrictEqual(constrainedRisk.subagents, ["security_reviewer"]);
  assert.strictEqual(constrainedRisk.resourceDecision.dispatch.ready, false);
  const unresolved = getRoute("Implement a module with unresolved architecture", {
    availableSlots: 1, workerContract: readyWorker,
  });
  assert(!unresolved.subagents.includes("implementer"));
  assert.strictEqual(unresolved.resourceDecision.dispatch.ready, false);
  const maxContract = getRoute("Implement the approved isolated module", {
    workerContract: { role: "implementer", scope: ["src/module.js"], acceptance: ["unit tests"],
      requestedEffort: "max", reason: "hard bounded module", budget: { maxTokens: 5000, maxAttempts: 2 },
      hostCapabilities: { "gpt-6-luna": ["high", "max"] }, hostDispatchCapabilities: ["explicit-model-contract"] },
  });
  assert.strictEqual(maxContract.resourceDecision.recommendedEffort, "max");
  assert.strictEqual(maxContract.resourceDecision.dispatch.customRole, null);
  assert.strictEqual(maxContract.resourceDecision.dispatch.ready, true);
  const ambiguous = getRoute("Resolve ambiguous architecture with conflicting requirements");
  assert.strictEqual(ambiguous.resourceDecision.recommendedModel, "gpt-6-astra");
  assert.strictEqual(ambiguous.resourceDecision.recommendedEffort, "medium");
  assert(ambiguous.subagents.includes("architecture_consultant"));
  assert.strictEqual(AGENT_POLICY.parent.modelSource, "user-or-ide");
  assert.strictEqual(AGENT_POLICY.parent.baselineEffort, "high");
  assert.deepStrictEqual(
    new Set(getAgentProfiles().map(({ model }) => model)),
    new Set(["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"]),
  );
  const symbolRoute = getRoute("rename the authentication symbol");
  assert.deepStrictEqual(symbolRoute.codeIntelligence.tools, ["codebase-memory", "serena", "ripgrep"]);
  assert(formatSummary(symbolRoute).includes("CODE_INTELLIGENCE: symbol-refactor | codebase-memory -> serena -> ripgrep"));
  const securityRoute = getRoute("security release audit for leaked secrets");
  assert.deepStrictEqual(securityRoute.codeIntelligence.tools, ["codebase-memory", "semgrep", "gitleaks", "ripgrep"]);

  const productPlan = getRoute("Спланируй развитие сайта кофейни от объявления до заказов.");
  assert(productPlan.modes.includes("progressive-planning"));
  assert.match(productPlan.planContract.goalArtifact, /accepted product plan/);
  assert.strictEqual(productPlan.writingIntent.isWriting, true);
  assert(productPlan.writingPolicy);
  assert(productPlan.skills.includes("codex-writing-workflow"));
  assert(productPlan.qualityGates.includes("fresh-primary-source-packet-required"));
  assert(productPlan.qualityGates.includes("source-principle-application-required"));
  const templateMaintenance = getRoute("Update the agent template routing instructions");
  assert.match(templateMaintenance.planContract.goalArtifact, /do not create one mechanically/);

  const russianWriting = getRoute("Напиши на русском руководство по интеграции API");
  assert.deepStrictEqual(russianWriting.writingPolicy.languageProfiles, ["russian-infostyle-core", "ilyakhov-russian-voice-decisions"]);
  assert(russianWriting.writingPolicy.domainProfiles.includes("russian-explanation-and-persuasion"));
  assert(russianWriting.writingPolicy.domainProfiles.includes("reader-task-architecture"));
  assert(russianWriting.writingPolicy.technicalProfiles.includes("technical-developer-conventions"));
  assert.deepStrictEqual(russianWriting.writingPolicy.externalTools, [{ id: "glavred-api", access: "not-configured", execution: "not-run", paid: true }]);
  assert(russianWriting.writingPolicy.gates.includes("external-tool-unavailable"));

  const russianLetter = getRoute("Напиши на русском деловое письмо клиенту");
  assert(russianLetter.writingPolicy.languageProfiles.includes("russian-business-correspondence-language"));
  assert(russianLetter.writingPolicy.processProfiles.includes("russian-business-correspondence-process"));
  assert(russianLetter.writingPolicy.domainProfiles.includes("russian-business-correspondence"));

  for (const task of ["Проверь в Главреде", "Дай оценку Главреда", "Отредактируй по Главреду", "Проверь этот текст в Главреде"]) {
    const glavredRoute = getRoute(task);
    assert(glavredRoute.modes.includes("writing-informational"), `${task}: ${glavredRoute.modes.join(", ")}`);
    assert(!glavredRoute.modes.includes("writing-literary"), `${task}: unexpected literary route`);
    assert.deepStrictEqual(glavredRoute.writingPolicy.externalTools, [{ id: "glavred-api", access: "not-configured", execution: "not-run", paid: true }]);
  }

  const mixedWriting = getRoute("Напиши руководство на русском и английском по API");
  assert.strictEqual(mixedWriting.writingPolicy.targetLanguage, "mixed");
  assert.deepStrictEqual(mixedWriting.writingPolicy.languageProfiles, []);
  assert(mixedWriting.writingPolicy.gates.includes("per-section-language-resolution"));

  testRoute("план итераций по прогрессивному джипегу, где каждый срез решает цель продукта", {
    modes: ["progressive-planning"],
    notModes: ["design-system"],
    skills: ["codex-progressive-jpeg-planner", "codex-product-goal", "codex-decompose"],
    qualityGates: ["product-purpose", "end-to-end-user-victory", "anti-falsification"],
    planRequired: true,
  });

  testRoute("Check subagent token usage and report whether the configured models work", {
    notModes: ["design-system"],
    notSubagents: ["product_reviewer"],
    fanoutStatus: "conditional",
  });

  runRouteCasesA(testRoute);
  runRouteCasesB(testRoute);

  const discoveryFixture = path.join(
    __dirname,
    "..",
    "tests",
    "fixtures",
    "change-strategy",
    "discovery-architecture-mismatch.json",
  );
  const discoveryOutput = runRouteCli(
    ["fix the display bug", "--discovery-file", discoveryFixture],
    { formatSummary, getRoute },
  );
  const discoveryRoute = JSON.parse(discoveryOutput);
  assert.strictEqual(discoveryRoute.blockEdits, true);
  const blockedWorker = getRoute("fix the display bug", {
    discovery: JSON.parse(fs.readFileSync(discoveryFixture, "utf8")), workerContract: readyWorker,
  });
  assert.strictEqual(blockedWorker.resourceDecision.dispatch.ready, false);
  assert.strictEqual(blockedWorker.resourceDecision.dispatch.policyReason, "change-strategy-blocks-writes");
  assert(!blockedWorker.subagents.includes("implementer"));
  assert(discoveryRoute.modes.includes("bugfix"));
  assert(discoveryRoute.skills.includes("codex-change-strategy"));

  const resolvedRoute = getRoute("fix the display bug", {
    discovery: JSON.parse(fs.readFileSync(discoveryFixture, "utf8")),
    changeStrategyDecision: makeArchitectureDecision(),
  });
  assert.strictEqual(resolvedRoute.blockEdits, false);
  assert.strictEqual(
    resolvedRoute.changeStrategy.lifecycle,
    "resolved-resume-base-pipeline",
  );
  assert(resolvedRoute.modes.includes("bugfix"));
  assert.strictEqual(resolvedRoute.pipeline, discoveryRoute.pipeline);
  assert.strictEqual(
    new Set(resolvedRoute.skills).size,
    resolvedRoute.skills.length,
  );
  const decisionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "route-decision-"));
  try {
    const decisionFile = path.join(decisionRoot, "decision.json");
    fs.writeFileSync(decisionFile, JSON.stringify(makeArchitectureDecision()));
    const resolvedOutput = runRouteCli(
      [
        "fix the display bug",
        "--discovery-file", discoveryFixture,
        "--decision-file", decisionFile,
      ],
      { formatSummary, getRoute },
    );
    assert.strictEqual(JSON.parse(resolvedOutput).blockEdits, false);
  } finally {
    fs.rmSync(decisionRoot, { recursive: true, force: true });
  }
  const unrelatedDecision = getRoute("fix the display bug", {
    discovery: JSON.parse(fs.readFileSync(discoveryFixture, "utf8")),
    changeStrategyDecision: makeDecision(),
  });
  assert.strictEqual(unrelatedDecision.blockEdits, true);
  assert.strictEqual(unrelatedDecision.decisionBinding.isBound, false);

  const bindingCases = [
    ["repeated-failure", "repeated-failure", { acceptance_id: "fixture-acceptance" }],
    ["architecture-mismatch", "architecture-mismatch"],
    ["ownership-conflict", "ownership-conflict"],
    ["sot-conflict", "sot-conflict"],
    ["duplicate-state", "duplicate-state"],
    ["duplicate-implementation", "duplicate-implementation"],
    ["obsolete-final-path", "obsolete-final-path"],
    ["compatibility-only-layer", "compatibility-shim"],
    ["protected-boundary-unknown", "manual-review"],
    ["stale-path-test", "stale-path-test"],
    ["sunk-cost", "sunk-cost"],
    ["planned-breaking-change", "planned-breaking-change"],
    ["manual-review", "manual-review"],
  ];
  for (const [discoveryKind, triggerKind, extra = {}] of bindingCases) {
    const discovery = evaluateDiscoveryReroute({
      phase: "reading",
      kind: discoveryKind,
      architecture_fit: discoveryKind === "protected-boundary-unknown"
        ? "unknown" : "mismatch",
      summary: `Reading found a qualifying ${discoveryKind} condition.`,
      evidence_ref: `fixture:${discoveryKind}`,
      owner: "Affected subsystem owner",
      sot: "Accepted architecture contract",
      protected_boundaries: ["public result contract"],
      ...extra,
    });
    const binding = getDecisionBinding(discovery, {
      trigger: {
        kind: triggerKind,
        evidence_ref: `fixture:${discoveryKind}`,
        ...extra,
      },
    }, true);
    assert.strictEqual(binding.isBound, true, discoveryKind);
  }

  const repeatedDiscovery = evaluateDiscoveryReroute({
    phase: "implementation",
    kind: "repeated-failure",
    architecture_fit: "mismatch",
    summary: "Two interventions failed against the same acceptance criterion.",
    evidence_ref: "fixture:repeated-failure",
    acceptance_id: "fixture-acceptance",
    owner: "Affected subsystem owner",
    sot: "Accepted architecture contract",
    protected_boundaries: ["public result contract"],
  });
  const wrongEvidenceDecision = makeDecision();
  wrongEvidenceDecision.trigger.acceptance_id = "fixture-acceptance";
  const wrongEvidenceBinding = getDecisionBinding(
    repeatedDiscovery, wrongEvidenceDecision, true);
  assert.strictEqual(wrongEvidenceBinding.isBound, false);
  assert(wrongEvidenceBinding.issues.some((issue) => issue.includes("evidence_ref")));

  const pendingDecision = makeArchitectureDecision();
  pendingDecision.approval = { status: "pending" };
  const pendingRoute = getRoute("fix the display bug", {
    discovery: JSON.parse(fs.readFileSync(discoveryFixture, "utf8")),
    changeStrategyDecision: pendingDecision,
  });
  assert.strictEqual(pendingRoute.blockEdits, true);

  const malformedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "route-malformed-"));
  try {
    const malformedFile = path.join(malformedRoot, "malformed.json");
    fs.writeFileSync(malformedFile, "{not-json\n");
    assert.throws(() => runRouteCli(
      ["fix the display bug", "--discovery-file", malformedFile, "--write-state"],
      { formatSummary, getRoute },
    ));
    assert.throws(() => runRouteCli(
      ["fix the display bug", "--decision-file", path.join(malformedRoot, "missing.json")],
      { formatSummary, getRoute },
    ));
    assert.throws(
      () => runRouteCli(["fix the display bug", "--discovery-file"], { formatSummary, getRoute }),
      /requires a file path/,
    );
    assert.throws(
      () => runRouteCli(["fix the display bug", "--decision-file"], { formatSummary, getRoute }),
      /requires a file path/,
    );
    assert.throws(
      () => runRouteCli(["fix the display bug", "--unknown"], { formatSummary, getRoute }),
      /Unknown option/,
    );
  } finally {
    fs.rmSync(malformedRoot, { recursive: true, force: true });
  }

  const incompleteDiscovery = getRoute("fix the display bug", {
    discovery: { kind: "architecture-mismatch" },
  });
  assert.strictEqual(incompleteDiscovery.blockEdits, true);
  assert(incompleteDiscovery.discovery.issues.length >= 5);

  const architecturePhrase = getRoute(
    "Architecture mismatch discovered while reading before the first patch.",
    { changeStrategyDecision: makeArchitectureDecision() },
  );
  assert.strictEqual(architecturePhrase.changeStrategy.required, true);
  assert.strictEqual(architecturePhrase.blockEdits, true);
  assert.strictEqual(architecturePhrase.decisionBinding.isBound, false);
  const fallbackPhrase = getRoute(
    "The second failed repair hit the same acceptance criterion.",
    { changeStrategyDecision: makeDecision() },
  );
  assert.strictEqual(fallbackPhrase.changeStrategy.required, true);
  assert.strictEqual(fallbackPhrase.blockEdits, true);
  assert.strictEqual(fallbackPhrase.decisionBinding.isBound, false);

  withTempProject(
    (root) => fs.writeFileSync(path.join(root, "DESIGN.md"), "# Product design\n"),
    (root) => {
      const route = getRoute("fix the display bug", { cwd: root });
      assert(!route.artifacts.some(({ name }) => name === "kiro"));
    },
  );

  withTempProject(
    (root) => {
      fs.mkdirSync(path.join(root, ".agent-os"), { recursive: true });
      fs.mkdirSync(path.join(root, "tasks"), { recursive: true });
      fs.writeFileSync(path.join(root, "tasks", "current.md"), "fixture\n");
    },
    (root) => {
      testRoute("implement feature from AgentOS plan", {
        modes: ["feature"],
        skills: ["codex-feature-workflow"],
        orchestrator: "agentos",
        options: { cwd: root },
      });
      const assigned = getRoute("implement feature from AgentOS plan", { cwd: root });
      assert.strictEqual(assigned.planContract.writeTo, null);
      assert.strictEqual(assigned.planContract.owner, "agentos");
    },
  );

  console.log("Codex routing smoke passed");
}

try {
  main();
} finally {
  fs.rmSync(BASE_ROUTE_ROOT, { recursive: true, force: true });
}
