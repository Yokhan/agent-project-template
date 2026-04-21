# Agent Project Template v3

[![Template Version](https://img.shields.io/badge/template-v3.6.0-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

Self-deploying AI-agent optimized project template with **MCP-based dynamic rule routing** (-93% per-message tokens), persistent memory, autonomous work loops, self-improvement, and merge-safe sync.

> **Подробная инструкция на русском:** [SETUP_GUIDE.md](SETUP_GUIDE.md) — пошаговая настройка, MCP-серверы, Zed, troubleshooting.
> Product boundary: [docs/PRODUCT_BOUNDARY.md](docs/PRODUCT_BOUNDARY.md) • Safe defaults: [docs/SAFE_DEFAULTS.md](docs/SAFE_DEFAULTS.md) • Supported environments: [docs/SUPPORTED_ENVIRONMENTS.md](docs/SUPPORTED_ENVIRONMENTS.md)

## Quick Start

```bash
git clone https://github.com/Yokhan/agent-project-template.git agent-project-template
cd agent-project-template
bash setup.sh my-project
cd my-project
bash scripts/bootstrap-mcp.sh --install
```

Open the generated project in Claude Code or Zed.
In chat: `/setup-project` — Claude configures the project for your stack.

**Windows**: run `setup.bat`, then `cd` into the generated project and run `bash scripts/bootstrap-mcp.sh --install`.

`README.md` and `SETUP_GUIDE.md` stay template-owned after bootstrap. Put project-specific onboarding or architecture details into `CLAUDE.md`, `PROJECT_SPEC.md`, `ecosystem.md`, and `docs/`.

## Project Creation Modes

- **Generated project**: `setup.sh my-project` or `setup.bat` creates the clean payload that should ship to real projects.
- **Template maintainer workspace**: stay in this repository only when improving the template itself.
- **Optional orchestrator workspace**: `bash setup.sh --orchestrator my-orchestrator` creates a multi-project coordination workspace without template-maintainer artifacts.

`setup.*` copies the tracked project-facing allowlist only. It intentionally leaves behind template-maintainer files such as `n8n/`, `templates/`, local fixtures, debug artifacts, and the setup entrypoints themselves.

## Updating Existing Projects

When the template improves (new rules, agents, skills, hooks), update your project:

```bash
# Preview changes (no modifications)
bash scripts/sync-template.sh /path/to/agent-project-template --dry-run

# Apply updates
bash scripts/sync-template.sh /path/to/agent-project-template
```

Or use the Claude Code command: `/update-template /path/to/template`

If you are operating from the template repo instead of inside the child project, use:

```bash
bash /path/to/agent-project-template/scripts/sync-template.sh /path/to/agent-project-template --project-dir /path/to/my-project --dry-run
```

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

**What gets updated**: Template infrastructure (`.claude/`, `.codex/`, scripts, MCP helper sources, AGENTS.md, onboarding docs)
**What's preserved**: Your code (`src/`), project docs, `brain/`, `tasks/`, `CLAUDE.md`, `PROJECT_SPEC.md`, `ecosystem.md`, and all `project-*` files
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

### Generated project includes these

| Category | Count | Details |
|----------|-------|---------|
| **Rules** | 25 | 6 process + 7 technical + 4 meta + 8 domain guards |
| **Hooks** | 7 | session-start/stop, pre-compact, format, post-edit, pre-edit-safety, verify-gate |
| **Skills** | 29 | 6 core + 5 dev + 2 quality + 7 domain review + 2 integrations + 7 other |
| **Agents** | 10 | implementer, reviewer, researcher, test-engineer, security-auditor, writer, simplifier, documenter, devops, profiler |
| **Commands** | 16 | /setup-project, /implement, /commit, /review, /refactor, /sprint, /brain-sync, /weekly, /status, /rollback, /onboard, /update-template, /hotfix, /retrospective, /sync-all, /audit-tools |
| **Scripts** | 12 | check-drift, audit-reuse, scan-project, sync-template, bootstrap-mcp, + 7 more |
| **Pipelines** | 3 | feature, bugfix, security-patch |
| **Brain** | Obsidian vault | session logs, decisions, knowledge base |
| **Memory** | tasks/ | lessons.md, current.md, .research-cache.md, post-mortems/ |

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

Tier 1 (Hot Memory)     — CLAUDE.md + .claude/rules/router.md + tasks/lessons.md    (every session)
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

| Integration | What | Required? |
|-------------|------|-----------|
| **Engram** | Persistent memory (SQLite+FTS5, zero-dep Go binary) | **Yes** |
| **Telegram** | Remote control from phone | No |
| **Beads** | Git-native task tracker | No |
| **Obsidian MCP** | Direct vault access via MCP | No |
| **CodeGraphContext** | Code dependency graph | No |

Auto-setup: `bash scripts/bootstrap-mcp.sh --install`
For Zed AI chat: `bash scripts/bootstrap-mcp.sh --install --zed`
See `integrations/*/README.md` for details.

## Upgrading from v2.x to v3.0

```bash
# 1. Preview changes
bash scripts/sync-template.sh /path/to/agent-project-template --dry-run

# 2. Apply (with conflict detection)
bash scripts/sync-template.sh /path/to/agent-project-template

# 3. Review any CONFLICT files (*.template-new)
# 4. Run validation
bash scripts/check-drift.sh
```

**New in v3.0**: sync now detects conflicts (files modified locally AND in template) instead of silently overwriting. See `*.template-new` files for template version, resolve manually.

## Changelog

| Version | Key Changes |
|---------|------------|
| **3.6.0** | Production-ready bootstrap contract, tracked-only payload, living PROJECT_SPEC/tool registry, AgentOS compatibility, and release hardening |
| **3.5.0** | Dual-agent support for Claude Code + Codex, Codex project config, validation and recovery hardening |
| **3.2.1** | MCP Context Router (1 tool call instead of 9), depth=brief/normal/full, rules cache, Russian keywords, -93% per-message tokens |
| 3.1.x | Dynamic task router, rules moved to .claude/library/, 7 mode commands, 6 runtime helpers |
| **3.0.0** | Merge-safe sync (conflict detection), cross-platform lib, 25 rules, 29 skills, 10 agents, audit-reuse system, design pipeline, validate-template.sh |
| 2.8.0 | Atomic reuse protocol, tool registry, design pipeline (domain-design.md) |
| 2.7.0 | Deep analysis rule, ecosystem map, research cache, session metrics, post-mortems |
| 2.5.0 | Agent routing, task queue, pipelines, graduated verification, circuit breaker |
| 2.4.0 | Template sync system, manifest-based hash verification |
| 2.0.0 | Initial release: 19 rules, 9 agents, 22 skills, hooks, brain vault |

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
