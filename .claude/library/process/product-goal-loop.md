# Product Goal Loop

## Purpose
Keep long product work coherent across turns, compaction, agents, and downstream projects.

This is not a "final slice" model. Agents naturally split work into bounded steps. The goal loop preserves the final product target while each step stays small, reversible, and verifiable.

For client-facing plans, status, replans, and closeouts, also follow
`.claude/library/process/client-executor-contract.md`: the user owns outcome,
priority, and acceptance; the agent owns honest execution, risk surfacing,
professional pushback, and evidence before claiming work is done.

## When Required

Use the full loop for substantial product work, meaningful cross-boundary or
high-risk changes, long-running tasks, and explicit goal/roadmap/production
requests. For small edits or direct answers, preserve the relevant goal and
verification in the work itself without creating a goal artifact or reciting a
template.

## Language Rule
Plans, audits, checklists, user-facing status, and final reports must use the language of the user's request. Keep code identifiers and commands in their native language.

## Goal Artifact

If `tasks/goal.md` exists and informs the current decision, read it. Create or
propose one when a substantial product effort needs durable goal continuity;
do not create one solely because a product file changed.

The artifact must stay concise and include:

```markdown
# Product Goal

## Final Outcome
[What the finished product lets the end user do.]

## Product/Business Priority
[Primary product user, user experience outcome, and app-specific revenue, loyalty, retention, conversion, activation, or KPI impact when relevant.]

## Quality Bar
[UX, security, privacy, performance, design-system, data, docs, domain constraints.]

## Current Step
[What this turn or task moves forward.]

## Dependencies
[Systems, services, design tokens, APIs, deployment, people, or unknowns.]

## Open Risks
[What could still make the goal fail.]

## Out Of Scope For Current Step
[Honest exclusions, not hidden product debt.]
```

## Operating Loop

For work that uses this loop, restore relevant goal/handoff context, identify
intent and acceptance, route only as useful, plan the current step and risks,
execute without lowering the final quality bar, verify with evidence suited to
the domain, and update durable artifacts only when the goal, status, or lesson
actually changed. These are decision aids, not required spoken phrases or a
fixed ceremony for every task.

Before choosing a technical improvement, name the product user and the business outcome it improves or protects. Technical perfection, refactoring, tooling, and architecture cleanup are valid only when they directly support user experience, revenue, loyalty, retention, activation, risk reduction, or another app-specific KPI.

For substantial staged product work, structure three levels. Agree the first
two with the user, then derive and record the nearest-wave plan autonomously
within the accepted scope:

1. **End result:** audience, capability, acceptance, and constraints.
2. **Approximate product waves:** successive usable versions of the same product
   toward the final result, and why the sequence is sensible. The count may change when
   evidence changes the plan.
3. **Nearest wave:** a clear implementation plan with dependencies, owners,
   file boundaries, responsibilities, acceptance evidence, and bounded
   subagent instructions when delegation adds value.

Follow the product-wave semantics in `.claude/library/process/plan-first.md`.
Keep final outcome -> product versions -> technical tasks distinct. A complete
internal route is not a product version; experiments return decisions, not
delivered waves. When constraints change, reassess the final target and remaining
versions together and update the existing plan after material owner decisions.
Within an accepted wave, proceed autonomously on routine
implementation choices. Seek approval for a material change to the promised
result, constraints, or meaning/order of waves, and present the proposed delta.
Do not reopen an existing approved plan or AgentOS graph without evidence that
one of those changed.

Do not claim `Done` unless the verification evidence exists. If evidence is
missing, label the step `Partial`, name the exact gap, and state the next
verification action.

## Progressive JPEG Checkpoint

For long-running, high-risk, or explicitly staged work, give the client an
early useful view and make evidence, rough edges, and replan triggers visible.
For routine work, a concise progress or final note is enough:

- Current view: what is already inspectable, usable, or decidable.
- Next sharpened layer: which evidence, artifact, or behavior will become clear next.
- Rough edge: what remains incomplete, uncertain, or unverified.
- Replan trigger: which new fact changes scope, deadline, quality bar, or path.

If only internal setup happened, report it as internal setup and name the first
client-visible result. Setup, research, or drafting can create an inspectable
decision point; that is still an enabling checkpoint, not a delivered product
version unless the decision artifact itself is the explicitly requested product.

When a task changes documents governed by a project-specific progressive status
contract, follow that contract. For larger staged work where the status tool is
useful, include the project slice from:

```bash
node scripts/progressive-status.js
```

The slice should be shown as a monospace table with aligned ASCII bars for
readiness, plan, inventory, production, and cleanup. Before closeout, run:

```bash
node scripts/progressive-status.js --check
```

If the applicable project contract requires a status header, update and check
it when the governed document changes.

## Progressive JPEG Implementation Gate

For staged product work, preserve the accepted destination and contracts while
keeping each current step proportionate. Add future-facing interfaces or
callable seams only when accepted architecture makes them relevant to this
change; do not scaffold speculative capabilities. Resolve an architectural
decision before committing to a path only when the current change depends on
that decision. Use `$codex-progressive-jpeg-planner` when an iteration plan is
actually needed; its machine-readable validator is not a blanket implementation
gate.

