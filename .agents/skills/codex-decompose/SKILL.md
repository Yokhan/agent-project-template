---
name: codex-decompose
description: "Break large or risky work into M-sized tasks with dependencies, gates, rollback points, and verification. Trigger on XL tasks, broad architecture changes, or ambiguous 'do everything' requests."
---

# Codex Decompose

Read `.claude/skills/decompose/SKILL.md` for detailed patterns.

## Process

1. Restate the user goal.
2. Identify independent deliverables and dependencies.
3. Split into 3-5 tasks that can each be verified.
4. Define the first safe slice.
5. Define the first useful client-visible view for each slice.
6. Define the acceptance evidence, rough edges, and replan trigger for each slice.
7. Define which accepted future capabilities need 1% callable hooks, contracts, states, events, flags, or no-op stubs in the first slice.
8. Define the object readiness level for each slice: 1%, 10%, 30%, 60%, 90%, or 100%.
9. State what is deferred and why.

Do not start broad edits before the first slice is clear.
Do not call an internal checkpoint a completed client result unless the user can inspect, accept, or decide from it.
Use progressive JPEG delivery: each slice should sharpen the user's visible picture, not only move hidden internal setup forward.
Use progressive JPEG implementation: each slice should preserve the future product shape when that shape is known, without faking completed behavior.
If the final product plan is missing, the first slice is the plan, not a partial object.

For client-facing decomposition, follow `.claude/library/process/client-executor-contract.md`.
