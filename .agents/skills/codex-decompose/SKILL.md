---
name: codex-decompose
description: "Decompose work when scope, dependencies, or risk make a single execution pass hard to coordinate or verify. Trigger for genuinely broad, multi-part, or architecture-level work."
---

# Codex Decompose

Decompose only when it reduces dependency, ownership, or verification risk more
than it adds coordination. Do not split work that is already small enough to
execute and verify directly.

## Process

1. For substantial staged product work, agree on the end result (audience,
   capability, acceptance, constraints), an approximate sequence of useful
   implementation waves and why they are ordered that way. Then derive and
   record a detailed plan for the nearest wave within that accepted scope,
   without a separate approval ritual for routine detail. The number and contents of later waves may change with
   evidence. Preserve existing approved plans and AgentOS/project-owned task
   graphs; do not create a competing plan. Small fixes can proceed directly.
2. Identify the requested outcome, protected scope, project owner, and
   acceptance evidence. Map only affected files, consumers, dependencies, and
   risky boundaries.
3. Follow `.claude/library/process/plan-first.md` for product-wave semantics:
   final product outcome -> successive usable versions of the same product ->
   technical tasks. Select the next version before grouping tasks, and state
   its change for the intended user relative to the previous version. An
   internal route, refactor, or bounded experiment is an enabling checkpoint,
   not a wave. If the product link is missing, recover it rather than invent it.
4. Group internal work into the smallest useful tasks with explicit ordering,
   owners, exact non-overlapping file scopes where parallel writing is proposed,
   responsibilities, and acceptance checks. Keep tightly coupled work
   together.
5. Mark parallel work only when tasks are independent and yield material time
   or quality value. Start with at most three children per task, subject to
   host slots. A read-only lane is often enough; no child is also valid.
6. Record the plan in the active project artifact when it needs to survive
   multiple steps/agents or coordinate execution. Otherwise keep it concise and
   in the response. State the first useful result, open risks, and a replan
   trigger when they matter.
7. Execute safe, reversible work autonomously within the accepted wave. Ask for
   approval before materially changing its promised result, constraints, or
   meaning/order of the waves; propose the delta. Minor in-scope choices do not
   need an approval ritual. When parameters change, reassess the final target
   and remaining versions together, then update dependent tasks/worker contracts
   in the existing plan; preserve completed-version history.
8. Verify each result at the scope claimed; consolidate it in the parent and
   identify anything still unverified.

For implementation increments, add future-facing structure only when accepted
architecture makes it relevant. An enabling task may prepare a later outcome,
but label it as enabling work rather than product delivery. A plan, test,
scaffold, or status metric is not by itself proof of a user outcome.

Use `$codex-progressive-jpeg-planner` when the request needs staged product
iteration planning. It does not require a full end-state object inventory,
1%-callable stubs, readiness percentages, or a status header for every task.
Apply the appropriate project validator when the project workflow requires
the corresponding artifact.

After two failed approaches, stop repeating local variants and re-diagnose the
cause and strategy. Use `$codex-change-strategy` when evidence shows a broken
contract/ownership boundary, obsolete path, or architecture conflict.
