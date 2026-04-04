# Agent-Ready Project
<!-- Template Version: 3.1.0 -->

## Status
**NEW_PROJECT** — Run `/setup-project` or say "настрой проект" to configure for your stack.

## Stack
<!-- Filled by /setup-project -->
Not configured yet.

## Map
- `src/` — source code (vertical slices)
- `docs/` — architecture, API contracts, decisions
- `_reference/` — canonical implementations + tool registry
- `brain/` — Obsidian vault, persistent memory
- `tasks/` — lessons, current task, post-mortems, research cache
- `scripts/` — automation, routing, verification, research helpers

## How This Template Works

**Rules are NOT pre-loaded.** They live in `.claude/library/` and load ON DEMAND per task.
The router (`.claude/rules/router.md`) tells you how. Read it first.

**On every new task**: `bash scripts/route-task.sh "<task>"` → loads only relevant rules.
**On task switch**: re-run route-task.sh. State: "Switching: old→new, loading N rules".
**Manual mode**: `/mode-code`, `/mode-design`, `/mode-review`, `/mode-research`, `/mode-write`, `/mode-fix`, `/mode-plan`

## Session Start
1. `bash scripts/context-restore.sh` — shows mode, task, lessons, git state
2. If Engram available: `mem_session_start` + `mem_context`
3. `bash scripts/route-task.sh "<first task>"` → Read listed files

## Session End
Update `tasks/current.md` with handoff (status, files, next steps, blockers).
If Engram: `mem_session_end` with summary.

## MCP Memory (Engram) — PROACTIVE
- After EVERY decision/bug/discovery → `mem_save` immediately
- Before research → `mem_search` first
- On task switch → `mem_save` summary of paused task
- If no Engram → tasks/lessons.md + brain/ (file fallback)

## Runtime Helpers (use instead of manual tool calls)
```
bash scripts/route-task.sh <task>      — route to relevant rules (0 tokens)
bash scripts/research.sh <path>        — auto research (replaces 6 tool calls)
bash scripts/plan-scaffold.sh <task>   — auto plan template in tasks/current.md
bash scripts/verify-check.sh --size M  — auto verification checklist
bash scripts/context-restore.sh        — context recovery after compaction
bash scripts/measure-context.sh        — token budget meter
```

## Design Work — HARD RULES (Figma, CSS, UI)
1. **NEVER hardcode visual values.** Use tokens/variables. Create tokens FIRST if missing.
2. **NEVER build from raw shapes.** Use components. Create components FIRST if missing.
3. **Build order: System→Tokens→Components→Screens.** NEVER skip to screens.
4. **Every container must have layout mode** (auto-layout / flexbox / grid).
5. **8 states**: Default, Hover, Active, Focus, Disabled, Loading, Error, Empty.
6. **Before creating**: search_design_system — does it already exist?
Violation = revert and redo. Full pipeline: `.claude/library/domain/domain-design-pipeline.md`

## Commands (23)
/setup-project, /implement, /commit, /review, /refactor, /sprint, /brain-sync, /weekly,
/status, /rollback, /onboard, /update-template, /hotfix, /retrospective, /sync-all,
/audit-tools, /mode-code, /mode-design, /mode-review, /mode-research, /mode-write, /mode-fix, /mode-plan

## Self-Improvement
After each correction: classify (BUG/KNOWLEDGE_GAP/STYLE/DESIGN/MISUNDERSTANDING).
BUG or KNOWLEDGE_GAP → log to tasks/lessons.md (Error → Root cause → Rule).
When >50 entries → promote via `/weekly`.

## DON'T
- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No presenting solutions without self-verification
- No "you're right!" without logging WHY
- No new code without checking tool-registry first
- No hardcoded visual values (use tokens)
- No building screens without components (system→tokens→components→screens)
- No surface-level analysis ("works"=HTTP 200 is NOT analysis)

## Build & Test
<!-- Filled by /setup-project -->
Not configured yet.

## Template Version
3.1.0 — Run `bash scripts/check-drift.sh` to verify health.

## Compaction
After compaction: `bash scripts/context-restore.sh` to recover mode + task + rules.
