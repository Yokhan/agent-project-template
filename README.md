# Agent Project Template v2

[![Template Version](https://img.shields.io/badge/template-v2.4.0-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

Self-deploying AI-agent optimized project template with persistent memory, autonomous work loops, self-improvement, and production-proven hooks.

## Quick Start

1. **Run `setup.bat` (Windows) or `./setup.sh` (Linux/macOS)** — enter project name → full agent-ready structure created
2. **Open the project** in Claude Code or Zed
3. **Tell Claude:** "Set up my project" or run `/setup-project`
4. Claude configures everything for your stack automatically

## Updating Existing Projects

When the template improves (new rules, agents, skills, hooks), update your project:

```bash
# Preview changes (no modifications)
bash scripts/sync-template.sh /path/to/agent-project-template --dry-run

# Apply updates
bash scripts/sync-template.sh /path/to/agent-project-template
```

Or use the Claude Code command: `/update-template /path/to/template`

### Automatic updates (git-based)
If the template is hosted in a git repository, projects automatically track it:
```bash
# Check for updates (no changes made)
bash scripts/sync-template.sh --from-git --dry-run

# Apply updates
bash scripts/sync-template.sh --from-git
```
Projects created from a git-hosted template automatically have a `template` remote configured. The SessionStart hook reminds you when updates haven't been checked in 7+ days.

### Updating older projects (created before v2.2.0)
```bash
# 1. Copy sync script into your project
cp /path/to/agent-project-template/scripts/sync-template.sh my-project/scripts/

# 2. Bootstrap — generates .template-manifest.json from current state
cd my-project
bash scripts/sync-template.sh /path/to/agent-project-template --bootstrap

# 3. Sync — applies template updates
bash scripts/sync-template.sh /path/to/agent-project-template

# Optional: add git remote for future auto-updates
git remote add template https://github.com/Yokhan/agent-project-template.git
bash scripts/sync-template.sh --from-git
```

**What gets updated**: Template infrastructure (.claude/rules, agents, skills, commands, settings.json, scripts)
**What's preserved**: Your code (src/), docs, brain/, tasks/, CLAUDE.md, and all `project-*` files
**Convention**: Template files are read-only baseline. Project customizations go to `project-*` prefixed files (e.g., `rules/project-no-mock-db.md`).

## Extending the Template for Your Domain

The template is a **baseline**. Every project adds domain-specific infrastructure on top.

### Convention: `project-*` prefix

All project-specific files use the `project-` prefix. Template sync **never touches** these files.

| Type | Template (synced) | Project (preserved) |
|------|-------------------|---------------------|
| Rules | `rules/architecture.md` | `rules/project-kiro-system.md` |
| Commands | `commands/implement.md` | `commands/project-00-research.md` |
| Skills | `skills/debug/SKILL.md` | `skills/project-kiro-drafting/SKILL.md` |
| Agents | `agents/reviewer.md` | `agents/project-kiro-writer.md` |
| Hooks | `settings.json` (template) | `settings.local.json` (project) |

### Adding project hooks

Put project-specific hooks in `.claude/settings.local.json` (not `settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit",
      "hooks": [{"type": "command", "command": "bash core/scripts/validate.sh", "timeout": 10}]
    }]
  }
}
```
Claude Code merges both files. Project hooks run alongside template hooks.

### Adding a domain pipeline

For complex domain workflows (literary production, game design, data science):

1. **Domain rules** → `.claude/rules/project-[domain]-*.md` (enforcement, methodology)
2. **Domain commands** → `.claude/commands/project-[phase]-*.md` (pipeline steps)
3. **Domain skills** → `.claude/skills/project-[domain]-*/SKILL.md` (specialist knowledge)
4. **Domain agents** → `.claude/agents/project-[domain]-*.md` (sub-agents)
5. **Domain scripts** → `core/scripts/` (validators, generators — NOT in template's `scripts/`)
6. **Domain docs** → `core/docs/` (methodology, reference material)
7. **Domain config** → `core/config.yaml` (universal project configuration)

### Progressive disclosure for domain docs

Follow the 5-level loading pattern:
1. **Critical** (every session): `.claude/rules/project-*.md`
2. **Project** (once per project): `core/config.yaml`, status dashboard
3. **Task** (per task): relevant domain docs from `core/docs/`
4. **Methodology** (on demand): methodology files, editorial boards
5. **Reference** (deep search): cheat sheets, examples, full indices

### Template updates preserve your extensions

When you run `/update-template` or `bash scripts/sync-template.sh`:
- Template files → **updated** to latest version
- `project-*` files → **untouched**
- `settings.local.json` → **untouched**
- `core/` directory → **untouched** (not tracked by template)

## What's Included

### Out of the box (setup.bat creates these)

| Category | Count | Details |
|----------|-------|---------|
| **Rules** | 19 | 8 core (architecture, code-style, testing, git-workflow, self-improvement, conflict-resolution, error-handling, self-verification) + 8 domain guards + critical-thinking + strategic-thinking + analysis-first |
| **Hooks** | 7 hook scripts | 7 hook scripts across 5 event types (PostToolUse, PreToolUse, Stop, SessionStart, PreCompact) |
| **Skills** | 22 | 15 core (setup-project, add-feature, debug, security-audit, daily-brief, self-update, api-contract, sprint, setup-integrations, coverage, health-check, migrate, modify-api, setup-telegram, update-deps) + 6 domain review + strategic-review |
| **Agents** | 9 | reviewer, simplifier, researcher, implementer, test-engineer, security-auditor, devops |
| **Commands** | 12 | /setup-project, /implement, /commit, /review, /refactor, /sprint, /brain-sync, /weekly, /status, /rollback, /onboard, /update-template |
| **Brain** | Obsidian vault | session logs, decisions, knowledge base, note templates |
| **Memory** | tasks/ | lessons.md (self-improvement loop) + current.md (handoff) |

### After Claude setup (/setup-project)
- Project initialized for your stack (TypeScript/Python/Go/Rust/etc.)
- Formatter, linter, test framework configured
- Scaffolding templates for your stack
- Reference implementation
- Documentation filled in
- Optional: Memory MCP, Telegram, Beads, Obsidian MCP

## Architecture

Based on AI-agent spec v3.1 + patterns from 20+ production repositories:

```
Three-tier context infrastructure:

Tier 1 (Hot Memory)     — CLAUDE.md + .claude/rules/ + tasks/lessons.md    (every session)
Tier 2 (Specialists)    — .claude/skills/ + agents/                         (on demand)
Tier 3 (Cold Memory)    — docs/ + brain/                                    (by request)
```

### Key Principles
- **Sinks, not Pipes** — components complete work, no cascading side effects
- **Working Memory Cliff** — files < 250 lines, tasks < 30 changes
- **Self-Improvement Loop** — every mistake → lessons.md → promote to rules
- **Autonomous Work** — /sprint with Ralph Loop + circuit breaker
- **Change Review > Code Review** — review intent and impact, not style

## Commands

| Command | What it does |
|---------|-------------|
| `/setup-project` | Configure project for your stack |
| `/implement` | Plan → Annotate → Implement (Boris Tane workflow) |
| `/commit` | Smart commit with 11-point deploy check |
| `/review` | Change review via isolated reviewer agent |
| `/refactor` | Safe refactoring via git worktree |
| `/sprint` | Autonomous work loop with circuit breaker |
| `/brain-sync` | Sync knowledge to Obsidian vault |
| `/weekly` | Retrospective + self-improvement promotion |
| `/status` | Project health dashboard |
| `/rollback` | Safe git revert workflow |
| `/onboard` | New developer onboarding |
| `/update-template` | Sync project with newer template version |

## Obsidian Brain

The `brain/` directory is an Obsidian vault:

```
brain/
├── 00-inbox/       — raw notes from agents
├── 01-daily/       — session logs (auto-generated by hooks)
├── 02-projects/    — project context, goals, blockers
├── 03-knowledge/   — patterns, solutions, lessons learned
├── 04-decisions/   — architectural decision records
└── templates/      — note templates
```

## Optional Integrations

| Integration | What | No GPU/Docker needed |
|-------------|------|---------------------|
| **Engram** | Zero-dep Go binary memory (SQLite+FTS5) | ✅ |
| **claude-memory-mcp** | Hybrid search memory | ✅ |
| **MemCP** | 5-tier search, 20x token savings | ✅ |
| **Telegram** | Remote control from phone | ✅ |
| **Beads** | Git-native task tracker | ✅ |
| **Obsidian MCP** | Direct vault access via MCP | ✅ |

See `integrations/*/README.md` for setup instructions.

## Sources

Built on research from 20+ repositories and papers:
- [christianestay/claude-code-base-project](https://github.com/christianestay/claude-code-base-project) — 4 agents, 12 skills, self-improvement
- [TheDecipherist/claude-code-mastery-starter-kit](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit) — 11 rules, MDD workflow
- [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code) — autonomous work loop
- [damienlaine/agentic-sprint](https://github.com/damienlaine/agentic-sprint) — spec-driven sprints
- [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram) — zero-dep memory
- [4 autonomous hooks](https://dev.to/yurukusa/4-hooks-that-let-claude-code-run-autonomously-with-zero-babysitting-1748)
- Ian Bull — Sinks Not Pipes, Working Memory Cliff, Planning Bottleneck
- Vasilopoulos — Codified Context Infrastructure (108K-line project)
- Steve Yegge — Beads (git-native agent memory)
- Anthropic official docs — skills, rules, hooks, memory
- ai-agent-spec-v3-final.md — foundation specification
