---
name: add-feature
description: "Implement a feature using the repository’s existing architecture, scope, and verification conventions."
---

# Add a Feature

Use the project router when it materially selects a workflow or specialist
rules. For a small feature, inspect the relevant implementation and consumers,
make the bounded change, and run the smallest useful check.

For broader work, restore the project’s active goal and task-graph owner. Search
for existing patterns, interfaces, tests, and direct consumers before adding
structure. Follow the repository’s architecture; examples in another project
are not mandatory scaffolding.

For substantial staged product work, first distinguish the agreed final outcome,
the next usable version of that product, and the implementation tasks that
support it. A feature, internal route, or test batch is not automatically a
product wave. For an experiment, state its question, limit, and decision it will
inform. Keep ordinary feature work a task rather than inventing a roadmap.

Define acceptance evidence proportionate to the changed behavior and risk.
Add or update focused tests where they establish the relevant contract; choose
broader checks only when integration risk or a required project gate justifies
them. Follow `.claude/library/process/self-verification.md`; the parent owns
broad acceptance when work is integrated.

Preserve user and project ownership. Routine decisions within the accepted
scope do not need another approval. Do not commit, update unrelated plans, or
create persistent logs unless requested or required by the active project
workflow. Report verified behavior and any material unverified gap.
