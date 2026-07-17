import type { Route, RouteResult } from "./types.js";
import { createRequire } from "node:module";
type WritingIntent = {
  isWriting: boolean;
  action: "create" | "edit" | "plan" | "review" | null;
  primaryMode: "literary" | "marketing" | "informational" | "communication" | null;
  overlays: string[];
  specializations: string[];
  domains: string[];
  vendors: string[];
  externalTools: string[];
  outputLanguage: string | null;
  languageResolution: "explicit" | "inferred" | null;
};

type WritingRoutePolicy = {
  mode: string;
  extraModes: string[];
  pipeline: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  agent: string;
  skills: string[];
  subagents: string[];
  files: string[];
  targetLanguage: string;
  languageResolution: string;
  languageProfiles: string[];
  processProfiles: string[];
  domainProfiles: string[];
  technicalProfiles: string[];
  profiles: string[];
  editors: string[];
  gates: string[];
  externalTools: Array<{ id: string; access: string; execution: string; paid: boolean }>;
  rejectedProfiles: Array<{ id: string; reason: string }>;
  needsFreshDocs: boolean;
};

const require = createRequire(import.meta.url);
const { classifyWritingIntent } = require("../../../scripts/lib/writing-intent.js") as {
  classifyWritingIntent(task: string): WritingIntent;
};
const { getWritingRoutePolicy } = require("../../../scripts/lib/writing-route-policy.js") as {
  getWritingRoutePolicy(intent: WritingIntent): WritingRoutePolicy | null;
};