### Anti-Falsification Gate

When claiming that a product increment delivers a user outcome, provide
evidence for that outcome at the scope claimed. If the step is enabling work,
describe the dependency or risk it addresses and the next useful result instead
of calling it a delivered product slice.

Planning, research, architecture, scaffolding, migration, status, tests, mocks,
stubs, debug output, HTTP success, and inventory completeness are enabling
checkpoints, not product slices. Callable seams preserve architecture but do not
prove user value. The slice outcome must not depend on a stub, and evidence must
never be fabricated or replaced with the agent's own claim.

For a readiness assessment, compare the accepted plan and observed result, and
classify only the gaps relevant to the claimed level. Do not infer completeness
from inventories or percentages.

Progressive layer replacement gate:

- Keep placeholders only when they protect an accepted contract or transition;
  identify an owner and removal condition when temporary.
- Replace or delete wrong earlier iterations, obsolete scaffolds, disabled
  branches, stale feature flags, commented-out old implementations, skipped
  tests, and release-only exclusions.
- Do not add tests that merely prove stale code is disabled. Tests should assert
  the intended final contract and, when useful, the absence of obsolete paths.
- Allow temporary migration or rollback scaffolding only when it protects live
  users, data, or compatibility, stays outside the normal product path, and has
  an explicit removal condition.

Use domain-specific examples as checks for a requested outcome, not as
requirements to prebuild the whole object's future skeleton.

## Product Slice Discipline

Current steps must not pretend to be the whole product. Use these labels:

- `Done`: verified and usable as part of the final product.
- `Partial`: intentionally incomplete, with explicit next dependency.
- `Blocked`: cannot progress without user input or external state.
- `Rejected`: would lower the product quality bar or conflict with the goal.

Never call a partial step "done" just because the code compiles.

## Delivery observation and recovery

For long-running work, review current evidence at the cadence configured by the
shared runtime and report every tracked project at each scheduled report,
including projects with no material change. The shared runtime's configured
cadence is 10 minutes; keep it in machine configuration, not as a timer copied
into any project or task. On material progress, a new blocker, or closure,
report sooner.

Signal material delivery changes promptly: a verified useful source/artifact
change, accepted user-path behavior, resolved dependency, or outcome/release
evidence that advances a required gate. Keep operational liveness and material
progress separate. A fresh tool result, read, shell command, status ping, or
runtime heartbeat proves activity only; it does not prove a useful change. A
test result is verification evidence; it advances delivery only when it newly
closes a required gate or changes the diagnosed next action. Do not reset the
material-progress clock for activity-only signals. A repeated failed check
follows the existing Correction Loop and its strategy breaker, not an indefinite
retry. After two failed attempts, reassess the cause and boundary; repeating the
same failed check is evidence, not progress.

Before classifying a task, bind the observation to the current request/turn and
owner fence; inspect the latest tool result and raw outcome, relevant artifact
evidence, and the owned runtime/process state. Report operational activity
separately from material progress, with the declared deadline and accepted
deliverable. An explicit pause or choice, genuine external blocker, and
completed accepted deliverable are distinct states; a completed conceptual
deliverable needs no live process. If only elapsed time or stale status suggests
inactivity, label liveness `STALL_SUSPECT`, then refresh current evidence. This
label is not a claim that the process is dead. Fresh activity may defeat a stale
stop/cancel decision, but does not prove delivery or reset the material-progress
clock. A known long task still within its declared deadline is not stalled merely
because it has produced no new output; preserve it unless fresh evidence proves
a separate owned-runtime failure.

Each report names the current owner and work, material signal since the last
review (or "unchanged" with its evidence time), exact blocked layer and owner,
and the nearest authorized next task or wave from the existing goal/task graph.
Do not invent a competing plan. Follow `plan-first.md` for independent useful
work while a gate waits and this file's closure rules for carryover and partial
independent shipping. A capacity watcher reports resource pressure separately;
capacity signals do not establish agent liveness or authorize a restart.

Stop or restart a stuck worker only after fresh evidence confirms the current
session/request ownership, the latest tool is settled, the owned runtime is
stuck, and no competing writer or operation remains. Where the current host
exposes a verified session-control API, use it for a bounded same-session
stop/restart or resume with history; do not invent an RPC or kill a PID. If
ownership or supported control is unknown, preserve the process and escalate
to the root owner.
Deduplicate reports by incident, use a finite backoff and restart budget, and do
not poll or restart indefinitely. A user-authorized recovery within the same
scope needs no second approval; ask only for a new material decision.

## Closure, carryover, and next action

At each wave closure or newly material blocker, run a bounded review against
the existing goal or task graph. Reconcile completed and open findings with
the persona/job, journey, state/transition map, backlog, and viable
opportunities; then select the next wave, record what is deferred and why, and
preserve the original goal. Keep the evidence chain inspectable: persona/job
(AI-generated personas remain hypotheses) -> journey -> relevant states and
transitions -> evidence-backed finding -> source change -> outcome proof ->
release decision. Keep stale findings open until fresh evidence resolves them.
Delta-audit the affected journey unless evidence invalidates the baseline.

