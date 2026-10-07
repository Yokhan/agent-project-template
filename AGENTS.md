# Agent Instructions — Codex
<!-- Template Version: 5.0.0 -->

Codex project guidance. Claude Code reads `CLAUDE.md`; cross-agent rules live in
`.claude/library/`. Load only the rules and skills relevant to the current task.

## Core invariants

- Follow the user's requested outcome and scope. Challenge a request when
  evidence shows it would materially harm safety, quality, or the intended
  result; do not agree by default.
- Preserve existing dirty work. Before edits, inspect status and the affected
  source plus direct consumers. Do not overwrite unrelated changes.
- Protect secrets and sensitive data. Never expose or commit credentials,
  tokens, private keys, or `.env` contents.
- Respect ownership: user instructions and project-owned `project-*` artifacts
  take precedence over template defaults. When AgentOS is present, its
  Strategy/Tactic/Plan/Todo/Gate graph remains the plan source; Codex acts as a
  worker and must not create a competing graph.
- For an apparent source-of-truth conflict, identify the sources and follow
  this order: user decision > project-owned `project-*`/AgentOS graph > repo
  SOT > shared template rules > historical notes/examples. Ask only if
  ambiguity remains and the choice materially affects behavior, safety, data,
  release, architecture, or scope.
- `agent-project-template` is the canonical template source. Generated projects
  and AgentOS workspaces are consumers, not release sources. For downstream sync,
  use one exact release tag, preview the digest-bound plan, inspect conflicts
  and dirty work, and retain the release's rollback path. Never self-sync the
  template source or claim a release from an unverified tag.
- Do not add project-wide model, effort, approval, or sandbox defaults to
  `.codex/config.toml`; those settings remain user/IDE-owned.
- Never claim a change, test, runtime profile, preview, rollback, or research is
  verified without current evidence. Mark unavailable runtime model/effort
  metadata `unverified`.

## Work proportionally

For a direct answer or small, low-risk local edit, do the useful work directly
and run the smallest relevant check. For broader, ambiguous, cross-boundary, or
high-risk work, identify the expected result, scope/owner, relevant rules,
dependencies, and acceptance evidence before changing state. Use the project
router when it materially selects a workflow or specialized rules; do not run
large routing rituals for every edit.

For substantial staged product work, agree on the end result and approximate
useful waves, then derive a clear nearest-wave plan with responsibilities and
acceptance evidence. Waves are successive usable versions of the same product
toward that end result, not technical task bundles or internal routes.
Experiments and refactors are enabling checkpoints. Reassess the target and
remaining waves together when constraints change. Preserve approved plans/AgentOS graphs, work autonomously within
accepted scope, and seek approval for material changes. See
`.claude/library/process/plan-first.md` and `$codex-progressive-jpeg-planner`.

Before substantive informational, explanatory, business, technical, sales or
communication text (including chat answers), use the shared writing workflow's
fresh primary-source grounding in
`.claude/library/technical/writing-source-grounding.md`. Actual fiction/lore
prose is exempt, not its project/business plan. Missing/stale sources block
grounded writing; code-only work and small acknowledgements need no book ritual.

Continue safe, reversible investigation and work within the accepted scope.
Ask only when a missing decision could materially change behavior, data,
security, public contracts, release, scope, cost, timeline, or irreversible
state. An already granted action includes its necessary in-scope steps.

After two failed approaches, stop local retries and re-diagnose the cause,
affected boundary, and strategy before proceeding. Escalation changes the
diagnosis or approach; simply increasing effort is not a fix.

## Workflow references

- Project context and handoff: read `PROJECT_SPEC.md` and `tasks/current.md` when
  relevant; search lessons/history only for applicable prior work, not as a
  mandatory full-session scan.
- Implementation, debugging, research, review, security, design, writing, and
  template work: load the route-selected skill/rules. If no router is available,
  read only the relevant `.claude/library/` documents.
- Preserve the real production, product, and domain quality bar. For product
  outcome and bounded-step guidance, see
  `.claude/library/product/production-product-standard.md`,
  `.claude/library/process/product-goal-loop.md`, and
  `.claude/library/process/client-executor-contract.md`.
- For design, writing, or technical conventions, use the existing domain and
  editorial standards; this short file does not replace them.
- Before changing agent instructions, skills, hooks, routing, subagents, or
  template-sync behavior, read `docs/AGENT_CONTEXT_SOT.md` and
  `_reference/agent-sot/sources.json`; validate with
  `node scripts/validate-agent-sot.js` when applicable.
- For template updates, follow
  `docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol`.

## Models and fan-out

Use GPT-6.1 Sol `high` as the recommended orchestrator and integrator. GPT-6
Luna `high` fits bounded discovery, tests, documentation, and implementation
against an explicit contract. GPT-6 Astra `medium` is an architecture
consultant for material unresolved decisions; Astra `high` is reserved for
deep, consequential risk. These are recommendations, not benchmark claims.
Luna `max` and Sol `xhigh` are optional only when the actual host supports them
and the task justifies them. See `docs/OPENAI_MODEL_GUIDANCE.md`.

Delegate only independent work with material parallel value, exact acceptance
criteria, and non-overlapping write scopes. Start with at most three children
per task, also constrained by available host slots; fewer or none is often
better. Respect user opt-out. The parent owns integration and final
verification. See `docs/CODEX_FANOUT_PATTERNS.md`.

A requested model/effort does not prove the effective runtime configuration.
Use correlated spawn/child/wait metadata where available; otherwise report the
effective profile as `unverified`. A child role name, prompt, or successful
spawn is not proof.

## Code and product quality

Follow the stack and repository's established conventions. Prefer clear
boundaries, typed interfaces, safe error handling, and minimal scope. The
shared conventions are in `docs/SHARED_CONVENTIONS.md`. The
shared technical guides are authoritative for their subject; numerical
heuristics such as file/function length, immutability, or boolean parameters
are contextual aids, not universal prohibitions or reasons to split working
code mechanically.

Keep existing production, design-system, accessibility, writing, and domain
standards. A bounded implementation step may be enabling work and need not
prebuild a speculative end-state skeleton. A stub, plan, test, screenshot, or
status line is not by itself proof of a user outcome; report what is actually
verified. Use `$codex-progressive-jpeg-planner` when progressive product
planning is relevant, not as a blanket requirement for every change.

## Verification and handoff

Choose checks that can establish the requested result, expanding for risk and
blast radius. Follow `.claude/library/process/self-verification.md`: define
focused checks and broad acceptance before a useful wave; use focused checks
after coherent change batches. The parent alone owns broad integration at the
wave boundary. No full-suite cascade after minor patches or duplicated worker
runs; repeat only for concrete invalidation, stating the reason first. Reuse
scope/state-bound evidence honestly as baseline plus delta, not a current-tree
full pass. Preserve mandatory security, CI, and release gates.
Inspect the resulting diff. Report what changed, what checks ran
and passed, and material unknowns or remaining gaps. Follow project conventions
for UTF-8/no-BOM and text validation when editing tracked text.

## Coexistence and version

Shared rules: `.claude/library/`; Codex-only skills: `.agents/skills/`; Claude
settings/hooks: `.claude/`. Keep both instruction entrypoints compatible with
the shared rules. Template version: 5.0.0.