const ROUTES: Record<string, Route> = {
  code: {
    keywords:
      /implement|build|create|add|fix|bug|refactor|feature|module|function|class|api|endpoint|service|migrate|настрой|создай|добавь|исправь|починь|реализуй|сделай|баг|ошибка|сломал|не работает|падает/i,
    files: [
      "process/research-first.md",
      "process/plan-first.md",
      "process/self-verification.md",
      "process/risk-classification.md",
      "technical/architecture.md",
      "technical/code-style.md",
      "technical/error-handling.md",
      "technical/atomic-reuse.md",
    ],
    agent: "implementer",
    codexSkills: ["codex-feature-workflow", "codex-pipeline-workflow"],
    codexSubagents: ["pr_explorer", "tester", "reviewer"],
    pipeline: "feature",
    risk: "MEDIUM",
  },
  test: {
    keywords: /test|coverage|tdd|spec|assert|mock|jest|pytest|vitest|тест/i,
    files: ["technical/testing.md", "process/self-verification.md"],
    agent: "test-engineer",
    codexSkills: ["codex-coverage"],
    codexSubagents: ["tester", "reviewer"],
    pipeline: "quality gate",
    risk: "MEDIUM",
  },
  design: {
    keywords:
      /design|figma|\bui\b|\bux\b|\bcss\b|style|layout|component|token|color|font|responsive|screen|tailwind|дизайн|макет|фигма|экран|интерфейс|стиль/i,
    files: [
      "domain/domain-design-pipeline.md",
      "meta/analysis.md",
      "technical/atomic-reuse.md",
    ],
    agent: "implementer",
    codexSkills: ["codex-design-workflow", "codex-domain-design-review"],
    codexSubagents: ["design_reviewer", "tester", "reviewer"],
    pipeline: "design",
    risk: "MEDIUM",
  },
  review: {
    keywords:
      /review|audit|check|analyze|report|status|inspect|evaluate|посмотри|проверь|оцени|разбери|покажи/i,
    files: [
      "meta/analysis.md",
      "meta/critical-thinking.md",
      "process/self-verification.md",
    ],
    agent: "reviewer",
    codexSkills: ["codex-audit"],
    codexSubagents: ["pr_explorer", "reviewer", "tester"],
    pipeline: "review",
    risk: "MEDIUM",
  },
  write: {
    keywords:
      /write|article|post|copy|text|content|landing|marketing|email|newsletter|напиши|текст|статья|пост|контент/i,
    files: ["technical/writing.md", "domain/domain-guards.md"],
    agent: "writer",
    codexSkills: ["codex-writing-workflow"],
    codexSubagents: ["reviewer"],
    pipeline: "documentation",
    risk: "LOW",
  },
  git: {
    keywords: /commit|push|\bpr\b|pull.request|merge|branch|release|deploy|tag/i,
    files: ["technical/git-workflow.md"],
    agent: "implementer",
    codexSkills: ["codex-health-check"],
    codexSubagents: ["tester", "reviewer"],
    pipeline: "release",
    risk: "HIGH",
  },
  plan: {
    keywords:
      /plan|strategy|architect|roadmap|estimate|decompose|breakdown|brainstorm|risk|спланируй|декомпозируй|разбей|архитектур|мозговой.?штурм|риск/i,
    files: [
      "meta/strategic-thinking.md",
      "process/plan-first.md",
      "process/brainstorm.md",
      "process/risk-classification.md",
      "conflict/conflict-resolution.md",
    ],
    agent: "researcher",
    codexSkills: ["codex-strategic-review", "codex-decompose"],
    codexSubagents: ["pr_explorer", "reviewer"],
    pipeline: "planning",
    risk: "MEDIUM",
  },
  safety: {
    keywords:
      /health|fitness|medical|nutrition|exercise|science|evidence|study|здоровье|фитнес|тренировк|питание|наук/i,
    files: ["domain/domain-guards.md", "meta/critical-thinking.md"],
    agent: "researcher",
    codexSkills: ["codex-domain-health-review", "codex-domain-science-review"],
    codexSubagents: ["docs_researcher", "reviewer"],
    pipeline: "evidence review",
    risk: "HIGH",
    needsFreshDocs: true,
  },
  refactor: {
    keywords:
      /refactor|simplif|clean.?up|extract|split|reorganize|рефактор|упрости|вынеси|раздели/i,
    files: [
      "technical/architecture.md",
      "technical/code-style.md",
      "process/self-verification.md",
      "technical/testing.md",
    ],
    agent: "simplifier",
    codexSkills: ["codex-feature-workflow", "codex-domain-software-review"],
    codexSubagents: ["pr_explorer", "tester", "reviewer"],
    pipeline: "refactor",
    risk: "MEDIUM",
  },
  research: {
    keywords:
      /research|investigate|explore|understand|analyze|deep.?dive|study|ресёрч|исследуй|изуч|разбер|анализ/i,
    files: [
      "meta/analysis.md",
      "meta/strategic-thinking.md",
      "process/research-first.md",
    ],
    agent: "researcher",
    codexSkills: ["codex-audit"],
    codexSubagents: ["pr_explorer", "docs_researcher"],
    pipeline: "research",
    risk: "LOW",
  },
  audit: {
    keywords:
      /audit|security|vulnerab|penetr|pentest|cve|xss|inject|owasp|аудит|безопасн|уязвим/i,
    files: [
      "process/self-verification.md",
      "domain/domain-guards.md",
      "meta/critical-thinking.md",
    ],
    agent: "security-auditor",
    codexSkills: ["codex-security-audit"],
    codexSubagents: ["security_reviewer", "pr_explorer", "tester"],
    pipeline: "security patch",
    risk: "HIGH",
  },
  docs: {
    keywords:
      /document|readme|changelog|api.?doc|jsdoc|typedoc|swagger|документ|задокумент/i,
    files: ["process/context-first.md", "technical/writing.md"],
    agent: "documenter",
    codexSkills: ["codex-writing-workflow"],
    codexSubagents: ["reviewer"],
    pipeline: "documentation",
    risk: "LOW",
  },
  template: {
    keywords:
      /template|agents\.md|claude\.md|skill|subagent|router|route|sync-template|agent.project|шаблон|агент|скилл|роут|маршрут|синхрон/i,
    files: [
      "process/context-first.md",
      "meta/critical-thinking.md",
      "technical/testing.md",
      "technical/git-workflow.md",
    ],
    agent: "reviewer",
    codexSkills: [
      "codex-template-sync",
      "codex-skill-maintenance",
      "codex-test-rules",
      "codex-agent-router",
    ],
    codexSubagents: ["pr_explorer", "tester", "reviewer"],
    pipeline: "template maintenance",
    risk: "HIGH",
  },
  openai: {
    keywords:
      /openai|gpt|responses.api|опенаи|gpt-?5/i,
    files: ["meta/critical-thinking.md", "process/self-verification.md"],
    agent: "researcher",
    codexSkills: ["codex-openai-model-guidance"],
    codexSubagents: ["docs_researcher", "reviewer"],
    pipeline: "docs research",
    risk: "MEDIUM",
    needsFreshDocs: true,
  },
  mermaid: {
    keywords:
      /mermaid|diagram|flowchart|control.board|architecture.map|диаграм|схем|борд|карта/i,
    files: ["technical/writing.md", "meta/analysis.md"],
    agent: "documenter",
    codexSkills: ["codex-mermaid-board-workflow"],
    codexSubagents: ["reviewer"],
    pipeline: "documentation",
    risk: "LOW",
  },
};

const CORE_FILES = ["process/context-first.md"];

