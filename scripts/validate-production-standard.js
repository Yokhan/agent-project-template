#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { getRoute } = require("./codex-route-task.js");

const REQUIRED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/library/product/production-product-standard.md",
  ".claude/library/process/product-goal-loop.md",
  ".claude/library/process/client-executor-contract.md",
  ".claude/library/domain/domain-design-system.md",
  "tasks/goal.md",
  ".agents/skills/codex-product-goal/SKILL.md",
  ".agents/skills/codex-design-system-workflow/SKILL.md",
  ".agents/skills/codex-design-workflow/references/design-command-modes.md",
  ".agents/skills/codex-product-ux-audit/SKILL.md",
  ".agents/skills/codex-cross-project-lessons/SKILL.md",
  "scripts/lib/codex-route-intents.js",
];

const SOURCE_ONLY_REQUIRED_FILES = [
  "templates/project-starter/tasks/goal.md",
  "templates/project-starter/DESIGN.md",
  "templates/project-starter/design-policy.ignore",
];

const REQUIRED_TEXT = [
  { file: "AGENTS.md", text: "Production Product Standard" },
  { file: "AGENTS.md", text: "language of the user's request" },
  { file: "CLAUDE.md", text: "Production Product Standard" },
  { file: "CLAUDE.md", text: "language of the user's request" },
  { file: "AGENTS.md", text: "app-specific business outcomes first" },
  { file: "CLAUDE.md", text: "app-specific business outcomes first" },
  { file: "docs/SHARED_CONVENTIONS.md", text: "Client Executor Accountability" },
  { file: ".claude/library/product/production-product-standard.md", text: "Product Outcome Priority" },
  { file: ".claude/library/product/production-product-standard.md", text: "Client Executor Standard" },
  { file: ".claude/library/process/product-goal-loop.md", text: "Product/Business Priority" },
  { file: ".claude/library/process/product-goal-loop.md", text: "client-executor-contract.md" },
  { file: ".claude/library/process/client-executor-contract.md", text: "No Fake Completion" },
  { file: ".claude/library/process/client-executor-contract.md", text: "Anti-Sycophancy Rules" },
  { file: ".claude/library/process/client-executor-contract.md", text: "evidence before claiming work is done" },
  { file: ".claude/library/process/client-executor-contract.md", text: "Progressive JPEG Delivery" },
  { file: ".claude/library/process/client-executor-contract.md", text: "Progressive JPEG Implementation Meaning" },
  { file: ".claude/library/process/client-executor-contract.md", text: "whole planned object at low detail" },
  { file: ".claude/library/process/client-executor-contract.md", text: "first useful view" },
  { file: ".claude/library/process/client-executor-contract.md", text: "next sharpened layer" },
  { file: ".claude/library/process/client-executor-contract.md", text: "replan trigger" },
  { file: ".claude/library/process/plan-first.md", text: "### Progressive JPEG" },
  { file: ".claude/library/process/plan-first.md", text: "1% callable" },
  { file: ".claude/library/process/plan-first.md", text: "Final object plan" },
  { file: ".claude/library/process/product-goal-loop.md", text: "Progressive JPEG Checkpoint" },
  { file: ".claude/library/process/product-goal-loop.md", text: "Progressive JPEG Implementation Gate" },
  { file: ".claude/library/process/product-goal-loop.md", text: "Verification order for object readiness" },
  { file: ".claude/library/product/production-product-standard.md", text: "Progressive JPEG Implementation Gate" },
  { file: ".claude/library/product/production-product-standard.md", text: "end-state skeleton" },
  { file: ".claude/library/product/production-product-standard.md", text: "Object Readiness Levels" },
  { file: ".claude/library/product/production-product-standard.md", text: "Unreal/game actor" },
  { file: ".claude/library/process/product-goal-loop.md", text: "broken contract" },
  { file: ".claude/library/process/product-goal-loop.md", text: "smallest systemic fix" },
  { file: ".claude/library/meta/strategic-thinking.md", text: "TRIZ Contradiction Gate" },
  { file: ".claude/library/meta/strategic-thinking.md", text: "Sun Tzu / Stratagem Terrain Check" },
  { file: ".claude/library/meta/strategic-thinking.md", text: "Plan Reality Check" },
  { file: ".claude/library/technical/writing.md", text: "progressive JPEG shape" },
  { file: "AGENTS.md", text: "progressive JPEG delivery" },
  { file: "AGENTS.md", text: "end-state skeleton" },
  { file: "AGENTS.md", text: "1% callable" },
  { file: "AGENTS.md", text: "final product plan is missing" },
  { file: "AGENTS.md", text: "production function" },
  { file: "AGENTS.md", text: "SOT Conflict Protocol" },
  { file: "AGENTS.md", text: "Systemic Error Analysis" },
  { file: "AGENTS.md", text: "Thinking Tools Gate" },
  { file: "AGENTS.md", text: "semantic intent scoring" },
  { file: "AGENTS.md", text: "TRIZ contradiction gate" },
  { file: "AGENTS.md", text: "Sun Tzu / stratagem terrain check" },
  { file: "AGENTS.md", text: "Marketing/GTM" },
  { file: "AGENTS.md", text: "Task Formulation Examples" },
  { file: "CLAUDE.md", text: "progressive JPEG delivery" },
  { file: "CLAUDE.md", text: "end-state skeleton" },
  { file: "CLAUDE.md", text: "SOT conflict protocol" },
  { file: "CLAUDE.md", text: "Thinking tools gate" },
  { file: "CLAUDE.md", text: "semantic intent scoring" },
  { file: "CLAUDE.md", text: "Sun Tzu/stratagem terrain check" },
  { file: "CLAUDE.md", text: "Systemic Error Analysis" },
  { file: "docs/AGENT_CONTEXT_SOT.md", text: "SOT Conflict Protocol" },
  { file: "docs/AGENT_CONTEXT_SOT.md", text: "ask the user with 2-3 options" },
  { file: "brain/03-knowledge/communication/ilyakhov-planning-principles.md", text: "Superseded integration decision" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "app-specific KPI" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "fresh evidence" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "progressive JPEG delivery" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "1% callable" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "Object Readiness Check" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "product user" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "sycophancy" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "TRIZ contradiction gate" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "Sun Tzu / stratagem terrain check" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "marketing/GTM work" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "Ilyakhov plan reality check" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "progressive JPEG delivery" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "legacy harness proof" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "object readiness" },
  { file: ".agents/skills/codex-agent-router/SKILL.md", text: "Marketing, GTM, positioning" },
  { file: ".agents/skills/codex-agent-router/SKILL.md", text: "semantic intent scoring" },
  { file: ".agents/skills/codex-agent-router/SKILL.md", text: "end-state skeleton" },
  { file: ".agents/skills/codex-feature-workflow/SKILL.md", text: "Progressive JPEG Implementation" },
  { file: ".agents/skills/codex-feature-workflow/SKILL.md", text: "1% ready" },
  { file: ".agents/skills/codex-feature-workflow/SKILL.md", text: "final object plan" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "1% callable component slots" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "final plan" },
  { file: ".agents/skills/codex-design-system-workflow/SKILL.md", text: "End-state skeleton" },
  { file: ".agents/skills/codex-design-system-workflow/SKILL.md", text: "Plan gate" },
  { file: ".agents/skills/codex-decompose/SKILL.md", text: "progressive JPEG delivery" },
  { file: ".agents/skills/codex-decompose/SKILL.md", text: "progressive JPEG implementation" },
  { file: ".agents/skills/codex-decompose/SKILL.md", text: "object readiness level" },
  { file: ".agents/skills/codex-domain-communication-review/SKILL.md", text: "text, book" },
  { file: ".agents/skills/codex-domain-communication-review/SKILL.md", text: "core promise" },
  { file: "scripts/lib/codex-route-intents.js", text: "INTENT_GROUPS" },
  { file: "scripts/lib/codex-route-intents.js", text: "future capability" },
  { file: "scripts/lib/codex-route-intents.js", text: "remember this rule" },
  { file: "scripts/codex-route-task.js", text: "user-business-outcome-link" },
  { file: "scripts/codex-route-task.js", text: "client-executor" },
  { file: "scripts/codex-route-task.js", text: "single source of truth" },
  { file: "scripts/codex-route-task.js", text: "go-to-market" },
  { file: "scripts/codex-route-task.js", text: "write this into yourself" },
  { file: "scripts/codex-route-task.js", text: "semanticMatches" },
  { file: "scripts/codex-route-task.js", text: "exact-patterns-plus-semantic-intent-scoring" },
  { file: ".claude/library/product/production-product-standard.md", text: "MVP/prototype" },
  { file: ".claude/library/process/product-goal-loop.md", text: "This is not a \"final slice\" model" },
  { file: ".claude/library/domain/domain-design-system.md", text: "Rendered Geometry Gate" },
  { file: ".claude/library/domain/domain-design-system.md", text: "end-state skeleton" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Durable Design Context" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "1% callable" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Register Gate" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Human judgment before deterministic findings" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Browser And Visual Hardening Gate" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "root `DESIGN.md`" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "Hardening Evidence" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "references/design-command-modes.md" },
  { file: ".agents/skills/codex-design-workflow/references/design-command-modes.md", text: "Register Gate" },
  { file: ".agents/skills/codex-design-workflow/references/design-command-modes.md", text: "Product register" },
  { file: ".agents/skills/codex-design-workflow/references/design-command-modes.md", text: "Human judgment first, validator output second" },
  { file: ".agents/skills/codex-domain-design-review/SKILL.md", text: "Automated findings are evidence, not the design verdict" },
  { file: "scripts/validate-design-policy.js", text: "Design policy notification" },
  { file: "tasks/goal.md", text: "Final Outcome" },
];

