"use strict";

function runRouteCasesB(testRoute) {
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

  testRoute("сделай LLM агента для Unreal Engine actor персонажа: на 1% готовности создать классы компоненты анимации интерфейсы переменные функции по финальному плану", {
    modes: ["template", "product-goal", "feature"],
    skills: [
      "codex-template-sync",
      "codex-product-goal",
      "codex-feature-workflow",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact", "user-business-outcome-link"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("если финального плана нет, агент должен блокировать реализацию и создать план объекта, потом проверять полноту по плану и уровень детализации", {
    modes: ["template", "product-goal", "strategy"],
    skills: [
      "codex-template-sync",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact"],
    planRequired: true,
    risk: "HIGH",
  });

  testRoute("сайт на 1% должен выполнять продакшн функцию показывать контакты и coming soon приложение", {
    modes: ["product-goal"],
    skills: ["codex-product-goal", "codex-strategic-review"],
    qualityGates: ["product-goal-artifact", "user-business-outcome-link"],
    planRequired: true,
  });

  testRoute("прогрессивный JPEG старые неправильные итерации заглушки и косяки не сохранять выключенными а удалять заменять мигрировать", {
    modes: ["template", "lessons"],
    skills: [
      "codex-template-sync",
      "codex-product-goal",
      "codex-strategic-review",
    ],
    qualityGates: ["template-boundary", "product-goal-artifact", "verification-evidence"],
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

  testRoute("изучи сайт релиза GPT-5.6 и диаграммы на нём, подготовь таблицу", {
    modes: ["openai"],
    notModes: ["bugfix", "mermaid", "release"],
    skills: ["codex-openai-model-guidance"],
    subagents: ["docs_researcher", "reviewer"],
    fanoutStatus: "recommended",
    needsFreshDocs: true,
  });

  testRoute("Research the GPT-5.6 release announcement and diagrams", {
    modes: ["openai"],
    notModes: ["bugfix", "mermaid", "release"],
    skills: ["codex-openai-model-guidance"],
    subagents: ["docs_researcher", "reviewer"],
    fanoutStatus: "recommended",
    needsFreshDocs: true,
  });

  testRoute("изучи сайт релиза GPT-5.6 и диаграммы, без субагентов", {
    modes: ["openai"],
    notModes: ["bugfix", "mermaid", "release"],
    notSubagents: ["docs_researcher", "reviewer"],
    fanoutStatus: "skip",
  });

  testRoute("Что такое GPT-5.6?", {
    modes: ["openai"],
    fanoutStatus: "skip",
  });

  testRoute("обнови шаблон агентов, проверь и выпусти версию 4.6", {
    modes: ["template", "release"],
    subagents: ["systems_reviewer", "tester"],
    fanoutStatus: "required",
    risk: "HIGH",
  });

  testRoute("update the GPT-5.6 release site diagram and publish it", {
    modes: ["openai", "release", "mermaid"],
    notModes: ["bugfix"],
  });

  testRoute("draw a mermaid sequence", {
    modes: ["mermaid"],
    fanoutStatus: "conditional",
  });

}

module.exports = { runRouteCasesB };
