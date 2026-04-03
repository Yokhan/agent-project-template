# Agent-Ready Project
<!-- Template Version: 3.0.0 -->

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
- `_reference/` — canonical reference implementations + tool registry
- `brain/` — Obsidian vault, persistent memory across sessions
- `tasks/` — lessons learned, current task handoff, post-mortems, research cache
- `scripts/` — drift detection, reuse audit, project scanning, automation

## Commands (16)

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
- `/hotfix` — Fast-track production fix (skip ceremony, require post-mortem)
- `/retrospective` — Deep weekly analysis (agent performance, rule effectiveness)
- `/sync-all` — Sync template to all projects with .template-manifest.json
- `/audit-tools` — Scan for duplicate code and update tool registry

## Build & Test

<!-- Filled by /setup-project -->
Not configured yet.

## SESSION START — MANDATORY (do this EVERY session)

1. Read `PROJECT_SPEC.md` — what is this project, stack, deps
2. Read `tasks/current.md` — handoff from last session, active task
3. Read `tasks/lessons.md` — avoid past mistakes (CRITICAL)
4. `git log --oneline -5` — what changed recently
5. Check `_reference/tool-registry.md` — what utilities already exist

Skip ANY of these = you WILL duplicate code, break conventions, repeat mistakes.
See `.claude/rules/context-first.md` for full protocol.

## SESSION END — MANDATORY (do this BEFORE ending)

Update `tasks/current.md`:
```
## Handoff — [DATE]
Status: [in-progress / blocked / completed]
Current file: [path]
What was done: [1-2 sentences]
What's left: [next steps]
Blockers: [if any]
Modified files: [list]
```

## BEFORE ANY CODE CHANGE — Research Protocol

1. **Read affected files + neighbors** (imports, tests)
2. **git log -5 on affected files** — avoid conflicts
3. **Check tasks/lessons.md** — has this been solved/failed before?
4. **Check _reference/tool-registry.md** — does a utility already exist?
5. **Check ecosystem.md** — cross-project impact?
6. **State findings** before coding:
   ```
   RESEARCH: Read [N files]. Lessons: [applicable]. Existing code: [reusable]. Approach: [chosen].
   ```

Skip research ONLY for XS tasks (single file, ≤5 lines). See `.claude/rules/research-first.md`.

## BEFORE CODING S+ TASKS — Plan Protocol

Write to `tasks/current.md` under `## Plan`:
- **Goal**: 1 sentence
- **Size**: XS/S/M/L/XL
- **File architecture**: directory tree with [NEW]/[MODIFY] markers
- **Implementation order**: what first and why
- **Plan B** (M+ tasks): fallback approach + trigger signal

Files approaching 375 lines → split in the plan, not after. See `.claude/rules/plan-first.md`.

## SEARCH BEFORE CREATE — Atomic Reuse

Before writing ANY new utility/helper/component:
1. `grep/glob` project for similar functionality
2. Check `_reference/tool-registry.md`
3. Check `_reference/README.md` (canonical patterns)
4. Found → **REUSE**. Close match → **EXTEND**. Nothing → create + **REGISTER**.

**Thresholds**: 2 uses = consider extraction. 3+ uses = mandatory extraction to shared/.
After creating any shared utility → register in tool-registry immediately.

See `.claude/rules/atomic-reuse.md`.

## VERIFICATION — Graduated Gates

| Size | Gates |
|------|-------|
| XS | typecheck/lint only |
| S | + intent check ("does this match the request?") |
| M | + red-team own code + confidence declaration |
| L | + all 4 gates + user checkpoint at mid-build |
| XL | + pre-mortem + reviewer agent + 3 user checkpoints |

**Risk overrides** (always full 4 gates): auth, security, payments, health, shared/, core/.

