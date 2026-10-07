---
name: codex-progressive-jpeg-planner
description: "Plan successive usable versions of the same product toward an agreed final outcome: roadmap, staged delivery, increasing resolution, or product-wave review. Distinguish product waves from internal tasks without requiring speculative future scaffolding."
---

# Codex Progressive JPEG Planner

Use this skill when staged delivery or a progressive plan is relevant to the
user's task. Keep the final production purpose and quality bar visible, but
scale planning and artifacts to the task. Do not turn ordinary bounded work
into a roadmap exercise.

Read the project goal/current handoff when they exist and
`.claude/library/process/plan-first.md#product-wave-semantics--source-of-truth`.
Read `references/domain-examples.md` for a matching product type or when deciding
whether a proposed technical slice is actually a product wave.

## Plan the useful increment

1. For substantial staged work, agree with the user on the end result
   (audience, capability, acceptance, constraints) and approximate implementation
   waves (versions of that same product and rationale, with a count that may change). Derive
   and record the detailed nearest-wave plan within that accepted scope;
   routine implementation detail does not need separate user approval.
   Preserve an existing approved plan or AgentOS/project-owned graph. For a
   small fix, skip this planning structure and work directly.
2. First restore the agreed final outcome, audience, product purpose and current
   usable version. Define the next product version: what the same audience can
   obtain now, what remains, what becomes sharper, what is not offered, how they
   access it, and what accepts it. If the target is unknown, resolve that gap;
   do not manufacture a product goal from the technical task at hand.
   Only then derive dependencies, ownership, checks and bounded worker tasks.
   Keep later versions approximate until evidence sharpens them.
3. Separate a user-valuable wave result from enabling work such as
   research, architecture, migration, scaffolding, tests, and instrumentation.
   Enabling work is legitimate when it resolves a real dependency or risk; label
   it honestly and state the decision or next useful result.
4. Plan waves as increasing resolution of the same product, not independent
   features, internal routes, or batches renamed after their tasks are done.
   A narrow end-to-end path is necessary evidence only for what it claims; it
   is not sufficient to establish a product-level version. Experiments have
   questions, limits and decision outputs; keep them in enabling checkpoints,
   not in delivered product waves. Early versions need not offer all final
   capabilities, but must genuinely serve the accepted product purpose.
5. For a product result, specify its user-visible outcome, path through the
   relevant behavior, acceptance evidence, known rough edges, and what would
   falsify the claim. Match scope to the accepted wave and constraints.
6. Include future contracts, handlers, routes, states, stubs, or callable seams
   only when they are already accepted architecture and matter to the current
   change. Do not invent a full end-state inventory or prebuild hypothetical
   capabilities merely to appear ready. If final architecture is materially
   unresolved, keep the current work enabling until that decision is made.
7. When parameters or evidence change, reassess the final target and recompute
   the remaining versions and nearest-wave tasks together. Preserve completed
   version history. Propose material target/constraint/sequence changes for
   owner approval before adopting them; do not shrink the target to match work
   already done. Routine choices inside accepted scope remain autonomous.
8. Remove or migrate superseded implementation when the current task replaces
   it and the affected ownership/compatibility contracts permit it. Temporary
   migration scaffolding needs a concrete purpose and removal condition.
9. Use `tasks/progressive-plan.json` and its validator when the project workflow
   or task actually calls for that machine-readable plan; it is not a universal
   prerequisite for all implementation. Its current structural checks do not
   establish same-product continuity: review that semantic link independently.

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

For a progressive plan, return the agreed final outcome, current product version,
ordered versions of the same product with their resolution deltas and any
separate enabling checkpoints, acceptance/falsification evidence, real
dependencies, rough edges, and replan triggers. Include the validator result
only when that plan was required and the validator was run.
