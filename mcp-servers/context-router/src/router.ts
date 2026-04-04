import type { Route, RouteResult } from './types.js';

const ROUTES: Record<string, Route> = {
  code: {
    keywords: /implement|build|create|add|fix|bug|refactor|feature|module|function|class|api|endpoint|service|migrate|настрой|создай|добавь|исправь|починь|реализуй|сделай|баг|ошибка|сломал|не работает|падает/i,
    files: [
      'process/research-first.md', 'process/plan-first.md', 'process/self-verification.md',
      'technical/architecture.md', 'technical/code-style.md', 'technical/error-handling.md',
      'technical/atomic-reuse.md'
    ],
    agent: 'implementer'
  },
  test: {
    keywords: /test|coverage|tdd|spec|assert|mock|jest|pytest|vitest|тест/i,
    files: ['technical/testing.md', 'process/self-verification.md'],
    agent: 'test-engineer'
  },
  design: {
    keywords: /design|figma|ui|ux|css|style|layout|component|token|color|font|responsive|screen|tailwind|дизайн|макет|фигма|экран|интерфейс|стиль/i,
    files: ['domain/domain-design-pipeline.md', 'meta/analysis.md', 'technical/atomic-reuse.md'],
    agent: 'implementer'
  },
  review: {
    keywords: /review|audit|check|analyze|report|status|inspect|evaluate|посмотри|проверь|оцени|разбери|покажи/i,
    files: ['meta/analysis.md', 'meta/critical-thinking.md', 'process/self-verification.md'],
    agent: 'reviewer'
  },
  write: {
    keywords: /write|article|post|copy|text|content|landing|marketing|email|newsletter|напиши|текст|статья|пост|контент/i,
    files: ['technical/writing.md', 'domain/domain-guards.md'],
    agent: 'writer'
  },
  git: {
    keywords: /commit|push|pr|pull.request|merge|branch|release|deploy|tag/i,
    files: ['technical/git-workflow.md'],
    agent: 'implementer'
  },
  plan: {
    keywords: /plan|strategy|architect|roadmap|estimate|decompose|breakdown|спланируй|декомпозируй|разбей|архитектур/i,
    files: ['meta/strategic-thinking.md', 'process/plan-first.md', 'conflict/conflict-resolution.md'],
    agent: 'researcher'
  },
  safety: {
    keywords: /health|fitness|medical|nutrition|exercise|science|evidence|study|здоровье|фитнес|тренировк|питание|наук/i,
    files: ['domain/domain-guards.md', 'meta/critical-thinking.md'],
    agent: 'researcher'
  },
  refactor: {
    keywords: /refactor|simplif|clean.?up|extract|split|reorganize|рефактор|упрости|вынеси|раздели/i,
    files: ['technical/architecture.md', 'technical/code-style.md', 'process/self-verification.md', 'technical/testing.md'],
    agent: 'simplifier'
  },
  research: {
    keywords: /research|investigate|explore|understand|analyze|deep.?dive|study|ресёрч|исследуй|изуч|разбер|анализ/i,
    files: ['meta/analysis.md', 'meta/strategic-thinking.md', 'process/research-first.md'],
    agent: 'researcher'
  },
  audit: {
    keywords: /audit|security|vulnerab|penetr|pentest|cve|xss|inject|owasp|аудит|безопасн|уязвим/i,
    files: ['process/self-verification.md', 'domain/domain-guards.md', 'meta/critical-thinking.md'],
    agent: 'security-auditor'
  },
  docs: {
    keywords: /document|readme|changelog|api.?doc|jsdoc|typedoc|swagger|документ|задокумент/i,
    files: ['process/context-first.md', 'technical/writing.md'],
    agent: 'documenter'
  }
};

const CORE_FILES = ['process/context-first.md'];

// Agent priority: review > test > write > security > profiler > documenter > simplifier > implementer
const AGENT_PRIORITY: Record<string, number> = {
  reviewer: 10, 'test-engineer': 9, writer: 8, 'security-auditor': 7,
  profiler: 6, documenter: 5, simplifier: 4, researcher: 3, implementer: 1
};

export function routeKeywords(keywords: string): RouteResult {
  const matchedModes: string[] = [];
  const matchedFiles = new Set<string>(CORE_FILES);
  let bestAgent = 'implementer';
  let bestPriority = 0;

  for (const [mode, route] of Object.entries(ROUTES)) {
    if (route.keywords.test(keywords)) {
      matchedModes.push(mode);
      for (const file of route.files) {
        matchedFiles.add(file);
      }
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
    matchedModes.push('general');
    matchedFiles.add('process/research-first.md');
    matchedFiles.add('process/self-verification.md');
    matchedFiles.add('technical/architecture.md');
  }

  return {
    modes: matchedModes,
    agent: bestAgent,
    files: Array.from(matchedFiles)
  };
}

export function getLibraryMap(): string {
  const lines: string[] = ['# Rule Library Map\n'];
  for (const [mode, route] of Object.entries(ROUTES)) {
    lines.push(`## ${mode}`);
    lines.push(`Agent: ${route.agent}`);
    lines.push(`Files: ${route.files.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
