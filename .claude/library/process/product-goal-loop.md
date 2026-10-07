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
