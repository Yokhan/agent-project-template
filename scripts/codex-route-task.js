#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  getIntentMatch,
  shouldSuppressRoute,
} = require("./lib/codex-route-intents.js");
const { classifyWritingIntent } = require("./lib/writing-intent.js");
const { getWritingRoutePolicy } = require("./lib/writing-route-policy.js");
const {
  formatAgentProfiles,
  getFanoutDecision,
} = require("./codex-agent-policy.js");
const STATE_PATH = path.join("tasks", ".active-codex-route.json");
const { ROUTES, SHARED_RULES } = require("./codex-route-config.js");
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
  const productModes = new Set(["product-goal", "product-ux", "design-system", "marketing", "template", "release", "strategy", "lessons"]);
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

const WRITING_NOISE_MODES = new Set([
  "api",
  "design",
  "design-system",
  "feature",
  "marketing",
  "mermaid",
  "openai",
  "release",
  "review",
  "product-ux",
  "writing-communication",
  "writing-informational",
  "writing-literary",
  "technical-writing",
]);

function getRouteByMode(mode) {
  return ROUTES.find((route) => route.mode === mode);
}

function createWritingMatch(mode, policy, rawMatches, isPrimary) {
  const base = getRouteByMode(mode);
  const original = rawMatches.find((match) => match.route.mode === mode);
  return {
    exact: Boolean(original?.exact),
    intent: original?.intent || { isMatch: true, score: 1, threshold: 1 },
    route: {
      ...base,
      pipeline: policy.pipeline,
      risk: policy.risk,
      skills: isPrimary ? policy.skills : [],
      subagents: isPrimary ? policy.subagents : [],
      rules: isPrimary ? unique([...(base.rules || []), ...policy.rules]) : [],
      gates: isPrimary ? unique([...(base.gates || []), ...policy.gates]) : [],
      writingProfiles: isPrimary ? policy.profiles : [],
      writingLanguageProfiles: isPrimary ? policy.languageProfiles : [],
      writingProcessProfiles: isPrimary ? policy.processProfiles : [],
      writingDomainProfiles: isPrimary ? policy.domainProfiles : [],
      writingTechnicalProfiles: isPrimary ? policy.technicalProfiles : [],
      writingEditors: isPrimary ? policy.editors : [],
      writingExternalTools: isPrimary ? policy.externalTools : [],
      writingRejectedProfiles: isPrimary ? policy.rejectedProfiles : [],
    },
  };
}

function applyWritingIntent(task, rawMatches) {
  const intent = classifyWritingIntent(task);
  if (!intent.isWriting) return rawMatches;
  const policy = getWritingRoutePolicy(intent);
  const preserved = rawMatches.filter(
    (match) => !WRITING_NOISE_MODES.has(match.route.mode),
  );
  const modes = [policy.mode, ...policy.extraModes];
  const writingMatches = modes.map((mode, index) =>
    createWritingMatch(mode, policy, rawMatches, index === 0));
  return [...writingMatches, ...preserved];
}

