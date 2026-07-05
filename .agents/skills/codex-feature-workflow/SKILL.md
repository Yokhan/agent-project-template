---
name: codex-feature-workflow
description: "Add or modify a feature using vertical slice architecture, research-first planning, module boundaries, tests, and verification. Trigger on add feature, new module, create component, implement, or сделай."
---

# Codex Feature Workflow

Read:

- `.claude/library/process/research-first.md`
- `.claude/library/process/plan-first.md`
- `.claude/library/technical/architecture.md`
- `docs/SHARED_CONVENTIONS.md`

## Process

1. Search existing modules, registry entries, templates, and lessons.
2. Define success criteria and risk.
3. Plan file architecture before edits.
4. If the final object plan is missing, stop implementation and create/propose it first.
5. For accepted future capabilities, design the end-state skeleton before code: callable handlers, contracts, states, routes, flags, or no-op stubs can be 1% ready, but the architecture point should exist when later slices depend on it.
6. Keep business logic in importable modules.
7. Implement in small batches.
8. Add focused tests for the planned scenarios.
9. Run verification and update docs/registry when public behavior changes.

## Progressive JPEG Implementation

Do not build a temporary proof path when the product direction is already known.
The first slice should be a low-resolution version of the future product:

- known capability present as a callable contract;
- internal behavior may be stubbed, feature-flagged, no-op, or dev-debug only;
- the 1% object still performs the production function in the smallest honest way;
- product users must not see fake completed behavior;
- speculative capabilities stay out until accepted.

Verify object completeness against the final plan before judging detail depth.