const SOURCE_ONLY_REQUIRED_TEXT = [
  { file: "templates/project-starter/DESIGN.md", text: "tasks/goal.md` owns product intent" },
  { file: "templates/project-starter/tasks/goal.md", text: "Quality Bar" },
];

const ROUTE_CASES = [
  {
    task: "agent template client-executor contract anti-sycophancy no fake completion",
    skills: ["codex-template-sync", "codex-product-goal", "codex-strategic-review"],
    gates: ["template-boundary", "verification-evidence"],
  },
  {
    task: "пропиши progressive JPEG правило: продуктовая сущность сразу имеет будущую форму на 1% callable, без legacy harness proof",
    skills: ["codex-template-sync", "codex-product-goal", "codex-strategic-review"],
    gates: ["template-boundary", "product-goal-artifact", "verification-evidence"],
  },
  {
    task: "компонент должен сразу содержать будущие функции на 1 процент и прокидывать debug что тут работает а не доказывать старый harness",
    skills: ["codex-feature-workflow", "codex-product-goal", "codex-strategic-review"],
    gates: ["user-business-outcome-link", "product-goal-artifact"],
  },
  {
    task: "пропиши себе что компонент сразу содержит будущие функции на 1 процент и debug а не доказывает harness",
    skills: ["codex-template-sync", "codex-product-goal", "codex-strategic-review", "codex-feature-workflow"],
    gates: ["template-boundary", "product-goal-artifact"],
  },
  {
    task: "сделай LLM агента для Unreal Engine actor персонажа: на 1% готовности создать классы компоненты анимации интерфейсы переменные функции по финальному плану",
    skills: ["codex-template-sync", "codex-product-goal", "codex-feature-workflow", "codex-strategic-review"],
    gates: ["template-boundary", "product-goal-artifact", "user-business-outcome-link"],
  },
  {
    task: "если финального плана нет, агент должен блокировать реализацию и создать план объекта, потом проверять полноту по плану и уровень детализации",
    skills: ["codex-template-sync", "codex-product-goal", "codex-strategic-review"],
    gates: ["template-boundary", "product-goal-artifact"],
  },
  {
    task: "сайт на 1% должен выполнять продакшн функцию показывать контакты и coming soon приложение",
    skills: ["codex-product-goal", "codex-strategic-review"],
    gates: ["product-goal-artifact", "user-business-outcome-link"],
  },
  {
    task: "усилить AGENTS основной файл SOT conflict TRIZ образ мысли Ильяхов",
    skills: ["codex-template-sync", "codex-agent-router", "codex-product-goal", "codex-strategic-review"],
    gates: ["template-boundary", "sot-validation", "product-goal-artifact"],
  },
  {
    task: "маркетологи проверяют позиционирование оффер воронку кампанию и ICP",
    skills: ["codex-domain-communication-review", "codex-domain-business-review", "codex-product-goal", "codex-strategic-review"],
    gates: ["audience-icp", "positioning-offer-clarity", "measurement-and-ethics"],
  },
  {
    task: "пользователи не покупают повторно деньги теряются путь ломается",
    skills: ["codex-domain-communication-review", "codex-domain-business-review", "codex-product-goal"],
    gates: ["journey-or-funnel-fit", "user-business-outcome-link"],
  },
  {
    task: "кто-то может получить чужие данные из сессии",
    skills: ["codex-security-audit", "codex-strategic-review"],
    gates: ["rollback-or-plan-b"],
  },
  {
    task: "проверь стратагемы Сунь-цзы и конкурентную стратегию",
    skills: ["codex-strategic-review"],
    gates: ["verification-evidence"],
  },
  {
    task: "optimize plan for revenue, retention, loyalty, and business KPI",
    skills: ["codex-product-goal", "codex-strategic-review"],
    gates: ["product-goal-artifact", "user-business-outcome-link"],
  },
  {
    task: "запрети MVP мышление и веди как goal",
    skills: ["codex-product-goal"],
    gates: ["quality-bar", "current-step"],
  },
  {
    task: "доработай дизайн-систему, токены, Storybook и атомы",
    skills: ["codex-design-system-workflow"],
    gates: ["token-contract", "rendered-geometry"],
  },
  {
    task: "проверь UX входа, сервисы и dead ends",
    skills: ["codex-product-ux-audit"],
    gates: ["entry-to-value-flow", "no-dead-ends"],
  },
  {
    task: "изучи косяки недели и улучши шаблон",
    skills: ["codex-cross-project-lessons", "codex-template-sync"],
    gates: ["lesson-classification", "product-goal-artifact"],
  },
];

