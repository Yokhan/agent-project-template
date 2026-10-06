# Plan-First Protocol

Plan enough to choose and verify the next action. A direct answer or small,
reversible, low-risk edit usually needs no written plan. Use a concise written
plan when work spans modules, has meaningful uncertainty or risk, changes a
public/data/security/release boundary, or needs coordination. Keep product,
design, writing, and other domain quality standards in their relevant guides.

Plans, audits, and reports use the language of the user's request.

## Useful plan contents

For substantial work, record only what helps execution and acceptance:

- desired outcome and explicit scope/non-goals;
- affected files, owners, direct consumers, and dependencies;
- selected approach and material alternative, when the choice matters;
- acceptance evidence and checks proportionate to risk;
- reversibility, migration, or rollback needs;
- next useful result, remaining uncertainty, and a replan trigger when work is
  staged or long-running.

For a substantial product effort with multiple implementation waves, structure
three levels before execution. Agree the first two with the user; derive and
record the detailed nearest-wave plan within that accepted scope:

1. **End result:** audience, capability, acceptance, and constraints. Keep this
   at outcome level; do not pre-plan every implementation detail.
2. **Approximate waves:** an adjustable sequence of useful outcomes and why
   that order makes sense. The number and contents may change as evidence
   arrives.
3. **Nearest wave plan:** dependencies, ownership, files, responsibilities,
   acceptance evidence, and any bounded worker contracts needed to execute it.

An agreed wave must deliver a whole useful result at its declared scope, or be
an explicitly bounded uncertainty experiment that returns an inspectable
decision. Internal enabling tasks may be smaller, but do not present them as a
wave result. Once a wave is accepted, make routine implementation decisions
autonomously within its outcome and constraints. Ask approval for a material
change to the promised result, constraints, or meaning/order of the waves; ask
for the delta, not for minor choices already inside the accepted plan.

Keep small fixes direct. Preserve an existing approved plan and project-owned
task graph; update them only when evidence changes the accepted outcome,
constraints, wave sequence, owner, or acceptance. AgentOS remains the planning
source of truth when present.

Use the active project task artifact if one exists. Do not create or update
`tasks/current.md`, a goal file, or a separate plan merely to satisfy this
template when the project has no such workflow and the task does not need it.
AgentOS or project-owned task graphs remain authoritative when present.

## Change-strategy decision

Use `.claude/library/process/change-strategy-gate.md` before another patch when
causal evidence shows a broken ownership/contract boundary, obsolete path,
compatibility-only layer, architecture conflict, or after two failed repair
approaches. Compare destination and transition separately, identify protected
contracts, use evidence rather than line count as the reason, and ask the user
only for a material tradeoff outside accepted scope.

## Files and modules

Search for an existing equivalent before creating one. Follow the project's
language and architecture conventions. File/function length, export count,
and boolean-argument heuristics are prompts to inspect cohesion and call-site
clarity, not universal limits. Split or refactor when the actual responsibility,
change rate, coupling, or reviewability warrants it; do not fragment code to
meet a number.

## Test and verification design

Choose checks that can detect a failure relevant to the changed behavior.
Before a material implementation, identify the important success path and the
highest-value edge/error or regression case. Expand scenarios for risk and
integration depth; do not require a fixed number of tests for every module.
Plan evidence before making a completion claim, and distinguish a blocked or
unavailable check from a pass.

## Replan

Update the active plan when a new fact changes scope, owner, approach, risk,
acceptance, or the next dependency. After two failed attempts, stop repeating
local variants and diagnose before choosing a new path. Surface material drift
early; safe, reversible work inside the accepted scope may continue without an
approval ritual.
