---
name: codex-product-goal
description: "Maintain a goal-like product contract for Codex tasks: final outcome, quality bar, current step, dependencies, risks, language matching, and verification. Use for M+ work, continue/finish requests, product strategy, or corrections after missed intent."
---

# Codex Product Goal

Read:

- `.claude/library/product/production-product-standard.md`
- `.claude/library/process/product-goal-loop.md`
- `tasks/goal.md` when present
- `tasks/current.md`

## Process

1. State the user's real outcome in the user's language.
2. Preserve the final product goal and quality bar.
3. Define the current bounded step without pretending it completes the whole product.
4. List dependencies, risks, and honest out-of-scope items.
5. Update `tasks/current.md` before edits for M+ work.
6. Update `tasks/goal.md` only when the final outcome or quality bar changes.
7. Verify the user outcome, not just file changes.

## Gates

- Do not use MVP/prototype reasoning unless explicitly requested.
- Do not lower UX, security, privacy, data, or architecture quality to make the step easier.
- Plans, audits, and final reports use the language of the user's request.
- Partial work must be reported as partial with the next dependency.
