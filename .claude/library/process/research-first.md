# Research-First Protocol — Read Before You Write

Gather enough evidence to avoid editing the wrong boundary. Keep discovery
proportionate: a focused documentation edit does not require a full repository
survey, while a shared API or high-risk change may require broader tracing.

## Before a state-changing edit

1. Read the target files and the relevant direct callers, consumers, or tests.
2. Check current worktree status and preserve unrelated or uncommitted changes.
3. Inspect recent history, project handoff, lessons, registries, or downstream
   consumers only when they can affect this decision.
4. Use project-specific context or tools when their output can change the
   approach; do not repeat a fresh, still-valid finding without reason.
5. For work with material uncertainty, summarize the key evidence, risk, and
   approach in the active task artifact or to the user. Routine edits need no
   research report ritual.

## When more research is justified

Trace further for shared code, public contracts, auth/security, data changes,
release/sync workflows, architecture decisions, or unexplained failures. Search
for direct consumers and applicable project-owned rules before changing such a
boundary. If a project task graph or `project-*` artifact owns the work, use it
as the context source rather than creating a parallel plan.

## Lightweight work

For a small local edit, inspect the target and the nearest relevant context,
make the bounded change, and run a focused check. Skip broad history, registry,
ecosystem, or cache scans when they cannot affect correctness. Documentation-only
work may still require source verification when it asserts volatile or
version-sensitive facts.

## Research cache

Use `tasks/.research-cache.md` only when the project maintains it and the
current topic has reusable findings. Check freshness before relying on cached
information; update it when a discovery is likely to save future work. It is not
a required read/write artifact for every task.
