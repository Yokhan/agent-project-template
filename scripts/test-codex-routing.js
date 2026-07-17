#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getRoute } = require("./codex-route-task.js");
const { AGENT_POLICY, getAgentProfiles } = require("./codex-agent-policy.js");
const { runRouteCasesA } = require("./codex-routing-cases-a.js");
const { runRouteCasesB } = require("./codex-routing-cases-b.js");

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
  assert.strictEqual(AGENT_POLICY.parent.modelSource, "user-or-ide");
  assert.strictEqual(AGENT_POLICY.parent.effortCeiling, "xhigh");
  assert.deepStrictEqual(
    new Set(getAgentProfiles().map(({ model }) => model)),
    new Set(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]),
  );

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
    },
  );

  console.log("Codex routing smoke passed");
}

main();
