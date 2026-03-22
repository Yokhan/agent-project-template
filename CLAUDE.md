# Agent-Ready Project
<!-- Template Version: 2.4.0 -->

AI-agent optimized project with persistent memory, autonomous hooks, and self-improving context infrastructure.

## Status

**NEW_PROJECT** — Run `/setup-project` or say "настрой проект" to configure for your stack.

## Stack

<!-- Filled by /setup-project -->
Not configured yet.

## Map

- `src/` — source code (vertical slices, created by /setup-project)
- `docs/` — architecture, data design, API contracts, decisions
- `templates/` — scaffolding templates for new modules
- `_reference/` — canonical reference implementations
- `brain/` — Obsidian vault, persistent memory across sessions
- `tasks/` — lessons learned + current task handoff
- `integrations/` — setup guides for memory MCP, Telegram, Beads, Obsidian MCP
- `scripts/` — drift detection, automation

## Commands

- `/setup-project` — configure project for your stack (run first!)
- `/implement` — Plan → Annotate → Implement (Boris Tane workflow)
- `/commit` — smart commit + optional PR
- `/review` — change review (intent + impact, not style)
- `/refactor` — safe refactoring via git worktree
- `/sprint` — autonomous work loop (Ralph Loop + circuit breaker)
- `/brain-sync` — sync knowledge to Obsidian vault
- `/weekly` — retrospective + self-improvement promotion
- `/status` — Project status dashboard
- `/rollback` — Safe git revert workflow
- `/onboard` — New developer onboarding
- `/update-template` — Sync project with newer template version

## Build & Test

<!-- Filled by /setup-project -->
Not configured yet.

## Rules

- Import only through module entry points (index.ts / __init__.py / mod.rs)
- Core modules = pure functions, no IO
- Data (config/tables) separated from logic (processors)
- Tests colocated: module.test.ts / test_module.py
- ALWAYS: typecheck + lint + tests after changes
- Code files < 375 lines (Working Memory Cliff, 1M context). Skills < 800 lines.
- Template files (.claude/rules, agents, skills, commands without `project-` prefix) are read-only. Project customizations → `project-*` files.
- When analyzing external material: extract PRINCIPLES first, never copy surface structure (.claude/rules/analysis-first.md)
- Project-specific hooks go in `.claude/settings.local.json` (never synced, Claude Code merges both)

## Hooks

Claude Code hooks live in `.claude/hooks/`. Each hook is a bash script called by settings.json.

| Hook | Trigger | What it does |
|------|---------|-------------|
| session-start.sh | Session begins | Creates session log, shows reminders |
| session-stop.sh | Session ends | Logs end time and commit stats |
| pre-compact.sh | Before context compression | Saves changed files list |
| format.sh | After Edit/Write | Runs appropriate formatter |
| post-edit.sh | After Edit/Write | Checks file size, validates syntax |
| pre-edit-safety.sh | Before Edit/Write | Blocks main branch, detects secrets |
| verify-gate.sh | After Bash (tests) | Reminds to run VERIFY phase |

If a hook fails: check `.claude/hooks/` scripts manually with `bash .claude/hooks/<name>.sh`.
Never put complex bash in settings.json "command" field — always use script files.

## Domain Knowledge Protection

Evidence-based guard rails loaded via `.claude/rules/domain-*.md` (8 domains) + `.claude/rules/critical-thinking.md`.
Detailed practices in `.claude/skills/domain-*-review/SKILL.md` (6 review skills).
Full research in `brain/03-knowledge/domains/` (14 files, 22 professions).

Rule: Never present blog/SEO-level evidence as best practice. Check evidence hierarchy (A>B>C>D) before recommending.

## Context on demand

- `docs/ARCHITECTURE.md` — modules and dependencies
- `docs/DATA_DESIGN.md` — data schema
- `docs/API_CONTRACTS.md` — API contracts
- `docs/DECISIONS.md` — architectural decision records
- `brain/02-projects/` — project context and goals
- `brain/03-knowledge/` — patterns and lessons learned
- `tasks/lessons.md` — self-improvement log (read at session start!)
- `_reference/README.md` — canonical implementations

## Persistent Memory

- `tasks/lessons.md` — after EVERY user correction, add entry (Error → Root Cause → Rule)
- Session logs auto-saved to `brain/01-daily/` via Stop hook
- Decisions in `brain/04-decisions/`
- `/brain-sync` for manual sync
- Optional: install memory MCP (see `integrations/memory-mcp/README.md`)

## Self-Improvement

After each mistake: add to `tasks/lessons.md`. Read it at session start. When >50 entries — promote best rules to `.claude/rules/` via `/weekly`.

## DON'T

- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No presenting solutions without self-verification (see .claude/rules/self-verification.md)
- No "you're right!" after user correction without logging WHY you didn't catch it (tasks/lessons.md)
- No confidence claims without having considered and rejected at least one alternative

## Template Version
2.4.0 — Run `bash scripts/check-drift.sh` to verify template health.

## Compaction

Preserve: current task, modified files, test results, discovered issues, lessons context.
