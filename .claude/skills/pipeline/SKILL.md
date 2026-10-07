---
name: pipeline
description: "Run a relevant shared agent pipeline for multi-phase work, with project-owned handoffs and evidence-based gates."
---

# Pipeline Runner

Use `docs/AGENT_PIPELINES.md` as the shared pipeline contract. Run a pipeline
only when its phases materially help the requested work; a small task can stay
direct.

## Execution

1. Read the relevant pipeline section and route-specific rules, not every
   pipeline by default.
2. Identify the current task-graph owner. Preserve AgentOS, Spec Kit, or other
   project-owned artifacts; do not create a competing graph. Use
   `tasks/current.md` only when it is the active project handoff or Codex owns
   the task and durable state is useful.
3. Treat phases as useful checkpoints, not a requirement to launch a different
   agent for every step. Delegate only independent work with material value and
   a bounded contract; the parent keeps sequencing and acceptance.
4. Apply each gate from the shared pipeline and applicable project rules.
   Request user approval only where those rules require it or a decision would
   materially change the accepted result, scope, risk, or constraints.
5. Verify changed behavior with focused evidence. The parent/integrator owns
   any broad acceptance check; do not repeat it without a concrete invalidation
   or required gate.

For substantial staged product work, follow
`.claude/library/process/plan-first.md`: distinguish final outcome, successive
usable product versions, and implementation tasks. Do not label experiments,
internal routes, or pipeline phases as product waves. Small changes need no
artificial roadmap.

Record a concise handoff in the active owner artifact only when state must
survive this step or coordinate work. Include what changed, evidence, and the
next dependency if one exists. Do not require confidence scores, routine
commits, or per-step metrics.

Project-specific pipeline definitions may extend the shared contract when they
preserve the project’s task ownership and authorization boundaries.
