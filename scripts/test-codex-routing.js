#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getRoute } = require("./codex-route-task.js");

function assertIncludes(values, expected, message) {
  assert(
    values.includes(expected),
    `${message}: expected ${expected}, got ${values.join(", ")}`,
  );
}

function testRoute(task, expectations) {
  const route = getRoute(task, expectations.options || {});
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
  for (const subagent of expectations.subagents || []) {
    assertIncludes(route.subagents, subagent, `${task} subagents`);
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
  testRoute("почини падающий тест логина", {
    modes: ["bugfix", "testing"],
    skills: ["codex-debug", "codex-coverage"],
    subagents: ["tester", "reviewer"],
    risk: "MEDIUM",
  });

  testRoute("после обновления форма зависает и раньше это работало", {
    modes: ["bugfix"],
    skills: ["codex-debug"],
    semanticMatches: ["bugfix"],
    risk: "MEDIUM",
  });

  testRoute("кто-то может получить чужие данные из сессии", {
    modes: ["security", "product-ux"],
    skills: ["codex-security-audit", "codex-strategic-review"],
    semanticMatches: ["security"],
    risk: "HIGH",
  });

  testRoute("сделай дизайн экрана и figma mockup", {
    modes: ["design", "figma"],
    skills: ["codex-design-workflow", "codex-figma-workflow"],
    subagents: ["design_reviewer", "tester"],
    risk: "MEDIUM",
  });

  testRoute("polish harden typeset product surface", {
    modes: ["design"],
    skills: ["codex-design-workflow", "codex-domain-design-review"],
    qualityGates: ["token-contract", "state-coverage", "responsive-check"],
    risk: "MEDIUM",
  });

  testRoute("страница выглядит кустарно и пользователи не доверяют", {
    modes: ["design"],
    skills: ["codex-design-workflow"],
    semanticMatches: ["design"],
    risk: "MEDIUM",
  });

  testRoute("люди начинают путь, бросают его и не могут вернуться к ценности", {
    modes: ["product-ux"],
    skills: ["codex-product-ux-audit"],
    qualityGates: ["entry-to-value-flow", "return-path"],
    semanticMatches: ["product-ux"],
    planRequired: true,
  });

  testRoute("critique distill harden brand/product register UI pipeline for conversion KPI", {
    modes: ["design", "product-goal"],
    skills: [
      "codex-design-workflow",
      "codex-domain-design-review",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: [
      "token-contract",
      "state-coverage",
      "responsive-check",
      "user-business-outcome-link",
    ],
    planRequired: true,
    risk: "MEDIUM",
  });

  testRoute("доработай дизайн-систему: токены, Storybook, атомы, молекулы и формы", {
    modes: ["design-system"],
    skills: ["codex-design-system-workflow", "codex-design-workflow"],
    qualityGates: ["token-contract", "composition-trace", "rendered-geometry"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("проверь UX личного кабинета: вход, сервисы, dead ends и возврат на главную", {
    modes: ["product-ux"],
    skills: ["codex-product-ux-audit"],
    qualityGates: ["entry-to-value-flow", "no-dead-ends", "return-path"],
    planRequired: true,
  });

  testRoute("проверь безопасность auth secrets injection", {
    modes: ["security", "review"],
    skills: ["codex-security-audit", "codex-audit", "codex-strategic-review"],
    subagents: ["security_reviewer", "tester"],
    risk: "HIGH",
  });

  testRoute("обнови агентский шаблон, AGENTS.md, skills и router", {
    modes: ["template"],
    skills: [
      "codex-template-sync",
      "codex-skill-maintenance",
      "codex-test-rules",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    subagents: ["pr_explorer", "tester"],
    qualityGates: ["template-boundary", "product-goal-artifact"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("усилить AGENTS основной файл: единый SOT conflict protocol, больше примеров формулировки задач из references, системный анализ ошибок вместо локальных фиксов", {
    modes: ["template"],
    skills: [
      "codex-template-sync",
      "codex-agent-router",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "sot-validation", "product-goal-artifact"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("проверь куда делся образ мысли ТРИЗ в основном агентском файле", {
    modes: ["template", "strategy"],
    skills: [
      "codex-template-sync",
      "codex-agent-router",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("проверь стратагемы и Сунь-цзы для конкурентной стратегии", {
    modes: ["review", "strategy"],
    notModes: ["release"],
    skills: ["codex-audit", "codex-strategic-review"],
    planRequired: true,
    risk: "MEDIUM",
  });

  testRoute("стратегический обзор продукта и рынка", {
    modes: ["strategy"],
    notModes: ["release"],
    skills: ["codex-strategic-review"],
    planRequired: true,
    risk: "MEDIUM",
  });

  testRoute("маркетологи должны проверить позиционирование, оффер, воронку и кампанию", {
    modes: ["marketing", "review"],
    skills: [
      "codex-domain-communication-review",
      "codex-domain-business-review",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: [
      "audience-icp",
      "positioning-offer-clarity",
      "journey-or-funnel-fit",
      "measurement-and-ethics",
      "product-goal-artifact",
    ],
    planRequired: true,
    risk: "MEDIUM",
  });

  testRoute("marketing positioning campaign funnel offer ICP", {
    modes: ["marketing"],
    skills: ["codex-domain-communication-review", "codex-domain-business-review"],
    qualityGates: ["audience-icp", "channel-distribution-plan"],
    planRequired: true,
    risk: "MEDIUM",
  });

  testRoute("пользователи не покупают повторно, деньги теряются, нужно понять где ломается путь", {
    modes: ["marketing", "product-goal"],
    skills: ["codex-domain-communication-review", "codex-domain-business-review"],
    qualityGates: ["audience-icp", "journey-or-funnel-fit", "user-business-outcome-link"],
    semanticMatches: ["marketing"],
    planRequired: true,
  });

  testRoute("протокол между клиентом и сервисом разошелся, поля не совместимы", {
    modes: ["api"],
    skills: ["codex-api-contract"],
    semanticMatches: ["api"],
    risk: "MEDIUM",
  });

  testRoute("переносим данные в новое хранилище без простоя и с откатом", {
    modes: ["migration"],
    skills: ["codex-migrate", "codex-strategic-review"],
    semanticMatches: ["migration"],
    risk: "HIGH",
  });

  testRoute("agent template client-executor contract anti-sycophancy no fake completion", {
    modes: ["template"],
    skills: [
      "codex-template-sync",
      "codex-skill-maintenance",
      "codex-test-rules",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "verification-evidence"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("пропиши progressive JPEG правило: продуктовая сущность сразу имеет будущую форму на 1% callable, без legacy harness proof", {
    modes: ["template", "product-goal"],
    skills: [
      "codex-template-sync",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact", "verification-evidence"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("компонент должен сразу содержать будущие функции на 1 процент и прокидывать debug что тут работает а не доказывать старый harness", {
    modes: ["feature", "product-goal"],
    skills: [
      "codex-feature-workflow",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["user-business-outcome-link", "product-goal-artifact"],
    semanticMatches: ["product-goal"],
    planRequired: true,
  });

  testRoute("пропиши себе что компонент сразу содержит будущие функции на 1 процент и debug а не доказывает harness", {
    modes: ["template", "product-goal", "feature"],
    skills: [
      "codex-template-sync",
      "codex-product-goal",
      "codex-strategic-review",
      "codex-feature-workflow",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("update API contract request/response pagination", {
    modes: ["api"],
    skills: ["codex-api-contract", "codex-feature-workflow"],
    risk: "MEDIUM",
  });

  testRoute("запрети MVP мышление и веди задачу как /goal с финальным качеством продукта", {
    modes: ["product-goal"],
    skills: ["codex-product-goal", "codex-strategic-review"],
    qualityGates: ["quality-bar", "current-step", "language-match"],
    planRequired: true,
  });

  testRoute("optimize roadmap for revenue, loyalty, retention, conversion, and app KPI", {
    modes: ["product-goal"],
    skills: ["codex-product-goal", "codex-strategic-review"],
    qualityGates: ["user-business-outcome-link", "quality-bar"],
    planRequired: true,
  });

  testRoute("изучи косяки последней недели и преврати уроки в правила шаблона", {
    modes: ["lessons", "template"],
    skills: ["codex-cross-project-lessons", "codex-template-sync"],
    qualityGates: ["lesson-classification", "validator-or-route-check"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("нужно сохранить вывод из повторяющегося провала и поставить защиту на следующий раз", {
    modes: ["lessons"],
    skills: ["codex-cross-project-lessons", "codex-strategic-review"],
    semanticMatches: ["lessons"],
    planRequired: true,
  });

  testRoute("выпусти release v3.8.0 и tag чтобы проекты качали релиз", {
    modes: ["release"],
    skills: [
      "codex-template-sync",
      "codex-health-check",
      "codex-strategic-review",
    ],
    subagents: ["security_reviewer", "tester"],
    risk: "HIGH",
  });

  testRoute("проверь current OpenAI GPT-5.5 model docs", {
    modes: ["openai"],
    skills: ["codex-openai-model-guidance"],
    subagents: ["docs_researcher"],
    needsFreshDocs: true,
  });

  testRoute("нарисуй mermaid control board for release flow", {
    modes: ["mermaid", "release"],
    skills: ["codex-mermaid-board-workflow"],
  });

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
