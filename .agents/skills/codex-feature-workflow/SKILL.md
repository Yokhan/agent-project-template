---
name: codex-feature-workflow
description: "Implement or materially change a product feature with repository-aware scope, suitable architecture, and verified behavior. Trigger on feature implementation, not on every small edit."
---

# Codex Feature Workflow

For a small, local feature change, inspect the relevant files and consumers,
make the bounded edit, and run a focused check. For broader features, read the
relevant project/goal context and these shared rules as needed:

- `.claude/library/process/research-first.md`
- `.claude/library/process/plan-first.md`
- `.claude/library/process/self-verification.md` (verification cadence SOT)
- `.claude/library/technical/architecture.md`
- `docs/SHARED_CONVENTIONS.md`

## Implementation

1. Search for existing behavior, components, or utilities that directly affect
   the feature; inspect the relevant tests and current worktree.
2. Define the requested outcome and acceptance evidence at a level suited to
   the scope and risk, including focused checks and any broad wave-boundary
   acceptance check/owner. Write a plan in the active project artifact when
   coordination or durable sequencing needs one.
   For staged work, name the supported product version and final outcome before
   deriving tasks. A feature or internal route is not automatically a wave;
   use the product-wave semantics in `plan-first.md`.
3. Follow established module and API boundaries. Resolve an unresolved
   architecture choice before implementation only if the current change
   depends on it.
4. Add future-facing contracts, states, routes, flags, or callable seams only
   when accepted architecture makes them relevant now. Do not invent or build a
   full future-object skeleton for a bounded feature step.
5. Implement the smallest complete behavior within the accepted scope. An
   enabling step is valid when it resolves a real dependency or risk; label it
   honestly and state the next useful result.
   For nontrivial bounded changes, assign a Luna High implementer under
   `codex-subagent-orchestration`; sequential execution is valid. Sol prepares
   the contract and accepts the result. Keep tiny edits direct; retain larger
   implementation only for a concrete scope, judgment, host or cost reason.
6. Verify the user-facing behavior claimed, or the narrow contract changed.
   When the feature adds customer-facing copy, load the **Public Copy Gate** in
   `.claude/library/technical/writing.md` and check the assembled UI states;
   developer notes and simulated success must not leak into product copy.
   Tests and internal artifacts support evidence but are not themselves proof
   of a user outcome. Never present a stub or unavailable behavior as complete.
   Use focused checks after coherent change batches; the parent/integrator owns
   broad integration at the useful wave boundary. No full-suite cascade per
   patch or independent duplicate worker runs. State concrete invalidation
   before a broad repeat; report reused evidence as baseline plus checked delta,
   not a full pass of an untested current tree. Required gates remain intact.
7. Remove superseded code when the change owns that path and doing so preserves
   protected consumers, data, rollback, and public contracts. Keep temporary
   migration scaffolding only with a concrete purpose and removal condition.

Use `$codex-progressive-jpeg-planner` when a staged product plan is requested
or will materially improve sequencing; do not make its JSON plan or status
headers a universal prerequisite to feature work.

After two failed approaches, stop local retries and revisit cause, boundary,
and strategy. Use `$codex-change-strategy` when evidence points to an ownership,
contract, architecture, or obsolete-path mismatch. Follow the project quality
bar and report only what current verification supports.
