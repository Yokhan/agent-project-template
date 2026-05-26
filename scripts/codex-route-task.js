#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const STATE_PATH = path.join("tasks", ".active-codex-route.json");
const SHARED_RULES = {
  base: [
    ".claude/library/process/context-first.md",
    ".claude/library/process/research-first.md",
    ".claude/library/process/self-verification.md",
  ],
  implementation: [
    ".claude/library/process/plan-first.md",
    ".claude/library/technical/architecture.md",
    ".claude/library/technical/code-style.md",
    ".claude/library/technical/error-handling.md",
  ],
  review: [
    ".claude/library/meta/critical-thinking.md",
    ".claude/library/meta/analysis.md",
  ],
  design: [
    ".claude/library/domain/domain-design-pipeline.md",
    ".claude/library/technical/atomic-reuse.md",
  ],
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
    mode: "design",
    pattern:
      /design|figma|ui|ux|css|layout|visual|component|responsive|accessib|screen|mockup|дизайн|фигма|макет|экран|интерфейс|стиль/i,
    skills: ["codex-design-workflow", "codex-domain-design-review"],
    pipeline: "design",
    subagents: ["design_reviewer", "tester", "reviewer"],
    rules: ["design", "testing"],
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
    skills: [
      "codex-template-sync",
      "codex-skill-maintenance",
      "codex-test-rules",
      "codex-agent-router",
    ],
    pipeline: "template maintenance",
    subagents: ["pr_explorer", "tester", "reviewer"],
    rules: ["review", "testing", "git"],
    risk: "HIGH",
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
        fs
          .readdirSync(path.join(root, ".agents/skills"), {
            withFileTypes: true,
          })
          .some(
            (entry) => entry.isDirectory() && entry.name.startsWith("project-"),
          ),
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
function getRoute(task, options = {}) {
  const cwd = options.cwd || process.cwd();
  const matches = ROUTES.filter((route) => route.pattern.test(task));
  const defaultMode = /сделай|сделать|do it|make it/i.test(task)
    ? "feature"
    : "review";
  const selected =
    matches.length > 0
      ? matches
      : [ROUTES.find((route) => route.mode === defaultMode)];
  const artifacts = detectArtifacts(cwd);
  const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const risk = selected.reduce(
    (current, route) =>
      riskOrder[route.risk] > riskOrder[current] ? route.risk : current,
    "LOW",
  );
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
    skills: unique(selected.flatMap((route) => route.skills || [])),
    subagents: unique(selected.flatMap((route) => route.subagents || [])),
    sharedRules: unique(
      ruleGroups.flatMap((group) => SHARED_RULES[group] || []),
    ),
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
