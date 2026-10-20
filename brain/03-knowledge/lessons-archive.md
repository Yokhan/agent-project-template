# Archived Lessons

Retired lessons are retained with their original rule text and a reason for
retirement. `Successor` points to the current rule or lesson that replaces the
retired guidance.

### 2026-07-05 - Progressive JPEG must shape implementation, not only reports
**Track**: PROCESS
**Severity**: P1
**Error**: Agents could treat progressive JPEG as status reporting or legacy harness proof, while product components still lacked known future capabilities in their first implementation shape.
**Root cause**: The rule was encoded in planning/status/closeout paths but not as an implementation architecture gate for feature, design, product-goal, and template workflows.
**Rule**: When final product direction is known, first useful slices should use an end-state skeleton: accepted future capabilities appear as 1% callable hooks, slots, handlers, contracts, feature flags, no-op stubs, or dev-only debug signals. Do not fake user-visible readiness and do not substitute legacy harness proof unless it protects the current product path.
**Applies to**: product-goal loop, feature workflow, design workflow, design-system workflow, template routing
**Category**: workflow
**Status**: RETIRED
**Previous status**: ACTIVE
**Retired**: 2026-10-18
**Retirement reason**: Its mandatory future hooks, stubs, and skeletons conflict with the accepted rule that first useful slices need not prebuild future objects; the later wording had also remained active beside that correction.
**Successor**: `tasks/lessons.md`, “2026-10-07 - Product waves are versions of the same product”; `.claude/library/process/plan-first.md#product-wave-semantics--source-of-truth`.

### 2026-07-05 - Progressive JPEG requires final-plan object readiness
**Track**: PROCESS
**Severity**: P1
**Error**: The template described progressive JPEG as an end-state skeleton, but agents could still treat the first useful slice as a proof harness, isolated stub, or partial fragment.
**Root cause**: The rule did not explicitly require a final product plan, object inventory, smallest production function, and readiness-level verification before judging implementation depth.
**Rule**: For product/feature/design/game/text/project work, progressive JPEG means plan first, then a whole product-shaped object at low detail. If the final plan is missing, gate implementation and create/propose it first. At 1% readiness, all accepted future classes/components/interfaces/routes/sections/functions/contracts must exist or be callable, and the object must perform its smallest honest production function with explicit placeholder/debug behavior.
**Applies to**: production-product-standard, product-goal-loop, client-executor-contract, Codex product/feature/design/decompose/strategic skills, release validators
**Category**: process
**Status**: RETIRED
**Previous status**: SUPERSEDED
**Retired**: 2026-10-18
**Retirement reason**: `SUPERSEDED` was not a supported lifecycle status, and the rule required future objects and stubs that the accepted successor explicitly says not to restore.
**Successor**: `tasks/lessons.md`, “2026-10-07 - Product waves are versions of the same product”; `.claude/library/process/plan-first.md#product-wave-semantics--source-of-truth`.
