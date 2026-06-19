#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const STATE_PATH = path.join("tasks", ".active-codex-route.json");
const SHARED_RULES = {
  base: [".claude/library/process/context-first.md", ".claude/library/process/research-first.md", ".claude/library/process/self-verification.md"],
  implementation: [".claude/library/process/plan-first.md", ".claude/library/technical/architecture.md", ".claude/library/technical/code-style.md", ".claude/library/technical/error-handling.md"],
  review: [".claude/library/meta/critical-thinking.md", ".claude/library/meta/analysis.md"],
  design: [".claude/library/domain/domain-design-pipeline.md", ".claude/library/technical/atomic-reuse.md"],
  designSystem: [".claude/library/domain/domain-design-system.md", ".claude/library/domain/domain-design-pipeline.md", ".claude/library/technical/atomic-reuse.md"],
  product: [".claude/library/product/production-product-standard.md", ".claude/library/process/product-goal-loop.md"],
  testing: [".claude/library/technical/testing.md"],
  writing: [".claude/library/technical/writing.md"],
  git: [".claude/library/technical/git-workflow.md"],
  safety: [".claude/library/domain/domain-guards.md"],
};
const ROUTES = [
  {
    mode: "security",
    pattern:
      /security|vulnerab|secret|auth|permission|injection|xss|csrf|ssrf|cve|owasp|безопас|уязвим|секрет|инъекц|права/i,
    skills: ["codex-security-audit", "codex-pipeline-workflow"],
    pipeline: "security patch",
    subagents: ["security_reviewer", "pr_explorer", "tester"],
    rules: ["review", "testing", "safety"],
    risk: "HIGH",
  },
  {
    mode: "bugfix",
    pattern:
      /fix|bug|broken|fail|failing|crash|regression|error|repair|почини|исправ|сломал|не работает|падает|ошибка|баг/i,
    skills: ["codex-debug", "codex-pipeline-workflow"],
    pipeline: "bugfix",
    subagents: ["pr_explorer", "tester", "reviewer"],
    rules: ["implementation", "testing"],
    risk: "MEDIUM",
  },
  {
    mode: "design-system",
    pattern:
      /design system|storybook|tokens?|atomic|atoms?|molecules?|organisms?|component library|spacing|radius|typography|motion token|rendered geometry|дизайн-?систем|сторибук|токен|атом|молекул|организм|отступ|скругл|типограф|баунд|bounding/i,
    skills: ["codex-design-system-workflow", "codex-design-workflow", "codex-domain-design-review"],
    pipeline: "design system",
    subagents: ["design_reviewer", "tester", "reviewer"],
    rules: ["product", "designSystem", "testing"],
    gates: ["token-contract", "composition-trace", "storybook-or-equivalent", "rendered-geometry", "responsive-state-check"],
    risk: "HIGH",
  },
  {
    mode: "product-ux",
    pattern:
      /user flow|dead end|dashboard|account|hub|login|logout|session|return path|service access|useful|ux|лк|личн|дешборд|дашборд|вход|выход|сесси|флоу|сценар|клик|сервис|главн|доки/i,
    skills: ["codex-product-ux-audit", "codex-design-workflow", "codex-domain-design-review"],
    pipeline: "product ux",
    subagents: ["design_reviewer", "tester", "reviewer"],
    rules: ["product", "design", "testing"],
    gates: ["entry-to-value-flow", "no-dead-ends", "auth-session-states", "return-path", "responsive-check"],
    risk: "MEDIUM",
  },
  {
    mode: "design",
    pattern:
      /design|figma|ui|ux|css|layout|visual|component|responsive|accessib|screen|mockup|shape|craft|critique|distill|harden|polish|adapt|clarify|typeset|colorize|bolder|quieter|дизайн|фигма|макет|экран|интерфейс|стиль/i,
    skills: ["codex-design-workflow", "codex-domain-design-review"],
    pipeline: "design",
    subagents: ["design_reviewer", "tester", "reviewer"],
    rules: ["design", "testing"],
    gates: ["token-contract", "state-coverage", "responsive-check"],
    risk: "MEDIUM",
  },
  {
    mode: "figma",
    pattern: /figma|code connect|mockup|capture to figma|фигма/i,
    skills: ["codex-figma-workflow"],
    pipeline: "design",
    subagents: ["design_reviewer"],
    rules: ["design"],
    risk: "MEDIUM",
  },
  {
    mode: "template",
    pattern:
      /template|agents\.md|claude\.md|skill|subagent|router|route|sync-template|agent project|шаблон|агент|скилл|роут|маршрут|синхрон/i,
    skills: ["codex-template-sync", "codex-skill-maintenance", "codex-test-rules", "codex-agent-router"],
    pipeline: "template maintenance",
    subagents: ["pr_explorer", "tester", "reviewer"],
    rules: ["product", "review", "testing", "git"],
    gates: ["template-boundary", "sot-validation", "sync-regression", "release-gate"],
    risk: "HIGH",
  },
  {
    mode: "product-goal",
    pattern:
      /business|kpi|revenue|monetization|money|conversion|activation|retention|loyalty|sales|pricing|support load/i,
    skills: ["codex-product-goal", "codex-strategic-review", "codex-decompose"],
    pipeline: "product planning",
    subagents: ["pr_explorer", "reviewer"],
    rules: ["product", "review"],
    gates: ["product-goal-artifact", "quality-bar", "current-step", "language-match"],
    risk: "MEDIUM",
  },
  {
    mode: "product-goal",
    pattern:
      /product goal|final outcome|quality bar|production|prod|finish|continue|done right|mvp|prototype|goal|roadmap|продакшн|прод|продукт|цель|финал|качеств|доделай|продолжай|мвп|прототип|роадмап/i,
    skills: ["codex-product-goal", "codex-strategic-review", "codex-decompose"],
    pipeline: "product planning",
    subagents: ["pr_explorer", "reviewer"],
    rules: ["product", "review"],
    gates: ["product-goal-artifact", "quality-bar", "current-step", "language-match"],
    risk: "MEDIUM",
  },
  {
    mode: "lessons",
    pattern:
      /lesson|lessons|retrospective|post-?mortem|last week|promote|self improvement|косяк|ошибк|урок|ретро|недел|извлек|промоут/i,
    skills: ["codex-cross-project-lessons", "codex-self-update", "codex-strategic-review"],
    pipeline: "self improvement",
    subagents: ["pr_explorer", "reviewer"],
    rules: ["product", "review"],
    gates: ["lesson-classification", "reusable-target", "validator-or-route-check"],
    risk: "MEDIUM",
  },
  {
    mode: "release",
    pattern:
      /release|tag|version|changelog|publish|github release|deploy|релиз|верси|тег|опубликуй|выкат/i,
    skills: ["codex-template-sync", "codex-health-check", "codex-test-rules"],
    pipeline: "release",
    subagents: ["tester", "reviewer", "security_reviewer"],
    rules: ["git", "review", "testing"],
    risk: "HIGH",
  },
  {
    mode: "openai",
    pattern:
      /openai|gpt|codex|responses api|model|reasoning effort|модель|опенаи|gpt-?5/i,
    skills: ["codex-openai-model-guidance"],
    pipeline: "docs research",
    subagents: ["docs_researcher", "reviewer"],
    rules: ["review"],
    needsFreshDocs: true,
    risk: "MEDIUM",
  },
  {
    mode: "mermaid",
    pattern:
      /mermaid|diagram|flowchart|board|architecture map|control board|диаграм|схем|борд|карта/i,
    skills: ["codex-mermaid-board-workflow"],
    pipeline: "documentation",
    subagents: ["reviewer"],
    rules: ["writing"],
    risk: "LOW",
  },
  {
    mode: "api",
    pattern:
      /api|endpoint|openapi|contract|schema|pagination|rate limit|апи|эндпоинт|контракт/i,
    skills: ["codex-api-contract", "codex-feature-workflow"],
    pipeline: "feature",
    subagents: ["pr_explorer", "tester", "reviewer"],
    rules: ["implementation", "testing"],
    risk: "MEDIUM",
  },
  {
    mode: "testing",
    pattern: /test|coverage|spec|assert|pytest|jest|vitest|тест|покрыт/i,
    skills: ["codex-coverage"],
    pipeline: "quality gate",
    subagents: ["tester", "reviewer"],
    rules: ["testing", "review"],
    risk: "MEDIUM",
  },
  {
    mode: "migration",
    pattern: /migrate|migration|schema|database|data move|миграц|схем|база/i,
    skills: ["codex-migrate", "codex-pipeline-workflow"],
    pipeline: "migration",
    subagents: ["pr_explorer", "tester", "security_reviewer"],
    rules: ["implementation", "testing", "safety"],
    risk: "HIGH",
  },
  {
    mode: "docs",
    pattern:
      /docs|readme|document|guide|writing|copy|text|документ|ридми|гайд|текст|напиши/i,
    skills: ["codex-domain-communication-review"],
    pipeline: "documentation",
    subagents: ["reviewer"],
    rules: ["writing", "review"],
    risk: "LOW",
  },
  {
    mode: "feature",
    pattern:
      /implement|build|create|add|feature|module|component|service|создай|добавь|реализуй|настрой/i,
    skills: ["codex-feature-workflow", "codex-pipeline-workflow"],
    pipeline: "feature",
    subagents: ["pr_explorer", "tester", "reviewer"],
    rules: ["implementation", "testing"],
    risk: "MEDIUM",
  },
  {
    mode: "review",
    pattern:
      /review|audit|check|inspect|analyze|evaluate|проверь|аудит|разбери|оцени|посмотри/i,
    skills: ["codex-audit"],
    pipeline: "review",
    subagents: ["pr_explorer", "reviewer", "tester"],
    rules: ["review"],
    risk: "MEDIUM",
  },
  {
    mode: "strategy",
    pattern:
      /strategy|roadmap|plan|decompose|brainstorm|risk|стратег|план|декомпоз|разбей|риск/i,
    skills: ["codex-strategic-review", "codex-decompose"],
    pipeline: "planning",
    subagents: ["pr_explorer", "reviewer"],
    rules: ["review"],
    risk: "MEDIUM",
  },
];
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function pathExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}
function hasGlobMatch(root, parts) {
  const [first, second, third] = parts;
  const firstPath = path.join(root, first);
  if (!fs.existsSync(firstPath)) return false;
  return fs.readdirSync(firstPath, { withFileTypes: true }).some((entry) => {
    const secondPath = path.join(firstPath, entry.name, second);
    return entry.isDirectory() && fs.existsSync(path.join(secondPath, third));
  });
}
function detectArtifacts(root) {
  const artifactChecks = [
    {
      name: "agentos",
      present:
        pathExists(root, ".agent-os") ||
        pathExists(root, ".agentos") ||
        pathExists(root, "agentos") ||
        pathExists(root, "AgentOS.md"),
      role: "external orchestrator owns Strategy/Tactic/Plan/Todo/Gate state",
    },
    {
      name: "spec-kit",
      present:
        pathExists(root, ".specify") ||
        hasGlobMatch(root, ["specs", "spec.md", ""]) ||
        hasGlobMatch(root, ["specs", "plan.md", ""]),
      role: "spec/plan/tasks artifacts are the input contract",
    },
    {
      name: "kiro",
      present:
        pathExists(root, ".kiro") ||
        pathExists(root, "requirements.md") ||
        pathExists(root, "design.md"),
      role: "requirements/design/tasks artifacts are the input contract",
    },
    {
      name: "litkit",
      present:
        pathExists(root, "litkit") || pathExists(root, "core/config.yaml"),
      role: "domain pipeline and vocabulary own sequencing",
    },
    {
      name: "project-overlays",
      present:
        pathExists(root, ".agents/skills") &&
        fs.readdirSync(path.join(root, ".agents/skills"), { withFileTypes: true })
          .some((entry) => entry.isDirectory() && entry.name.startsWith("project-")),
      role: "project-specific skills extend the route",
    },
    {
      name: "template-native",
      present:
        pathExists(root, "PROJECT_SPEC.md") ||
        pathExists(root, "tasks/current.md") ||
        pathExists(root, "docs/AGENT_PIPELINES.md"),
      role: "template context and pipelines are available",
    },
  ];
  return artifactChecks.filter((item) => item.present);
}
function getOrchestrator(artifacts) {
  if (artifacts.some((artifact) => artifact.name === "agentos")) {
    return {
      owner: "agentos",
      codexRole: "worker",
      instruction:
        "AgentOS is the orchestrator. Use AgentOS artifacts as the source task graph; Codex only executes the assigned route.",
    };
  }
  if (artifacts.some((artifact) => artifact.name !== "template-native")) {
    return {
      owner: "project-artifacts",
      codexRole: "parent",
      instruction:
        "Existing project artifacts own the task graph. Codex sequences work around them instead of replacing them.",
    };
  }
  return {
    owner: "codex-parent",
    codexRole: "orchestrator",
    instruction:
      "No external orchestrator detected. Parent Codex thread owns sequencing, consolidation, edits, and verification.",
  };
}
function needsStrategicReview(selected, risk, artifacts) {
  const strategicModes = new Set(["strategy", "template", "release", "security", "migration", "product-goal", "lessons"]);
  return risk === "HIGH" ||
    selected.some((route) => strategicModes.has(route.mode)) ||
    artifacts.some((artifact) => artifact.name !== "template-native");
}
function needsProductGoal(selected, risk) {
  const productModes = new Set(["product-goal", "product-ux", "design-system", "template", "release", "strategy", "lessons"]);
  return risk !== "LOW" && selected.some((route) => productModes.has(route.mode));
}
function getPlanContract(selected, risk) {
  const modes = new Set(selected.map((route) => route.mode));
  return {
    required: risk !== "LOW" || modes.has("product-goal") || modes.has("template"),
    language: "match-user-request",
    writeTo: "tasks/current.md",
    goalArtifact: modes.has("product-goal") || modes.has("template") || modes.has("design-system")
      ? "read-or-create tasks/goal.md for M+ product work"
      : "read tasks/goal.md when present",
    approval: risk === "CRITICAL" ? "ask-user-before-state-change" : "state-strategy-before-state-change",
    outcomePriority:
      "name product-user experience and app-specific business KPI before technical work",
  };
}
function getProductionBar(selected) {
  const modes = selected.map((route) => route.mode);
  return {
    default: "final-product-quality",
    noMvpByDefault: true,
    currentStepAllowed: true,
    preserveFinalOutcome: true,
    outcomePriority: "product-user-and-app-specific-business-kpis-first",
    technicalWorkCondition:
      "must-unblock-protect-or-measurably-improve-user-business-outcome",
    businessOutcomes: [
      "revenue",
      "loyalty",
      "retention",
      "conversion",
      "activation",
      "support-load",
      "app-specific-kpi",
    ],
    appliesToModes: modes,
  };
}
function getQualityGates(selected, risk, shouldUseProductGoal = false) {
  const base = ["success-criteria", "user-business-outcome-link", "verification-evidence", "confidence-and-doubt"];
  const riskGates = risk === "HIGH" || risk === "CRITICAL"
    ? ["rollback-or-plan-b", "route-state-written"]
    : [];
  const productGoalGates = shouldUseProductGoal
    ? ["product-goal-artifact", "quality-bar", "current-step", "language-match"]
    : [];
  return unique([
    ...base,
    ...riskGates,
    ...productGoalGates,
    ...selected.flatMap((route) => route.gates || []),
  ]);
}
function getRoute(task, options = {}) {
  const cwd = options.cwd || process.cwd();
  const matches = ROUTES.filter((route) => route.pattern.test(task));
  const defaultMode = /сделай|сделать|do it|make it/i.test(task)
    ? "feature"
    : "review";
  const selected = matches.length > 0
    ? matches
    : [ROUTES.find((route) => route.mode === defaultMode)];
  const artifacts = detectArtifacts(cwd);
  const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const risk = selected.reduce(
    (current, route) =>
      riskOrder[route.risk] > riskOrder[current] ? route.risk : current,
    "LOW",
  );
  const shouldUseStrategicReview = needsStrategicReview(selected, risk, artifacts);
  const shouldUseProductGoal = needsProductGoal(selected, risk);
  const ruleGroups = unique([
    "base",
    ...selected.flatMap((route) => route.rules || []),
  ]);
  return {
    task,
    routedAt: new Date().toISOString(),
    modes: unique(selected.map((route) => route.mode)),
    pipeline: selected[0].pipeline,
    risk,
    skills: unique([
      ...selected.flatMap((route) => route.skills || []),
      shouldUseProductGoal ? "codex-product-goal" : "",
      shouldUseStrategicReview ? "codex-strategic-review" : "",
    ]),
    subagents: unique(selected.flatMap((route) => route.subagents || [])),
    sharedRules: unique(
      ruleGroups.flatMap((group) => SHARED_RULES[group] || []),
    ),
    planContract: getPlanContract(selected, risk),
    productionBar: getProductionBar(selected),
    languagePolicy: "plans-audits-status-and-final-reports-match-user-request-language",
    qualityGates: getQualityGates(selected, risk, shouldUseProductGoal),
    needsFreshDocs: selected.some((route) => route.needsFreshDocs),
    artifacts,
    orchestrator: getOrchestrator(artifacts),
  };
}
function formatSummary(route) {
  return [
    `ROUTE: ${route.modes.join("+")}`,
    `PIPELINE: ${route.pipeline}`,
    `RISK: ${route.risk}`,
    `SKILLS: ${route.skills.join(", ")}`,
    `SUBAGENTS: ${route.subagents.join(", ") || "none"}`,
    `ORCHESTRATOR: ${route.orchestrator.owner} (${route.orchestrator.codexRole})`,
    `PLAN: ${route.planContract.required ? "required" : "optional"} | ${route.planContract.language}`,
    `PRODUCT_BAR: ${route.productionBar.default} | outcome=${route.productionBar.outcomePriority} | no_mvp=${route.productionBar.noMvpByDefault}`,
    `GATES: ${route.qualityGates.join(", ")}`,
    `RULES: ${route.sharedRules.join(", ")}`,
    route.needsFreshDocs
      ? "FRESH_DOCS: required"
      : "FRESH_DOCS: not required by route",
  ].join(os.EOL);
}
function writeState(route, statePath = STATE_PATH) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(route, null, 2)}\n`);
}
function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const task = argv
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
  return {
    task,
    isSummary: flags.has("--summary") || flags.has("--text"),
    shouldWriteState: flags.has("--write-state"),
  };
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.task) {
    console.error(
      'Usage: node scripts/codex-route-task.js "<task>" [--summary] [--write-state]',
    );
    process.exit(1);
  }
  const route = getRoute(args.task);
  if (args.shouldWriteState) {
    writeState(route);
  }
  console.log(
    args.isSummary ? formatSummary(route) : JSON.stringify(route, null, 2),
  );
}
if (require.main === module) {
  main();
}
module.exports = {
  ROUTES,
  detectArtifacts,
  formatSummary,
  getRoute,
  writeState,
};
