import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'path';
import { existsSync } from 'fs';
import { routeKeywords, getLibraryMap } from './router.js';
import { loadRules, getProjectContext } from './context.js';
import { getState, updateState, restoreState } from './state.js';

const server = new McpServer({
  name: 'context-router',
  version: '1.0.0',
});

// --- Tool: get_context ---
server.tool(
  'get_context',
  'Route task to relevant rules and return full context. Call this on EVERY new task.',
  {
    keywords: z.string().max(500).describe('English keywords extracted from user message, e.g. "fix auth login bug"'),
    include_rules: z.boolean().optional().default(true).describe('Include rule text in response'),
    include_lessons: z.boolean().optional().default(true).describe('Grep lessons for keywords'),
    include_git: z.boolean().optional().default(true).describe('Include recent git log'),
    include_research: z.boolean().optional().default(true).describe('Include research cache'),
  },
  async ({ keywords, include_rules, include_lessons, include_git, include_research }) => {
    const route = routeKeywords(keywords);
    const { text: rulesText, lines: rulesLines } = include_rules
      ? await loadRules(route.files)
      : { text: '', lines: 0 };

    const context = await getProjectContext(
      include_lessons || include_git || include_research ? keywords : ''
    );

    updateState(route.modes, route.files, keywords);

    const sections: string[] = [];

    sections.push(`MODE: ${route.modes.join('+')}`);
    sections.push(`AGENT: ${route.agent}`);
    sections.push(`RULES: ${route.files.length} files, ${rulesLines} lines`);
    sections.push('');

    if (include_rules && rulesText) {
      sections.push('=== RULES ===');
      sections.push(rulesText);
      sections.push('');
    }

    if (include_lessons && context.lessons) {
      sections.push('=== RELEVANT LESSONS ===');
      sections.push(context.lessons);
      sections.push('');
    }

    if (include_git && context.gitLog) {
      sections.push('=== RECENT GIT ===');
      sections.push(context.gitLog);
      sections.push('');
    }

    if (context.currentTask) {
      sections.push('=== CURRENT TASK ===');
      sections.push(context.currentTask);
      sections.push('');
    }

    if (include_research && context.research) {
      sections.push('=== RESEARCH CACHE ===');
      sections.push(context.research);
    }

    return {
      content: [{ type: 'text' as const, text: sections.join('\n') }]
    };
  }
);

// --- Tool: switch_context ---
server.tool(
  'switch_context',
  'Switch to a different task context mid-conversation. Reports what changed.',
  {
    keywords: z.string().describe('New task keywords'),
  },
  async ({ keywords }) => {
    const previousState = getState();
    const previousMode = previousState.currentModes.join('+') || 'none';

    const route = routeKeywords(keywords);
    const { text: rulesText, lines: rulesLines } = await loadRules(route.files);
    const context = await getProjectContext(keywords);

    const previousRules = new Set(previousState.activeRules);
    const newRules = new Set(route.files);
    const added = route.files.filter(f => !previousRules.has(f));
    const dropped = previousState.activeRules.filter(f => !newRules.has(f));

    updateState(route.modes, route.files, keywords);

    const sections: string[] = [];
    sections.push(`SWITCHED: ${previousMode} → ${route.modes.join('+')}`);
    sections.push(`AGENT: ${route.agent}`);
    sections.push(`RULES: ${route.files.length} files, ${rulesLines} lines (+${added.length} new, -${dropped.length} dropped)`);
    sections.push('');
    sections.push('=== RULES ===');
    sections.push(rulesText);

    if (context.lessons) {
      sections.push('');
      sections.push('=== RELEVANT LESSONS ===');
      sections.push(context.lessons);
    }

    if (context.currentTask) {
      sections.push('');
      sections.push('=== CURRENT TASK ===');
      sections.push(context.currentTask);
    }

    return {
      content: [{ type: 'text' as const, text: sections.join('\n') }]
    };
  }
);

// --- Tool: get_active_rules ---
server.tool(
  'get_active_rules',
  'Get current active rules state. Use after compaction to restore context.',
  {},
  async () => {
    let state = getState();
    if (!state.lastRouteTime) {
      const restored = await restoreState();
      if (restored) state = restored;
    }

    if (!state.lastRouteTime) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No active rules. Run get_context(keywords="...") to route a task first.'
        }]
      };
    }

    const lines = [
      `MODE: ${state.currentModes.join('+')}`,
      `TASK: ${state.taskDescription}`,
      `ROUTED AT: ${state.lastRouteTime}`,
      `RULES (${state.activeRules.length} files):`,
      ...state.activeRules.map(f => `  .claude/library/${f}`)
    ];

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }]
    };
  }
);

// --- Resource: library-map ---
server.resource(
  'library-map',
  'context://library-map',
  { description: 'Map of all available rules with keywords and file paths' },
  async () => ({
    contents: [{ uri: 'context://library-map', mimeType: 'text/markdown', text: getLibraryMap() }]
  })
);

// --- Resource: current-state ---
server.resource(
  'current-state',
  'context://current-state',
  { description: 'Current routing state: mode, active rules, last route time' },
  async () => {
    const state = getState();
    const text = JSON.stringify(state, null, 2);
    return {
      contents: [{ uri: 'context://current-state', mimeType: 'application/json', text }]
    };
  }
);

// --- Start ---
async function main() {
  // Pre-flight checks
  const libraryPath = join(process.cwd(), '.claude', 'library');
  if (!existsSync(libraryPath)) {
    console.error(`WARNING: ${libraryPath} not found. Rules won't load.`);
  }

  // Try to restore state from disk on startup
  await restoreState();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
