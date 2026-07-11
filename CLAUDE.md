# Agent-Ready Project
<!-- Template Version: 4.6.2 -->

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

## Production Product Standard

Real product work is never treated as MVP/prototype work unless the user explicitly asks for a disposable experiment. Bounded implementation steps are fine; lowering the final product quality bar is not.

Plans and improvements prioritize the real product user's experience and app-specific business outcomes first: revenue, monetization, conversion, activation, retention, loyalty, support load, or the KPI that matters for that application. Technical perfection, refactors, tooling, and architecture cleanup come second unless they directly unlock, protect, or measurably improve those outcomes.

Treat the user as the client/product owner and the agent as the accountable executor: do not agree by default, do not claim unverified work is done, and challenge requests that would lower the outcome, safety, quality, or KPI. Full rule: `.claude/library/process/client-executor-contract.md`.

For M+, HIGH-risk, template, product, release, status, and closeout work, use progressive JPEG delivery: show the first useful view, the next sharpened evidence layer, rough edges, and the replan trigger instead of going silent until a final answer. When working documents use `PROGRESSIVE_STATUS`, include a project slice from `node scripts/progressive-status.js`; before closeout, `node scripts/progressive-status.js --check` must pass.

Progressive JPEG also controls implementation shape. Use `$codex-progressive-jpeg-planner`: every implementation slice must fulfill the real product purpose end to end at its current depth through the final path. Planning, architecture, stubs, debug output, tests, status, and inventories are enabling checkpoints, never product evidence; the slice outcome may not depend on a stub, and evidence may not be fabricated. Build the accepted end-state skeleton with honest 1% callable seams, gate on a missing final plan, and delete or migrate superseded layers before claiming sharper readiness.

Before product, design, auth, data, game, docs, deployment, template, or M+ work, load:

1. `.claude/library/product/production-product-standard.md`
2. `.claude/library/process/product-goal-loop.md`
3. `.claude/library/process/client-executor-contract.md`

Maintain a goal-like contract:

- Final outcome: what the finished product lets the end user do.
- Product/business priority: which user experience and app-specific KPI this step improves or protects.
- Quality bar: UX, safety, privacy, reliability, performance, accessibility, design-system, data, docs, and domain tone.
- Current step: the smallest valuable reversible move toward that final outcome.
- Dependencies and risks: what could block or lower the final product.
- Out of scope: honest exclusions for this step, not hidden debt.

Plans, audits, status updates, and final reports must use the language of the user's request. Code identifiers and commands stay in their native language.

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

**Agent infrastructure SOT:** before changing `AGENTS.md`, `CLAUDE.md`, skills, subagents, hooks, routing, or template sync behavior, read `docs/AGENT_CONTEXT_SOT.md` and check `_reference/agent-sot/sources.json`. If a source is stale or behavior-sensitive, browse the canonical URL first. Run `node scripts/validate-agent-sot.js`.

**SOT conflict protocol:** if two plausible sources of truth conflict, do not choose silently. Name the sources, classify authority (user instruction > project-owned `project-*` or AgentOS graph > repo SOT docs > shared template rules > historical notes > examples), then ask the user with 2-3 options when authority is ambiguous or the choice changes product behavior, safety, data, release, or architecture.

**Thinking tools gate:** for M+, HIGH-risk, ambiguous, architecture, template, design, product, marketing, or repeated-failure work, use system map + TRIZ contradiction + Sun Tzu/stratagem terrain check + plan reality check before choosing the path. Phrase conflicts as "need X without causing Y", list existing resources, map terrain/competitors/center of gravity/favorable ground, name the next verifiable checkpoint, and replan explicitly when assumptions break. Do not use strategy language to justify deception, dark patterns, or user-hostile manipulation.

**On every new task**:
1. User gives task (any language, any jargon)
2. YOU extract task type + domain + action + semantic intent, not only literal keywords
3. Call `get_context(keywords="...")` → default depth=brief (~50 tokens: mode + agent + file list)
4. For M+ tasks: `get_context(keywords="...", depth="normal")` → includes full rule text
5. For L/XL or unfamiliar domain: `depth="full"` → rules + lessons + git + registry + ecosystem
6. Work. Read specific files from the list only when you need them.

