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
2. **Approximate product waves:** successive usable versions of the same
   product toward that end result, and why each increase in resolution matters.
   The number and contents may change as evidence arrives.
3. **Nearest wave plan:** dependencies, ownership, files, responsibilities,
   focused checks, broad acceptance owner/check, acceptance evidence, and any
   bounded worker contracts needed to execute it.

## Product wave semantics — source of truth

A wave is a product-level increase in resolution: the same product serves its
intended audience and purpose at a more useful, complete, reliable, or accessible
level. Define versions from the agreed final result downward, then derive tasks
for the nearest version. Never group convenient technical tasks first and
invent a product story to justify the bundle afterward.

Keep three levels distinct: **final product outcome -> successive product
versions (waves) -> implementation tasks/checkpoints**. A technical vertical
slice, internal end-to-end route, sprint, test batch, or swarm dispatch is not
automatically a product wave. Even a real narrow user action must be related to
the accepted version of the whole product; merely naming an actor is not enough.

Before accepting a proposed wave, answer in the existing plan/context:

- Which agreed final outcome and product purpose does this version advance?
- What can the intended user actually obtain now, compared with the previous
  version, and how can they access it?
- What remains from the same product, what becomes deeper/broader/more reliable,
  and what is explicitly not offered yet?
- What observation accepts this version, and why is this the next version?

If these answers are unknown, restore the product plan or resolve the missing
decision. Do not fabricate a player/customer goal or call an internal route a
product route. Necessary technical work may proceed within authorized scope,
but label it as enabling work and name the supported wave or unresolved link.
Research and bounded experiments return knowledge/decisions, not delivered
product versions; record them as checkpoints with a question and limit.

Example: one cafe website first tells visitors which cafe is opening soon;
later it helps them decide to visit using location, hours and menu; later they
can order, if ordering belongs to the agreed target. All are versions of the
same cafe/customer relationship, not three unrelated products. The first version
needs no fake order button, lead form, or complete future skeleton. It must
honestly deliver its agreed announcement, not claim ordering is finished.

Counterexample: moving a game resident's equipment/hauling/returning fields to
one owner while preserving gameplay is an internal migration. A complete
resident route and passing save/load tests establish a technical contract, not
a new game version. Explain which accepted player-facing wave this supports.
A measured reliability improvement can be a product version when that user
promise is explicitly accepted; tidier internals alone cannot establish it.

Small fixes remain tasks; they do not need to become miniature waves. Choose
proportionate checks and close the task without inventing a product roadmap.
Once a wave is accepted, make routine implementation decisions autonomously
within its outcome and constraints.

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

Follow `.claude/library/process/self-verification.md` for cadence: check coherent
batches narrowly inside the useful wave, then let the parent/integrator own its
broad acceptance at the boundary. Do not redefine each patch as another wave.
Record command/result/scope/tested state in existing task context; reuse that
evidence only where later changes have not invalidated it. State a concrete
reason before a broad repeat. A list of checks is not an instruction to rerun
every contained check separately or after every internal step.

## Replan

When requirements, budget, deadline, audience, dependencies, or evidence change,
reassess both the final target's feasibility and the remaining wave sequence.
State what stays, what changes, why, and the impact on the nearest version and
its tasks. Do not silently shrink the final promise to fit completed work.
Propose material changes to target/constraints/wave meaning or order for owner
approval; a new user instruction can supply that approval. Then update the one
existing plan/AgentOS graph and dependent worker contracts, not a parallel plan.

Update the active plan when a new fact changes scope, owner, approach, risk,
acceptance, or the next dependency. After two failed attempts, stop repeating
local variants and diagnose before choosing a new path. Surface material drift
early; safe, reversible work inside the accepted scope may continue without an
approval ritual.