function getMatchedRoutes(task) {
  const rawMatches = ROUTES.map((route) => {
    const exact = route.pattern.test(task);
    const intent = getIntentMatch(route.mode, task);
    return { exact, intent, route };
  }).filter((match) =>
    (match.exact || match.intent.isMatch) &&
    !shouldSuppressRoute(match.route.mode, task),
  );
  return applyWritingIntent(task, rawMatches);
}
function getRoute(task, options = {}) {
  const cwd = options.cwd || process.cwd();
  const writingIntent = classifyWritingIntent(task);
  const writingPolicy = getWritingRoutePolicy(writingIntent);
  const matches = getMatchedRoutes(task);
  const defaultMode = /сделай|сделать|do it|make it/i.test(task)
    ? "feature"
    : "review";
  const selectedMatches = matches.length > 0
    ? matches
    : [{ exact: false, intent: { isMatch: false, score: 0, threshold: 0 }, route: ROUTES.find((route) => route.mode === defaultMode) }];
  const selected = selectedMatches.map((match) => match.route);
  const semanticMatches = unique(
    selectedMatches
      .filter((match) => !match.exact && match.intent.isMatch)
      .map((match) => match.route.mode),
  );
  const exactMatches = unique(
    selectedMatches
      .filter((match) => match.exact)
      .map((match) => match.route.mode),
  );
  const artifacts = detectArtifacts(cwd);
  const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const risk = selected.reduce(
    (current, route) =>
      riskOrder[route.risk] > riskOrder[current] ? route.risk : current,
    "LOW",
  );
  const shouldUseStrategicReview = needsStrategicReview(selected, risk, artifacts);
  const shouldUseProductGoal = needsProductGoal(selected, risk);
  const fanout = getFanoutDecision({
    task,
    risk,
    modes: selected.map((route) => route.mode),
    candidates: unique(selected.flatMap((route) => route.subagents || [])),
  });
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
    subagents: fanout.candidates.map(({ name }) => name),
    fanout,
    sharedRules: unique(
      ruleGroups.flatMap((group) => SHARED_RULES[group] || []),
    ),
    planContract: getPlanContract(selected, risk),
    productionBar: getProductionBar(selected),
    languagePolicy: "plans-audits-status-and-final-reports-match-user-request-language",
    matchPolicy: "exact-patterns-plus-semantic-intent-scoring",
    writingIntent,
    writingPolicy,
    exactMatches,
    semanticMatches,
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
    `MATCHES: exact=${route.exactMatches.join("+") || "none"} | semantic=${route.semanticMatches.join("+") || "none"}`,
    `SKILLS: ${route.skills.join(", ")}`,
    `SUBAGENTS: ${route.subagents.join(", ") || "none"}`,
    `FANOUT: ${route.fanout.status} | ${route.fanout.reason} | max_children=${route.fanout.maxChildren}`,
    `PROFILES: ${formatAgentProfiles(route.fanout.candidates).join(", ") || "none"}`,
    `ORCHESTRATOR: ${route.orchestrator.owner} (${route.orchestrator.codexRole})`,
    `PLAN: ${route.planContract.required ? "required" : "optional"} | ${route.planContract.language}`,
    `PRODUCT_BAR: ${route.productionBar.default} | outcome=${route.productionBar.outcomePriority} | no_mvp=${route.productionBar.noMvpByDefault}`,
    `GATES: ${route.qualityGates.join(", ")}`,
    `RULES: ${route.sharedRules.join(", ")}`,
    ...(route.writingPolicy ? [
      `WRITING_LANGUAGE: ${route.writingPolicy.targetLanguage}`,
      `WRITING_LANGUAGE_RESOLUTION: ${route.writingPolicy.languageResolution}`,
      `WRITING_LANGUAGE_PROFILES: ${route.writingPolicy.languageProfiles.join(", ") || "none"}`,
      `WRITING_PROCESS_PROFILES: ${route.writingPolicy.processProfiles.join(", ") || "none"}`,
      `WRITING_DOMAIN_PROFILES: ${route.writingPolicy.domainProfiles.join(", ") || "none"}`,
      `WRITING_TECHNICAL_PROFILES: ${route.writingPolicy.technicalProfiles.join(", ") || "none"}`,
      `WRITING_REJECTED: ${route.writingPolicy.rejectedProfiles.map(({ id, reason }) => `${id}:${reason}`).join(", ") || "none"}`,
      `WRITING_EXTERNAL_TOOLS: ${route.writingPolicy.externalTools.map(({ id, access, execution, paid }) => `${id}:${access}:${execution}:${paid ? "paid" : "free"}`).join(", ") || "none"}`,
      `WRITING_EDITORS: ${route.writingPolicy.editors.join(", ") || "none"}`,
      `WRITING_GATES: ${route.writingPolicy.gates.join(", ") || "none"}`,
    ] : []),
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
