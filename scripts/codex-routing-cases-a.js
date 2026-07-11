"use strict";

function runRouteCasesA(testRoute) {
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
    subagents: ["scout", "tester"],
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

}

module.exports = { runRouteCasesA };
