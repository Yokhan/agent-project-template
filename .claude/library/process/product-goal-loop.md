# Product Goal Loop

## Purpose
Keep long product work coherent across turns, compaction, agents, and downstream projects.

This is not a "final slice" model. Agents naturally split work into bounded steps. The goal loop preserves the final product target while each step stays small, reversible, and verifiable.

## When Required

Use this loop for:

- M+ tasks.
- Any product, design, auth, data, game, docs, deployment, or template work.
- Any task where the user says "continue", "finish", "make it good", "production", "ecosystem", "goal", "roadmap", or similar.
- Any task after a correction where the prior output missed the user's real goal.

## Language Rule
Plans, audits, checklists, user-facing status, and final reports must use the language of the user's request. Keep code identifiers and commands in their native language.

## Goal Artifact

If `tasks/goal.md` exists, read it before planning. If it does not exist and the work is M+ product work, create or propose it.

The artifact must stay concise and include:

```markdown
# Product Goal

## Final Outcome
[What the finished product lets the end user do.]

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

1. Restore: read `tasks/goal.md` and `tasks/current.md`.
2. State intent: "User wants", "Success means", "I will verify by".
3. Route: run the project router and load only route-selected skills/rules.
4. Plan: write the current step, dependencies, tests, and rollback into `tasks/current.md`.
5. Execute: implement the step without lowering the final quality bar.
6. Verify: prove behavior through tests, browser/screenshot checks, contract checks, or deployment smoke, depending on domain.
7. Update: mark completed steps, log durable lessons, and update `tasks/goal.md` only when the product goal or quality bar actually changed.

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
2. Update `tasks/lessons.md` when the failure is reusable.
3. Re-check the goal and current step before editing again.
4. State what changed in the plan.

## Verification Examples

- Product nav: click from main entry to service, authenticate if needed, reach useful screen, return to home, and handle logged-out state.
- Design system: check token tables, component dependencies, rendered geometry, interaction states, and responsive behavior.
- Auth: verify real form fields, locale, redirect, token validation, expired session, logout, and privacy contract.
- Docs: verify linked routes, layout, CSS/JS MIME, 404, and whether docs content answers the user journey.
