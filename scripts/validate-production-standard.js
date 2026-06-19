#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { getRoute } = require("./codex-route-task.js");

const REQUIRED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/library/product/production-product-standard.md",
  ".claude/library/process/product-goal-loop.md",
  ".claude/library/domain/domain-design-system.md",
  "tasks/goal.md",
  "templates/project-starter/tasks/goal.md",
  "templates/project-starter/DESIGN.md",
  "templates/project-starter/design-policy.ignore",
  ".agents/skills/codex-product-goal/SKILL.md",
  ".agents/skills/codex-design-system-workflow/SKILL.md",
  ".agents/skills/codex-product-ux-audit/SKILL.md",
  ".agents/skills/codex-cross-project-lessons/SKILL.md",
];

const REQUIRED_TEXT = [
  { file: "AGENTS.md", text: "Production Product Standard" },
  { file: "AGENTS.md", text: "language of the user's request" },
  { file: "CLAUDE.md", text: "Production Product Standard" },
  { file: "CLAUDE.md", text: "language of the user's request" },
  { file: "AGENTS.md", text: "app-specific business outcomes first" },
  { file: "CLAUDE.md", text: "app-specific business outcomes first" },
  { file: ".claude/library/product/production-product-standard.md", text: "Product Outcome Priority" },
  { file: ".claude/library/process/product-goal-loop.md", text: "Product/Business Priority" },
  { file: ".agents/skills/codex-product-goal/SKILL.md", text: "app-specific KPI" },
  { file: ".agents/skills/codex-strategic-review/SKILL.md", text: "product user" },
  { file: "scripts/codex-route-task.js", text: "user-business-outcome-link" },
  { file: ".claude/library/product/production-product-standard.md", text: "MVP/prototype" },
  { file: ".claude/library/process/product-goal-loop.md", text: "This is not a \"final slice\" model" },
  { file: ".claude/library/domain/domain-design-system.md", text: "Rendered Geometry Gate" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Durable Design Context" },
  { file: ".claude/library/domain/domain-design-pipeline.md", text: "Browser And Visual Hardening Gate" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "root `DESIGN.md`" },
  { file: ".agents/skills/codex-design-workflow/SKILL.md", text: "Hardening Evidence" },
  { file: "templates/project-starter/DESIGN.md", text: "tasks/goal.md` owns product intent" },
  { file: "scripts/validate-design-policy.js", text: "Design policy notification" },
  { file: "tasks/goal.md", text: "Final Outcome" },
  { file: "templates/project-starter/tasks/goal.md", text: "Quality Bar" },
];

const ROUTE_CASES = [
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
  for (const requirement of REQUIRED_TEXT) {
    assertText(requirement);
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
