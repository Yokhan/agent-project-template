# Agent-Ready Project
<!-- Template Version: 5.0.2 -->

## Status
**NEW_PROJECT** — Run `/setup-project` or say "настрой проект" to configure for your stack.

Preserve existing dirty work: inspect affected changes before editing; never overwrite unrelated user or project-owned work.

## Philosophy — Quality Over Speed
1. **Think before you type.** Research and planning ARE the work. Code is just output.
2. **Doubt is a feature.** Surface uncertainty. Enumerate alternatives before choosing.
3. **Slower is faster.** 30-min plan saves 3h rework. Test scenarios prevent production bugs.
4. **One thing done well > three halfway.** Finish, verify, commit before starting next.
5. **Resolve routine uncertainty safely.** Research and choose a reversible
   option within the accepted scope; ask only when a missing choice materially
   changes outcome, risk, data, release, cost, or irreversible state.

Slow down: shared/core, can't articulate WHY, 3+ iterations, HIGH/CRITICAL risk.
Speed OK: XS+LOW, covered by tests, following approved plan.

## Production Product Standard

Real product work is never treated as MVP/prototype work unless the user explicitly asks for a disposable experiment. Bounded implementation steps are fine; lowering the final product quality bar is not.

Plans and improvements prioritize the real product user's experience and app-specific business outcomes first: revenue, monetization, conversion, activation, retention, loyalty, support load, or the KPI that matters for that application. Technical perfection, refactors, tooling, and architecture cleanup come second unless they directly unlock, protect, or measurably improve those outcomes.

Treat the user as the client/product owner and the agent as the accountable executor: do not agree by default, do not claim unverified work is done, and challenge requests that would lower the outcome, safety, quality, or KPI. Full rule: `.claude/library/process/client-executor-contract.md`.

For long-running, high-risk, explicitly staged, or material scope-changing work,
use progressive JPEG delivery: show a useful view, evidence, rough edges, and a
replan trigger. Follow `PROGRESSIVE_STATUS` tooling when the project workflow
requires it; routine edits and brief answers do not need a status ritual.

For staged product work, use `$codex-progressive-jpeg-planner` when a plan is
useful. Waves are successive usable versions of the same product toward the
agreed final outcome, not technical task bundles. Semantics and replanning:
`.claude/library/process/plan-first.md`. Preserve the production quality bar and distinguish enabling work from
verified user outcomes. Add future contracts or callable seams only when they
are accepted architecture and relevant to the current change; do not prebuild
speculative behavior. A stub, test, screenshot, or status is not by itself
product evidence, and claims must match what was verified.

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

**SOT conflict protocol:** if plausible sources conflict, identify their authority (user instruction > project-owned `project-*` or AgentOS graph > repo SOT docs > shared template rules > historical notes > examples). Continue safe research; ask with options only if the conflict remains material to product behavior, safety, data, release, scope, or architecture.

**Thinking tools:** use a system map or decision framework when it can change a
material choice. Use TRIZ when requirements genuinely conflict; use a terrain
check for a requested competitive strategy, not routine implementation. For
meaningful uncertainty, identify the next useful checkpoint and replan when an
assumption breaks. Never use strategy language to justify deception, dark
patterns, or user-hostile manipulation.

**Context routing:** for work where project context or specialized rules can
change the result, use `get_context` or `bash scripts/route-task.sh`, then load
only relevant rules and artifacts. Expand discovery for unfamiliar,
cross-project, or high-risk work. A simple local edit or direct answer does not
need a full context scan.

**On task switch**: `switch_context(keywords="...")`
**After compaction**: `get_active_rules()`
**Fallback (no MCP)**: `bash scripts/route-task.sh "<keywords>"` + Read listed files
**Manual**: `/mode-code` `/mode-design` `/mode-review` `/mode-research` `/mode-write` `/mode-fix` `/mode-plan`

Codex route fallback uses exact patterns plus semantic intent scoring in `scripts/lib/codex-route-intents.js`. Misroutes must be fixed in the intent model with regression fixtures, not only by adding one literal keyword.

Writing uses `.claude/skills/writing-workflow/SKILL.md` and the writer agent. Select literary, marketing/advertising, informational, or communication mode by the reader's job; a functional 1% text must already perform its production purpose. Resolve the target language and keep language/editorial, process, domain, and technical profiles separate. Russian output loads `russian-writing-profile.md`; English standards cannot define Russian voice or syntax. Never fabricate facts, proof, citations, deliberate human imperfections, or AI-detector claims.

Substantive nonfiction and explanatory chat answers require fresh relevant
primary passages and concrete application before drafting/review; see
`.claude/library/technical/writing-source-grounding.md`. The six-source machine
library stays outside projects/releases. Missing/stale sources block grounded
writing, not permission to use memory. Actual fiction/lore prose is exempt;
its commercial, technical or project-planning artifacts are not. Code-only work
and small acknowledgements do not need a book ritual.

External writing services are separate from sources and profiles. Without configured access and a successful response tied to the current artifact, never claim a Glavred check, score, warning list, or provider result; label public-method editing as manual.

