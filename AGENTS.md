# Agent Instructions — Codex
<!-- Template Version: 3.6.0 -->

> This file is for OpenAI Codex. Claude Code reads `CLAUDE.md` instead.
> Both agents share rules in `.claude/library/` — single source of truth.

## Philosophy — Quality Over Speed
1. **Think before you type.** Research and planning ARE the work. Code is just output.
2. **Doubt is a feature.** Surface uncertainty. Enumerate alternatives before choosing.
3. **Slower is faster.** 30-min plan saves 3h rework. Test scenarios prevent production bugs.
4. **One thing done well > three halfway.** Finish, verify, commit before starting next.
5. **If unsure, STOP and ask.** Never produce code just to show progress.

Slow down: shared/core, can't articulate WHY, 3+ iterations, HIGH/CRITICAL risk.
Speed OK: XS+LOW, covered by tests, following approved plan.

## Project Context

Read `PROJECT_SPEC.md` for stack, dependencies, and file structure.
Read `tasks/current.md` for active work and handoff notes.
If no PROJECT_SPEC.md exists, scan the project before starting work.

## User Stories & Goals (Codex-Specific)

Codex is a strong engineer but needs explicit user intent. Before implementing:

### Success Criteria Protocol (MANDATORY)
1. State: **"User wants:** [goal in user's own terms]"
2. State: **"Success means:** [measurable outcome — what changes, what works after]"
3. State: **"I will verify by:** [specific check — test, manual verification, output comparison]"

If you cannot state all three clearly, ASK the user before writing code.

### User Context
- User communicates in Russian (primary) and English (technical)
- Prefers direct communication, technical depth, no fluff
- Values: working code over perfect code, but hates regressions
- Common request patterns: "сделай X", "почини Y", "проверь Z"

## Shared Rules (Single Source of Truth)

Rules live in `.claude/library/`. **Read them before implementing.**

### Always read before ANY code change:
1. `.claude/library/process/research-first.md` — research before code
2. `.claude/library/process/self-verification.md` — doubt protocol, confidence declaration
3. `.claude/library/technical/code-style.md` — naming, immutability, types, functions-in-modules
4. `.claude/library/technical/architecture.md` — module boundaries, file size limits
5. `docs/SHARED_CONVENTIONS.md` — functions-in-modules, entry point rules

### Read per task type:
- **Implementation**: also read `.claude/library/process/plan-first.md`
- **Review/Audit**: also read `.claude/library/meta/critical-thinking.md`
- **Writing content**: also read `.claude/library/technical/writing.md`
- **Work reports / closeout**: also read `.claude/library/technical/writing.md` and follow the client-facing report rules
- **Testing**: also read `.claude/library/technical/testing.md`
- **Design/UI**: also read `.claude/library/domain/domain-design-pipeline.md`

## Code Conventions (Critical Subset — Inline)

These rules are ALWAYS enforced. Full details in the library files above.

### Style
- No `any` type — use `unknown` + type guards
- No mutations — return new objects (const/final/let by default)
- Max **375 lines** per file — split if approaching
- Max **30 lines** per function — extract helpers
- Pure functions preferred (same input → same output)
- Guard clauses (early returns) over nested conditionals
- No magic numbers — named constants only
- No boolean parameters — use options objects

### Architecture
- **Functions-in-modules**: all business logic in importable modules, entry points only import and call
- Vertical slice architecture (organize by feature, not by layer)
- No circular dependencies
- Error handling at boundaries, not deep inside
- No hardcoded URLs, ports, credentials — use env vars

### Naming
- Functions: verb + noun (`getUser`, `calculateScore`)
- Booleans: is/has/can/should prefix (`isActive`, `hasPermission`)
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case or snake_case (match language convention)

## Context Loading Protocol

At task start, read these project files to understand context:

1. `PROJECT_SPEC.md` — stack, dependencies, file structure
2. `tasks/current.md` — active work, handoff notes from previous session
3. `tasks/lessons.md` — past mistakes to avoid (read ALL entries)
4. `_reference/tool-registry.md` — existing utilities (SEARCH before creating new ones)

## DON'T
- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No business logic in entry points — use functions-in-modules pattern
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No presenting solutions without self-verification
- No new code without checking tool-registry first
- No hardcoded visual values (use tokens)
- No building screens without components (system→tokens→components→screens)
- No "you're right!" without logging WHY
- No surface-level analysis ("works"=HTTP 200 is NOT analysis)
- No writing files in non-UTF-8 encoding — ALL files must be UTF-8 without BOM (see docs/SHARED_CONVENTIONS.md)

## Verification Before Completion

After implementing, before presenting results:

1. **Re-read the original request** (not your interpretation — the user's actual words)
2. **Match to success criteria** — does the solution achieve what was stated?
3. **State confidence**: HIGH / MEDIUM / LOW with reasoning
4. **State doubt**: what you're least sure about (NEVER "none")
5. If **LOW** confidence → present 2-3 options with trade-offs, don't implement

### Sunk Cost Test
> "If I had NOT already written this code, would I choose this exact approach?"
- YES → continue
- NO → discard and restart with the better approach

## Design Work — HARD RULES (Figma, CSS, UI)
1. NEVER hardcode visual values. Use tokens/variables.
2. NEVER build from raw shapes. Use components.
3. Build order: System → Tokens → Components → Screens. NEVER skip to screens.
4. Every container must have layout mode (auto-layout / flexbox / grid).
5. 8 states: Default, Hover, Active, Focus, Disabled, Loading, Error, Empty.

## Self-Improvement
After each correction: classify type (BUG/KNOWLEDGE_GAP/STYLE/DESIGN_DISAGREEMENT/MISUNDERSTANDING).
BUG or KNOWLEDGE_GAP → log to tasks/lessons.md with Track (BUG/KNOWLEDGE/PATTERN/PROCESS) + Severity (P0-P3).
When >50 entries → promote via `/weekly`.

## Token Economy
- Trust skills/memory over re-reading. Don't re-read files you read this session.
- Only read files you WILL use. Parallelize independent tool calls.
- Route outputs >20 lines to subagents. After 2 failed corrections → /clear.
- Task switching → HANDOFF.md (status + files + next steps), fresh session.

## Dual-Agent Coexistence
This project supports both Claude Code and OpenAI Codex.
- Shared rules: `.claude/library/` (single source of truth for both agents)
- Shared conventions: `docs/SHARED_CONVENTIONS.md`
- Claude-specific: `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`
- Codex-specific: `AGENTS.md`, `.codex/config.toml`, `.codex/hooks.json`
- Sync check: `bash scripts/sync-agents.sh`

## Build & Test
<!-- Filled per-project -->
Not configured yet. Run project setup to populate.

## Work Report Style
Final reports about completed work must follow the client-facing report rules in `.claude/library/technical/writing.md`: lead with result, explain the effect in the reader's world, keep technical detail only when it changes a decision, and default to `Что было → Что стало → Что это даёт → Чего ожидать дальше`.

## Compaction
After compaction: re-read `tasks/current.md` and `AGENTS.md` to recover context.

## Template Version
3.6.0