const state = {
  checks: 0,
  errors: [],
};

function addError(message) {
  state.errors.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function isTemplateSourceRepo() {
  const specPath = path.join(process.cwd(), "PROJECT_SPEC.md");
  if (!fs.existsSync(specPath)) {
    return false;
  }
  const hasSourceOnlyStarter = fs.existsSync(path.join(process.cwd(), "templates/project-starter"));
  return hasSourceOnlyStarter && readText(specPath).split(/\r?\n/).some((line) => line.trim() === "- Name: agent-project-template");
}

function assertFile(relativePath) {
  state.checks += 1;
  if (!fs.existsSync(path.join(process.cwd(), relativePath))) {
    addError(`missing required v4 file: ${relativePath}`);
  }
}

function assertText(requirement) {
  state.checks += 1;
  const filePath = path.join(process.cwd(), requirement.file);
  if (!fs.existsSync(filePath)) {
    addError(`cannot check missing file: ${requirement.file}`);
    return;
  }
  if (!readText(filePath).includes(requirement.text)) {
    addError(`${requirement.file} missing text: ${requirement.text}`);
  }
}

function assertIncludes(values, expected, label) {
  state.checks += 1;
  if (!values.includes(expected)) {
    addError(`${label} missing ${expected}; got ${values.join(", ")}`);
  }
}

function assertRoute(routeCase) {
  const route = getRoute(routeCase.task);
  if (!route.planContract?.required) {
    addError(`${routeCase.task}: planContract.required must be true`);
  }
  if (!route.productionBar?.noMvpByDefault) {
    addError(`${routeCase.task}: productionBar.noMvpByDefault must be true`);
  }
  if (route.productionBar?.outcomePriority !== "product-user-and-app-specific-business-kpis-first") {
    addError(`${routeCase.task}: productionBar.outcomePriority must prioritize product user and business KPIs`);
  }
  if (!route.qualityGates?.includes("user-business-outcome-link")) {
    addError(`${routeCase.task}: qualityGates must include user-business-outcome-link`);
  }
  for (const skill of routeCase.skills) {
    assertIncludes(route.skills, skill, `${routeCase.task} skills`);
  }
  for (const gate of routeCase.gates) {
    assertIncludes(route.qualityGates || [], gate, `${routeCase.task} gates`);
  }
}

function main() {
  for (const filePath of REQUIRED_FILES) {
    assertFile(filePath);
  }
  if (isTemplateSourceRepo()) {
    for (const filePath of SOURCE_ONLY_REQUIRED_FILES) {
      assertFile(filePath);
    }
  }
  for (const requirement of REQUIRED_TEXT) {
    assertText(requirement);
  }
  if (isTemplateSourceRepo()) {
    for (const requirement of SOURCE_ONLY_REQUIRED_TEXT) {
      assertText(requirement);
    }
  }
  for (const routeCase of ROUTE_CASES) {
    assertRoute(routeCase);
  }

  console.log(`Production standard checks: ${state.checks}`);
  for (const error of state.errors) {
    console.error(`ERROR: ${error}`);
  }
  if (state.errors.length > 0) {
    process.exit(1);
  }
}

main();