### Doubt Protocol (M+ tasks)
1. "What is the WEAKEST part?" (answer "none" = you haven't thought enough)
2. Re-read ORIGINAL request. "My solution achieves [X]. Could fail if [Y]."
3. Confidence: HIGH/MEDIUM/LOW + what you're least sure about + alternative considered

### When stuck (LOW confidence or 2+ failed attempts)
STOP coding. State what you know, what you don't, present max 3 options. Ask user.

See `.claude/rules/self-verification.md`.

## MCP MEMORY (Engram) — PROACTIVE, NOT ON-DEMAND

If Engram MCP is available (`mem_save`, `mem_search`, `mem_context` tools exist):

**Session start**: call `mem_session_start` with project name. Then `mem_context` to load recent history.
**After compaction**: call `mem_context` immediately to restore what was lost.

**PROACTIVE saves** (do NOT wait to be asked):
- After ANY decision → `mem_save(topic_key="decision:{slug}", content="chose X over Y because Z")`
- After ANY bug fix → `mem_save(topic_key="bug:{slug}", content="error: X, root cause: Y, fix: Z")`
- After ANY discovery → `mem_save(topic_key="discovery:{slug}", content="found: X in Y")`
- After ANY convention established → `mem_save(topic_key="convention:{slug}", content="rule: X")`

**Before research**: `mem_search("{topic}")` — answer may already exist from previous session.
**Session end**: `mem_session_end` with summary of what was done.

If Engram not available → degrade to file-only: tasks/lessons.md + brain/. Still log, just to files.
This is NOT optional. Skipping memory saves = next session starts blind.

## SELF-IMPROVEMENT — After Every Correction

1. Classify: BUG / KNOWLEDGE_GAP / STYLE / DESIGN / MISUNDERSTANDING
2. BUG or KNOWLEDGE_GAP → log to `tasks/lessons.md`:
   ```
   ### [DATE] — [Title]
   **Error**: what went wrong
   **Root cause**: why
   **Rule**: concrete prevention rule
   ```
3. STYLE → save to brain/02-projects/ as user preference
4. If user says "you're right!" → log WHY you didn't catch it yourself (attention failure)

When >50 entries → promote recurring patterns to `.claude/rules/project-*.md` via `/weekly`.

## DESIGN WORK — HARD RULES (Figma, CSS, UI)

**NON-NEGOTIABLE when doing ANY visual/design work.**

1. **NEVER hardcode visual values.** No raw hex, no raw px, no raw font names.
   → Use: design tokens, CSS variables, text styles, spacing tokens.
   → Tokens don't exist? CREATE THEM FIRST, then use.

2. **NEVER build from raw shapes.** No raw rectangles, no manual styling.
   → Use: existing components, instances, imports.
   → Component doesn't exist? CREATE IT as reusable first, then use instances.

3. **Build order: System → Tokens → Components → Screens.**
   - First: variables/tokens (colors, spacing, radius, typography)
   - Then: atomic components (Button, Input, Card) with auto-layout
   - Then: compose screens FROM components
   - NEVER skip to screens. NEVER.

4. **Every container must have layout mode** (auto-layout / flexbox / grid).
   No absolute positioning except background decorations.

5. **8 states for every interactive element**: Default, Hover, Active, Focus, Disabled, Loading, Error, Empty.

6. **Before creating ANYTHING**: search_design_system / grep components — does it already exist?

7. **Figma MCP specifics**: discover tokens first (`getLocalVariablesAsync`), use `textStyleId` not `loadFontAsync`, validate with `get_screenshot`.

Violation = immediate revert and redo. See `.claude/rules/domain-design.md` for full 8-phase pipeline.

## WRITING — Anti-AI Guard

All user-facing text must pass:
- **BAN-LIST check**: no "является", "ключевой аспект", "Furthermore", "Delve", "Landscape"
- **Paragraph variation**: no 3 consecutive paragraphs of similar length
- **Specificity**: at least 3 specific details per 1000 chars
- **Human voice**: start some sentences with "И", "А", "Но" / "And", "But"

Writer agent (opus model) handles all writing tasks. See `.claude/rules/writing.md`.

## ARCHITECTURE — Key Rules

- Import ONLY through module entry points (index.ts / __init__.py / mod.rs)
- Core modules = pure functions, no IO
- Data (config/tables) separated from logic (processors)
- Tests colocated: module.test.ts / test_module.py
- Code files < 375 lines. Instruction files < 800 lines.
- Cross-cutting concerns (auth, logging, validation) → `shared/middleware/`, `shared/validators/`
- Safe refactoring: tests → refactor → tests. Never mix refactor + behavior change in one commit.
- Template files (without `project-` prefix) are read-only. Customizations → `project-*` files.

## Rules Index (25 files in .claude/rules/)

### Process
context-first, research-first, plan-first, self-verification, self-improvement, conflict-resolution

### Technical
architecture, code-style, error-handling, testing, git-workflow, writing, atomic-reuse

### Meta
analysis-first, critical-thinking, strategic-thinking, deep-analysis

### Domain (8)
domain-business, domain-design, domain-health, domain-marketing-sales, domain-productivity, domain-psychology, domain-science, domain-software

## Hooks (7)

| Hook | Trigger | Purpose |
|------|---------|---------|
| session-start.sh | Session begins | Log, reminders, agent health, registry check, python check |
| session-stop.sh | Session ends | Stats, metrics, handoff to current.md |
| pre-compact.sh | Before compaction | Full snapshot to tasks/.compaction-snapshot.md |
| format.sh | After Edit/Write | Formatter |
| post-edit.sh | After Edit/Write | File size + syntax check |
| pre-edit-safety.sh | Before Edit/Write | Block main branch, detect secrets |
| verify-gate.sh | After Bash (tests) | VERIFY phase reminder |

## Agents (10)

| Agent | Model | Role |
|-------|-------|------|
| implementer | sonnet | research → plan → implement → verify |
| reviewer | sonnet | intent + impact review (blind) |
| researcher | opus | deep investigation, anti-hallucination |
| test-engineer | sonnet | TDD, coverage strategy |
| security-auditor | opus | vulnerability detection |
| writer | opus | anti-AI text, BAN-LIST, platform adaptation |
| simplifier | sonnet | reduce complexity, extract patterns |
| documenter | sonnet | API docs, README, CHANGELOG |
| devops | sonnet | CI/CD, infrastructure |
| profiler | sonnet | performance analysis |

## Scripts (13)

check-drift, check-banlist, audit-reuse, scan-project, session-metrics, sync-template, sync-all, bootstrap-mcp, brain-search, test-hooks, test-template, validate-template, lib/platform.sh

## Skills (29)

Core: agent-router, memory-router, decompose, task-queue, agent-metrics, pipeline.
Dev: setup-project, add-feature, debug, sprint, implement.
Quality: test-rules, security-audit.
Domain: domain-business/design/health/communication/science/software-review, strategic-review.
Other: api-contract, brain-sync, refactor-module, setup-integrations, setup-telegram.

## Context on demand

- `PROJECT_SPEC.md` — project overview (stack, deps, state)
- `docs/ARCHITECTURE.md`, `DATA_DESIGN.md`, `API_CONTRACTS.md`, `DECISIONS.md`
- `brain/02-projects/` — goals | `brain/03-knowledge/` — patterns
- `tasks/lessons.md` — self-improvement | `tasks/.research-cache.md` — research cache
- `tasks/post-mortems/` — incident records | `ecosystem.md` — cross-project deps
- `_reference/README.md` — canonical patterns | `_reference/tool-registry.md` — utility index

## DEEP ANALYSIS — No Surface-Level Bullshit

When analyzing, auditing, or reporting on ANY system:

- **Level 0 (INSUFFICIENT)**: "HTTP 200", "tests pass", "compiles". THIS IS NOT ANALYSIS.
- **Level 1 (MINIMUM)**: user can complete primary action end-to-end. Verified by doing it.
- **Level 2 (ADEQUATE)**: + error states handled, edge cases work, performance acceptable.
- **Level 3 (THOROUGH)**: + evaluated from user/business perspective, competitive context.

Level 0 is NEVER an acceptable answer. If you report "everything works" without evidence → redo.

**Three Whys**: for every finding, ask WHY three times to reach root cause.
**Zero findings ≠ perfect system**: zero findings = insufficient analysis. Always find at least one improvement.

See `.claude/rules/deep-analysis.md`.

## CRITICAL THINKING — Red Flags Gate

Before finalizing ANY recommendation, check:
- Am I recommending this because it's POPULAR or PROVEN?
- Am I oversimplifying?
- Can I cite a source? (if no → "based on general patterns", not assertive language)
- Am I being sycophantic? → Push back NOW
- Did I consider at least one alternative? (if no → 70% confidence MAX)
- Am I copying structure instead of applying principles? → Extract WHY first

**Sycophancy breaker**: if user points out a flaw and your reaction is "you're right!" → log to lessons.md WHY you didn't catch it.

## STRATEGIC THINKING — Commander's Intent

Before ANY action: "What is the user's ACTUAL goal? If this succeeds perfectly, what outcome does it produce?"
Never optimize the task metric — optimize VICTORY for the user.

**OODA Loop**: Observe (gather state) → Orient (understand WHY) → Decide (highest leverage) → Act (small batch, validate).
**Center of gravity**: every problem has ONE thing that, if addressed, makes everything else fall into place. Attack that.
**No plan survives contact**: when reality disagrees with plan, adapt the plan, don't force reality.

See `.claude/rules/strategic-thinking.md` for 63 principles from 12 sources.

## Evidence Hierarchy (for ALL recommendations)

A (meta-analysis) > B (RCT) > C (expert consensus) > D (blog). D-level = INSUFFICIENT for recommendations.
Health/science domains: MUST cite evidence level + source. See critical-thinking.md.

## Task Size Classification

XS (≤1 file, ≤5 lines) → no gates. S (≤2 files, ≤30 lines) → 1 gate. M (3-7 files) → 2 gates. L (8-15 files) → 4 gates. XL (>15 files) → decompose first.

## ERROR HANDLING — Essentials

- Typed errors per domain (AuthError, ValidationError, NotFoundError)
- Catch at boundaries (HTTP handlers, CLI entry points), propagate everywhere else
- Never swallow errors: `catch {}` with no logging = FORBIDDEN
- Three components per error: machine code + human message + correlation ID
- External services: circuit breaker (open after 5 failures/60s, half-open after 30s)

## GIT — Essentials

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Never force push to main. Never skip hooks.
- PRs < 400 lines. Branches merge within 2 days.
- Feature flags for deployment: deploy ≠ release.
- Every commit on main must be buildable (git bisect depends on this).

## DON'T

- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No presenting solutions without self-verification
- No "you're right!" without logging WHY you didn't catch it
- No confidence claims without having rejected at least one alternative
- No writing new code without checking tool-registry first
- No hardcoded visual values (use tokens/variables)
- No building screens without components (system → tokens → components → screens)
- No surface-level analysis ("works" = HTTP 200 is NOT analysis)

## Template Version
3.0.0 — Run `bash scripts/check-drift.sh` to verify template health.

## Compaction

Preserve: current task, modified files, test results, discovered issues, lessons context.
After compaction: read `tasks/.compaction-snapshot.md` to restore full context.
