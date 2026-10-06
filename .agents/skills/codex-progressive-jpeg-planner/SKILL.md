---
name: codex-progressive-jpeg-planner
description: "Plan evidence-led progressive iterations when a user asks for a roadmap, staged delivery, readiness review, or product-slice design. Keep production quality and anti-falsification boundaries without forcing speculative future scaffolding into every step."
---

# Codex Progressive JPEG Planner

Use this skill when staged delivery or a progressive plan is relevant to the
user's task. Keep the final production purpose and quality bar visible, but
scale planning and artifacts to the task. Do not turn ordinary bounded work
into a roadmap exercise.

Read the project goal/current handoff and the relevant product rules when they
exist. Read `references/domain-examples.md` only for a matching product type.

## Plan the useful increment

1. For substantial staged work, agree with the user on the end result
   (audience, capability, acceptance, constraints) and approximate implementation
   waves (useful outcome and rationale, with a count that may change). Derive
   and record the detailed nearest-wave plan within that accepted scope;
   routine implementation detail does not need separate user approval.
   Preserve an existing approved plan or AgentOS/project-owned graph. For a
   small fix, skip this planning structure and work directly.
2. For the nearest wave, identify the intended user, product purpose, accepted
   scope, final path when known, quality guardrails, dependencies, ownership,
   acceptance evidence, and bounded responsibilities/instructions for any
   subagents. Keep later waves approximate until evidence sharpens them.
3. Separate a user-valuable wave result from enabling work such as
   research, architecture, migration, scaffolding, tests, and instrumentation.
   Enabling work is legitimate when it resolves a real dependency or risk; label
   it honestly and state the decision or next useful result.
4. An agreed wave must deliver a whole useful result at its declared scope, or
   be an explicitly bounded uncertainty experiment with a limit and an
   inspectable decision as its output. Smaller internal tasks may enable the
   wave but are not a substitute for its acceptance result. A wave need not
   demonstrate the whole eventual product journey.
5. For a product result, specify its user-visible outcome, path through the
   relevant behavior, acceptance evidence, known rough edges, and what would
   falsify the claim. Match scope to the accepted wave and constraints.
6. Include future contracts, handlers, routes, states, stubs, or callable seams
   only when they are already accepted architecture and matter to the current
   change. Do not invent a full end-state inventory or prebuild hypothetical
   capabilities merely to appear ready. If final architecture is materially
   unresolved, keep the current work enabling until that decision is made.
7. Proceed autonomously on routine choices inside the accepted wave. Ask the
   product owner before a material change to the promised result, constraints,
   or meaning/order of waves; explain the proposed delta. Do not ask approval
   for minor implementation choices already within scope.
8. Remove or migrate superseded implementation when the current task replaces
   it and the affected ownership/compatibility contracts permit it. Temporary
   migration scaffolding needs a concrete purpose and removal condition.
9. Use `tasks/progressive-plan.json` and its validator when the project workflow
   or task actually calls for that machine-readable plan; it is not a universal
   prerequisite for all implementation.

## Anti-falsification

- Do not present internal activity, code existence, a stub, mock, test double,
  screenshot, HTTP status, or readiness percentage as proof of a user outcome.
- Do not claim completion beyond observed evidence. State the exact verified
  part, remaining gaps, and next check.
- Do not fabricate a user journey, KPI relationship, evidence reference, or
  acceptance result. If the product path or KPI is unknown, say so rather than
  filling the plan with guesses.
- Preserve the production quality, safety, privacy, and reliability bar for the
  requested scope. A bounded step is not permission to label unfinished
  behavior as production-ready.

## Output

For a progressive plan, return the outcome and scope, ordered useful increments
and any enabling checkpoints, acceptance/falsification evidence, real
dependencies, rough edges, and replan triggers. Include the validator result
only when that plan was required and the validator was run.
