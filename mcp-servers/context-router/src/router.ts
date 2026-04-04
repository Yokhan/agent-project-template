import type { Route, RouteResult } from './types.js';

const ROUTES: Record<string, Route> = {
  code: {
    keywords: /implement|build|create|add|fix|bug|refactor|feature|module|function|class|api|endpoint|service|migrate/i,
    files: [
      'process/research-first.md', 'process/plan-first.md', 'process/self-verification.md',
      'technical/architecture.md', 'technical/code-style.md', 'technical/error-handling.md',
      'technical/atomic-reuse.md'
    ],
    agent: 'implementer'
  },
  test: {
    keywords: /test|coverage|tdd|spec|assert|mock|jest|pytest|vitest/i,
    files: ['technical/testing.md', 'process/self-verification.md'],
    agent: 'test-engineer'
  },
  design: {
    keywords: /design|figma|ui|ux|css|style|layout|component|token|color|font|responsive|screen|tailwind/i,
    files: ['domain/domain-design-pipeline.md', 'meta/analysis.md', 'technical/atomic-reuse.md'],
    agent: 'implementer'
  },
  review: {
    keywords: /review|audit|check|analyze|report|status|inspect|evaluate/i,
    files: ['meta/analysis.md', 'meta/critical-thinking.md', 'process/self-verification.md'],
    agent: 'reviewer'
  },
  write: {
    keywords: /write|article|post|copy|text|content|landing|marketing|email|newsletter/i,
    files: ['technical/writing.md', 'domain/domain-guards.md'],
    agent: 'writer'
  },
  git: {
    keywords: /commit|push|pr|pull.request|merge|branch|release|deploy|tag/i,
    files: ['technical/git-workflow.md'],
    agent: 'implementer'
  },
  plan: {
    keywords: /plan|strategy|architect|roadmap|estimate|decompose|breakdown/i,
    files: ['meta/strategic-thinking.md', 'process/plan-first.md', 'conflict/conflict-resolution.md'],
    agent: 'researcher'
  },
  safety: {
    keywords: /health|fitness|medical|nutrition|exercise|science|evidence|study/i,
    files: ['domain/domain-guards.md', 'meta/critical-thinking.md'],
    agent: 'researcher'
  },
  refactor: {
    keywords: /refactor|simplif|clean.?up|extract|split|reorganize/i,
    files: ['technical/architecture.md', 'technical/code-style.md', 'process/self-verification.md', 'technical/testing.md'],
    agent: 'simplifier'
  }
};

const CORE_FILES = ['process/context-first.md'];

export function routeKeywords(keywords: string): RouteResult {
  const matchedModes: string[] = [];
  const matchedFiles = new Set<string>(CORE_FILES);
  let primaryAgent = 'implementer';
  let agentSet = false;

  for (const [mode, route] of Object.entries(ROUTES)) {
    if (route.keywords.test(keywords)) {
      matchedModes.push(mode);
      for (const file of route.files) {
        matchedFiles.add(file);
      }
      if (!agentSet) {
        primaryAgent = route.agent;
        agentSet = true;
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
    agent: primaryAgent,
    files: Array.from(matchedFiles)
  };
}

export function getLibraryMap(): string {
  const lines: string[] = ['# Rule Library Map\n'];
  for (const [mode, route] of Object.entries(ROUTES)) {
    lines.push(`## ${mode}`);
    lines.push(`Keywords: ${route.keywords.source}`);
    lines.push(`Agent: ${route.agent}`);
    lines.push(`Files: ${route.files.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