**On task switch**: `switch_context(keywords="...")`
**After compaction**: `get_active_rules()`
**Fallback (no MCP)**: `bash scripts/route-task.sh "<keywords>"` + Read listed files
**Manual**: `/mode-code` `/mode-design` `/mode-review` `/mode-research` `/mode-write` `/mode-fix` `/mode-plan`

Codex route fallback uses exact patterns plus semantic intent scoring in `scripts/lib/codex-route-intents.js`. Misroutes must be fixed in the intent model with regression fixtures, not only by adding one literal keyword.

## Task Formulation Examples

Translate vague requests into execution contracts:

| User says | Agent formulates | Behavior |
| --- | --- | --- |
| `сделай нормально` | Production flow + quality bar + verification | Inspect flow, plan, implement, verify user path |
| `почини ошибку` | Symptom + broken link + regression guard | Reproduce, diagnose root cause, patch boundary |
| `обнови шаблон` | Deterministic source/downstream update to a verified tag | Classify workspace, pinned dry-run/apply, verify manifest/diff/checks |
| `улучши дизайн` | One user job + KPI + rendered evidence | Subtract first, use tokens/components, viewport-check |
| `проверь` | Findings-first review | Severity, evidence, impact, smallest fix |
| `спланируй` | Decision-ready plan | First useful result, options, risk, replan trigger |
| `когда будет готово?` | Reliable forecast | Give next verifiable checkpoint; do not invent final certainty |
| `план поехал` | Replan shape | Old assumption, reality, impact, options, recommendation |
| `требования конфликтуют` | TRIZ contradiction | Need X without Y; resources, separation options, recommendation |
| `проверь маркетинг` | GTM/communication review | ICP, positioning, offer, funnel, channel, proof, measurement, ethics |
| `примени Сунь-цзы/стратагемы` | Competitive strategy | Terrain, center of gravity, asymmetry, timing, no dark patterns |

## Template Update Protocol

For `обнови шаблон`, `/update-template`, or a repository-link handoff, follow
`docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol`: classify source vs
downstream, read installed manifest version, resolve one explicit stable tag,
verify remote/worktree, run pinned dry-run, apply the same tag, then verify
manifest version, diff, overlays, conflicts, and checks. Bare `--from-git` is
canary-only. If local sync is broken, use the target release checkout's script
with `--project-dir`. Never infer a published release from an unverified tag.

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
6. **Composition trace**: higher layers must declare lower-layer tokens/components.
7. **Rendered geometry**: verify important components with browser/Storybook bounding-box checks.
8. **Before creating**: search_design_system — does it already exist?
Violation = revert and redo. Full pipeline: `.claude/library/domain/domain-design-pipeline.md`

## Commands (23)
/setup-project, /implement, /commit-push-pr, /review, /refactor, /sprint, /brain-sync, /weekly,
/status, /rollback, /onboard, /update-template, /hotfix, /retrospective, /sync-all,
/audit-tools, /mode-code, /mode-design, /mode-review, /mode-research, /mode-write, /mode-fix, /mode-plan

## Self-Improvement
After each correction: classify type (BUG/KNOWLEDGE_GAP/STYLE/DESIGN_DISAGREEMENT/MISUNDERSTANDING).
BUG or KNOWLEDGE_GAP → log to tasks/lessons.md with Track (BUG/KNOWLEDGE/PATTERN/PROCESS) + Severity (P0-P3).
When >50 entries → promote via `/weekly`.

## Systemic Error Analysis
When an error, failed check, regression, or correction appears, classify it before patching: local typo, broken contract, repeated error, architecture/workflow smell, or SOT conflict. For repeated, boundary, architecture, or HIGH-risk failures, name the broken link, root-cause hypothesis, smallest systemic fix, and regression guard before editing. Ask the user before applying a systemic fix that changes scope, ownership, release, timeline, or quality bar.

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
- No writing files in non-UTF-8 encoding — ALL files must be UTF-8 without BOM (see docs/SHARED_CONVENTIONS.md)
- No mojibake, replacement characters, or mixed line endings in tracked text — run `node scripts/validate-text-policy.js`
- No raw `uname`, `/tmp`, or `mktemp` outside `scripts/lib/platform.sh` — use platform helpers so Windows is never treated like Linux

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
4.6.2 - Run `bash scripts/check-drift.sh` to verify health.

## Compaction
After compaction: `bash scripts/context-restore.sh` to recover mode + task + rules.