Distinguish three claims: **iteration closed** means the bounded task met its
own acceptance; **release accepted** means the named release surface passed its
dependency and rollback gates; **product goal achieved** means the agreed
end-user outcome is verified at its stated scope. One claim does not imply
another. `PARTIALLY_DELIVERED` means at least one, but fewer than all,
predeclared baseline outcomes were actually shipped. Accepted source work that
has not shipped is not delivery: close it as `ITERATION_CLOSED`, or
`CLOSED_WITH_CARRYOVER` when an outcome remains open. `SCOPED_RELEASE_ACCEPTED`
and `PRODUCT_GOAL_ACHIEVED` require their respective accepted-and-shipped
outcomes. Preserve separate accepted and shipped counts against the declared
baseline denominator and count basis; source acceptance or a percentage alone
is never shipped evidence.

For each carryover, retain its original owner, evidence, impact, severity,
dependency, and next-wave placement. Keep unresolved assertions and their
regression checks; never remove or weaken a failing assertion to make a
carryover disappear. **Example:** 9 of 10 baseline outcomes may ship when each
shipped outcome is independently deployable, accepted, and passes its API,
schema, auth, shared-configuration, user-path, and rollback gates. The isolated
tenth remains owned carryover for the next wave; isolation must be proven across
dependencies, and it does not justify dropping its failing check. If a shared
auth or migration gate affects the other nine, those dependent outcomes cannot
ship yet.

Release scope follows real dependency boundaries. Independently deployable,
accepted units may ship while unrelated units remain open when each unit's API,
schema, auth, shared configuration, user path, and rollback gates pass. A shared
repository, host, queue, or server writer does not by itself make all units
all-or-nothing. An unsafe shared auth or migration boundary blocks its dependent
units; percentages and counts never grant release authority.
When an independent unit has its required evidence and existing release
authority, advance its scoped release at the next nonconflicting opportunity;
do not wait for unrelated units. Serialize conflicting operations only.
Freeze the scoped release candidate while the next wave proceeds in disjoint
files/resources; do not let next-wave work mutate the candidate under review.

Repeated capacity, storage, build, or deployment blockers require a decision
based on measured alternatives and their benefit, cost, privacy, compatibility,
and rollback; do not poll indefinitely. Compare practical options such as
smaller units, incremental delivery, export-only or already-ready artifacts,
the actual authorized CI/CD or remote path, and different slices or resources.
Do not create duplicate copies or assume paid use, uploads, deletes, or network
mutations are authorized. Ask once when a material decision is missing, with
concrete prepared choices. Meanwhile, proceed only with an already authorized
independent next action that preserves the blocked gate and shared owners.

For substantive closeouts that need a durable machine handoff, use
`.claude/library/process/task-wave-handoff.schema.json` through
`node scripts/codex-turn.js handoff --state <request.json> --artifact <exact-final.txt> --result <handoff.json>`.
The record carries baseline/count basis, accepted outcomes, shipped units,
remaining severity/impact, and next-wave selection separately. Schema validity
checks structure and evidence references; it does not itself accept a release
or prove the user outcome. This handoff is not required for routine small work.

## Correction Loop

After user correction:

1. Classify the failure: misunderstanding, product gap, design gap, technical bug, process gap, or stale context.
2. Classify the shape: local typo, broken contract, repeated error, architecture/workflow smell, or SOT conflict.
3. For repeated, boundary, architecture, or HIGH-risk failures, name the broken
   link and root-cause hypothesis before editing.
   Record the smallest systemic fix and the regression guard it requires.
4. During reading, run a bounded repair-path check over the affected path and
   direct consumers. If causal system evidence exists, run Change Strategy
   before the first patch. Reroute once only when pipeline, risk, or approval
   authority changes.
5. After a second failed repair, compatibility shim, stale-path test, or
   architecture drift, run `.claude/library/process/change-strategy-gate.md`.
   Compare destination and transition alternatives before another patch.
6. Update `tasks/lessons.md` when the failure is reusable.
7. Re-check the goal and current step before editing again.
8. State what changed in the plan.

Do not keep patching local symptoms when the same error points to a broken
module boundary, stale SOT, missing validator, weak architecture, or failed
feedback loop. Fix the system path or ask for a product-owner decision when the
systemic fix changes scope, ownership, release, timeline, or quality bar.

The Change Strategy Gate may continue automatically for reversible internal
replacement that preserves protected contracts. It must ask the product owner
when user behavior, data, public contracts, security, release, scope, cost,
timeline, or irreversible state changes. "Smallest reversible step" means the
smallest move toward the accepted final system, not the smallest diff.

## Verification Examples

- Product nav: click from main entry to service, authenticate if needed, reach useful screen, return to home, and handle logged-out state.
- Design system: check token tables, component dependencies, rendered geometry, interaction states, and responsive behavior.
- Auth: verify real form fields, locale, redirect, token validation, expired session, logout, and privacy contract.
- Docs: verify linked routes, layout, CSS/JS MIME, 404, and whether docs content answers the user journey.