During initial bugfix reading, run a bounded repair-path check over the affected
path and direct consumers. If causal evidence already shows architecture drift,
wrong SOT/ownership, duplicate state, an obsolete path, or a compatibility-only
layer, run the gate before the first patch. A second failed repair remains the
mandatory fallback breaker. Use
`.claude/library/process/change-strategy-gate.md`. Protect verified contracts,
not implementation; choose destination separately from transition with objective evidence and
ask only for material product, business outcome/KPI, data, public-contract, security, release, scope,
cost, timeline, or irreversible tradeoffs. Notify the user whenever the gate
fires, including automatic reversible internal replacement.

Technical writing remains an informational or communication specialization. Use
the technical-writer agent and technical-writing skill, select registry profile
IDs, verify code/schema/version/OS, execute procedures, and require an independent
technical review for M+, public, operational, or version-sensitive work. Generic
API docs do not activate OpenAI guidance without an OpenAI/GPT/Codex/Responses
vendor anchor.

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
| `мы опять чиним то же самое` | Change Strategy Gate | Posture, protected contracts, destination/transition evidence, approval boundary |
| `проверь маркетинг` | GTM/communication review | ICP, positioning, offer, funnel, channel, proof, measurement, ethics |
| `примени Сунь-цзы/стратагемы` | Competitive strategy | Terrain, center of gravity, asymmetry, timing, no dark patterns |

## Template Update Protocol

For `обнови шаблон`, `/update-template`, or a repository-link handoff, follow
`docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol`: classify source vs
downstream, read installed manifest version, resolve one explicit stable tag,
  verify remote/worktree, build an external digest-bound plan with the target
  release's native updater, apply that exact plan, then verify
manifest version, diff, overlays, conflicts, and checks. Bare `--from-git` is
  canary-only. Never trust a stale downstream updater; run the target release
  checkout's `sync-template.js` against the explicit project path. Never infer
  a published release from an unverified tag.

## Session Start
Restore current task context when continuing work. Use the context helper when
the project, handoff, or active work may affect the next action; skip unrelated
memory/history scans for a self-contained request.

## Session End
For interrupted or multi-step work, update the active handoff with status,
changed files, what remains unverified, and the next step. Use Engram session
helpers when the current project workflow uses them.

## Work Report Style
Final reports about completed work must follow `.claude/library/technical/writing.md`, especially the client-facing report rules: lead with result, explain the effect in the reader's world, keep technical detail only when it changes a decision, and default to `Что было → Что стало → Что это даёт → Чего ожидать дальше`.

## MCP Memory (Engram)
Use project memory when it contains context relevant to the current task or
when the project workflow calls for a durable decision/handoff. Do not save each
routine observation or make a memory lookup a prerequisite to unrelated work.

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
Code intelligence is task-routed: use the `CODE_INTELLIGENCE` workflow returned by the context router instead of enabling redundant MCP indexes.

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
When a correction reveals a reusable failure, classify it and record the cause
and a useful regression guard in `tasks/lessons.md` according to the project
workflow. Routine edits and one-off preferences do not require a lesson entry.
Use `/weekly` when the project uses it to distill a large lessons backlog.

## Systemic Error Analysis
When an error, failed check, regression, or correction appears, classify it while reading and before patching: local typo, broken contract, repeated error, architecture/workflow smell, or SOT conflict. A bounded repair-path check covers the affected path and direct consumers without demanding a general architecture proof. If causal system evidence is already present, run the Change Strategy Gate before the first patch; reroute once only when pipeline, risk, or approval authority changes. After a second failed repair, the gate is mandatory. Record the decision in the active orchestrator artifact; optional `tasks/change-strategy.json` decisions must pass `node scripts/validate-change-strategy.js`. Ask only when the selected destination or transition changes a material client-owned tradeoff.

## Token Economy
- Verification cadence SOT: `.claude/library/process/self-verification.md`.
  Choose focused checks and broad acceptance before a useful wave. Run focused
  checks after coherent batches; the parent alone owns broad integration at the
  wave boundary. No full-suite rerun after each minor edit or duplicate worker
  run. State concrete invalidation before any broad repeat; reuse scoped evidence
  as baseline plus delta, not a current-tree full pass. Mandatory gates remain.
- Trust skills/memory over re-reading. Don't re-read files you read this session.
- Only read files you WILL use. Parallelize independent tool calls.
- Delegate only independent work with material parallel value and exact scope.
  After two failed approaches, re-diagnose instead of resetting context or
  repeating local variants.
- For a paused multi-step task, leave a concise handoff with status, files,
  unverified work, and next steps; no new session is required for routine task
  switching.

## DON'T
- No `any` — use `unknown` + type guards
- Prefer immutability when it improves clarity and safety; mutation is allowed
  when it is the clearest established pattern and its effects are understood.
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No business logic in entry points — use functions-in-modules pattern (see docs/SHARED_CONVENTIONS.md)
- No presenting solutions without proportionate self-verification
- No "you're right!" without logging WHY
- Check `_reference/tool-registry.md` when reuse or an existing shared utility
  could affect the design.
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
5.0.2 - Run `bash scripts/check-drift.sh` to verify health.

## Compaction
After compaction: `bash scripts/context-restore.sh` to recover mode + task + rules.