// Agent priority: review > test > write > security > profiler > documenter > simplifier > implementer
const AGENT_PRIORITY: Record<string, number> = {
  reviewer: 10,
  "test-engineer": 9,
  writer: 8,
  "technical-writer": 8,
  "security-auditor": 7,
  profiler: 6,
  documenter: 5,
  simplifier: 4,
  researcher: 3,
  implementer: 1,
};

export function routeKeywords(keywords: string): RouteResult {
  const writingIntent = classifyWritingIntent(keywords);
  const writingPolicy = getWritingRoutePolicy(writingIntent);
  const matchedModes: string[] = [];
  const matchedFiles = new Set<string>(CORE_FILES);
  const codexSkills = new Set<string>();
  const codexSubagents = new Set<string>();
  let bestAgent = "implementer";
  let bestPriority = 0;
  let pipeline = "general";
  let risk: RouteResult["risk"] = "LOW";
  let needsFreshDocs = false;
  const riskPriority: Record<RouteResult["risk"], number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  if (writingPolicy) {
    matchedModes.push(writingPolicy.mode, ...writingPolicy.extraModes);
    writingPolicy.files.forEach((file) => matchedFiles.add(file));
    writingPolicy.skills.forEach((skill) => codexSkills.add(skill));
    writingPolicy.subagents.forEach((subagent) => codexSubagents.add(subagent));
    pipeline = writingPolicy.pipeline;
    risk = writingPolicy.risk;
    needsFreshDocs = writingPolicy.needsFreshDocs;
    bestAgent = writingPolicy.agent;
    bestPriority = AGENT_PRIORITY[bestAgent] ?? 0;
  }

  for (const [mode, route] of Object.entries(ROUTES)) {
    if (
      writingIntent.isWriting &&
      new Set(["code", "design", "docs", "git", "review", "write"]).has(mode)
    ) {
      continue;
    }
    if (route.keywords.test(keywords)) {
      matchedModes.push(mode);
      for (const file of route.files) {
        matchedFiles.add(file);
      }
      for (const skill of route.codexSkills) {
        codexSkills.add(skill);
      }
      for (const subagent of route.codexSubagents) {
        codexSubagents.add(subagent);
      }
      if (pipeline === "general") {
        pipeline = route.pipeline;
      }
      if (riskPriority[route.risk] > riskPriority[risk]) {
        risk = route.risk;
      }
      needsFreshDocs = needsFreshDocs || Boolean(route.needsFreshDocs);
      // Pick highest-priority agent (not first-match)
      const priority = AGENT_PRIORITY[route.agent] ?? 0;
      if (priority > bestPriority) {
        bestAgent = route.agent;
        bestPriority = priority;
      }
    }
  }

  // Default if nothing matched
  if (matchedModes.length === 0) {
    matchedModes.push("general");
    matchedFiles.add("process/research-first.md");
    matchedFiles.add("process/self-verification.md");
    matchedFiles.add("technical/architecture.md");
    codexSkills.add("codex-audit");
    codexSubagents.add("reviewer");
    pipeline = "review";
    risk = "MEDIUM";
  }

  return {
    modes: Array.from(new Set(matchedModes)),
    agent: bestAgent,
    files: Array.from(matchedFiles),
    codexSkills: Array.from(codexSkills),
    codexSubagents: Array.from(codexSubagents),
    pipeline,
    risk,
    needsFreshDocs,
    targetLanguage: writingPolicy?.targetLanguage ?? null,
    languageResolution: writingPolicy?.languageResolution ?? null,
    writingProfiles: writingPolicy?.profiles ?? [],
    writingLanguageProfiles: writingPolicy?.languageProfiles ?? [],
    writingProcessProfiles: writingPolicy?.processProfiles ?? [],
    writingDomainProfiles: writingPolicy?.domainProfiles ?? [],
    writingTechnicalProfiles: writingPolicy?.technicalProfiles ?? [],
    writingEditors: writingPolicy?.editors ?? [],
    writingGates: writingPolicy?.gates ?? [],
    writingExternalTools: writingPolicy?.externalTools ?? [],
    writingRejectedProfiles: writingPolicy?.rejectedProfiles ?? [],
  };
}

export function getLibraryMap(): string {
  const lines: string[] = ["# Rule Library Map\n"];
  for (const [mode, route] of Object.entries(ROUTES)) {
    lines.push(`## ${mode}`);
    lines.push(`Agent: ${route.agent}`);
    lines.push(`Codex skills: ${route.codexSkills.join(", ")}`);
    lines.push(`Codex subagents: ${route.codexSubagents.join(", ")}`);
    lines.push(`Pipeline: ${route.pipeline}`);
    lines.push(`Risk: ${route.risk}`);
    lines.push(`Files: ${route.files.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
