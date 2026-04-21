# Agent-Ready Project
<!-- Template Version: 3.6.0 -->

## Status
**NEW_PROJECT** — Run `/setup-project` or say "настрой проект" to configure for your stack.

## Philosophy — Quality Over Speed
1. **Think before you type.** Research and planning ARE the work. Code is just output.
2. **Doubt is a feature.** Surface uncertainty. Enumerate alternatives before choosing.
3. **Slower is faster.** 30-min plan saves 3h rework. Test scenarios prevent production bugs.
4. **One thing done well > three halfway.** Finish, verify, commit before starting next.
5. **If unsure, STOP and ask.** Never produce code just to show progress.

Slow down: shared/core, can't articulate WHY, 3+ iterations, HIGH/CRITICAL risk.
Speed OK: XS+LOW, covered by tests, following approved plan.

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

**On every new task**:
1. User gives task (any language, any jargon)
2. YOU extract English keywords: task type + domain + action
3. Call `get_context(keywords="...")` → default depth=brief (~50 tokens: mode + agent + file list)
4. For M+ tasks: `get_context(keywords="...", depth="normal")` → includes full rule text
5. For L/XL or unfamiliar domain: `depth="full"` → rules + lessons + git + registry + ecosystem
6. Work. Read specific files from the list only when you need them.

**On task switch**: `switch_context(keywords="...")`
**After compaction**: `get_active_rules()`
**Fallback (no MCP)**: `bash scripts/route-task.sh "<keywords>"` + Read listed files
**Manual**: `/mode-code` `/mode-design` `/mode-review` `/mode-research` `/mode-write` `/mode-fix` `/mode-plan`

## Session Start
1. `bash scripts/context-restore.sh` — shows mode, task, lessons, git state
2. If Engram: `mem_session_start` + `mem_context`
3. `get_context(keywords="<first task>")` → ready to work

## Session End
Update `tasks/current.md` with handoff (status, files, next steps, blockers).
If Engram: `mem_session_end` with summary.

## Work Report Style
Final reports about completed work must follow `.claude/library/technical/writing.md`, especially the client-facing report rules: lead with result, explain the effect in the reader's world, keep technical detail only when it changes a decision, and default to `Что было → Что стало → Что это даёт → Чего ожидать дальше`.

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
bash scripts/measure-context.sh        — token budget meter (chars/token heuristic)
bash scripts/blast-radius.sh <file>    — BFS impact analysis: all affected files
bash scripts/import-graph.sh [dir]     — hot files: most-imported modules
bash scripts/scan-repo.sh <path>       — security scan before opening untrusted repos
```

## Security (Defense Layer)
Hooks in `.claude/hooks/` enforce automatically:
- **prompt-injection-defender.sh** — PostToolUse: scans Read/Bash/WebFetch/Grep output for 7 injection categories (warn-only, zero cost)
- **deny-sensitive-paths.sh** — PreToolUse: blocks Read/Edit/Write on .env, SSH keys, credentials, certificates
- **pre-bash-safety.sh** — PreToolUse: blocks rm -rf, force push, pipe-to-shell, mass kills, secret exfiltration
- **check-encoding.sh** — PostToolUse: validates UTF-8 encoding, catches BOM and broken Cyrillic
- **session-audit.sh** — PostToolUse: logs all tool invocations to tasks/audit/session-YYYY-MM-DD.jsonl (7-day rotation)
- Security alerts logged to `tasks/audit/security.jsonl`
Optional: **CodeSight** codebase index — see `integrations/codesight.md`, enable in `.mcp.json`.

## Design Work — HARD RULES (Figma, CSS, UI)
1. **NEVER hardcode visual values.** Use tokens/variables. Create tokens FIRST if missing.
2. **NEVER build from raw shapes.** Use components. Create components FIRST if missing.
3. **Build order: System→Tokens→Components→Screens.** NEVER skip to screens.
4. **Every container must have layout mode** (auto-layout / flexbox / grid).
5. **8 states**: Default, Hover, Active, Focus, Disabled, Loading, Error, Empty.
6. **Before creating**: search_design_system — does it already exist?
Violation = revert and redo. Full pipeline: `.claude/library/domain/domain-design-pipeline.md`

## Commands (24)
/setup-project, /implement, /commit-push-pr, /review, /refactor, /sprint, /brain-sync, /weekly,
/status, /rollback, /onboard, /update-template, /hotfix, /retrospective, /sync-all,
/audit, /audit-tools, /mode-code, /mode-design, /mode-review, /mode-research, /mode-write, /mode-fix, /mode-plan

## Self-Improvement
After each correction: classify type (BUG/KNOWLEDGE_GAP/STYLE/DESIGN_DISAGREEMENT/MISUNDERSTANDING).
BUG or KNOWLEDGE_GAP → log to tasks/lessons.md with Track (BUG/KNOWLEDGE/PATTERN/PROCESS) + Severity (P0-P3).
When >50 entries → promote via `/weekly`.

## Token Economy
- Trust skills/memory over re-reading. Don't re-read files you read this session.
- Only read files you WILL use. Parallelize independent tool calls.
- Route outputs >20 lines to subagents. After 2 failed corrections → /clear.
- Task switching → HANDOFF.md (status + files + next steps), fresh session.

## DON'T
- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No business logic in entry points — use functions-in-modules pattern (see docs/SHARED_CONVENTIONS.md)
- No presenting solutions without self-verification
- No "you're right!" without logging WHY
- No new code without checking tool-registry first
- No hardcoded visual values (use tokens)
- No building screens without components (system→tokens→components→screens)
- No surface-level analysis ("works"=HTTP 200 is NOT analysis)

## Dual-Agent Coexistence
This project supports both Claude Code and OpenAI Codex.
- Shared rules: `.claude/library/` (single source of truth for both agents)
- Shared conventions: `docs/SHARED_CONVENTIONS.md`
- Claude-specific: `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`
- Codex-specific: `AGENTS.md`, `.codex/config.toml`, `.codex/hooks.json`
- Sync check: `bash scripts/sync-agents.sh`

## Build & Test
<!-- Filled by /setup-project -->
Not configured yet.

## Template Version
3.6.0 — Run `bash scripts/check-drift.sh` to verify health.

## Compaction
After compaction: `bash scripts/context-restore.sh` to recover mode + task + rules.
