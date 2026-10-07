---
name: decompose
description: "Break down work when dependencies, ownership, risk, or verification make one execution pass difficult to coordinate."
---

# Decompose Work

Decompose only when it reduces dependency, ownership, or verification risk more
than it adds coordination. File count and line count can inform the estimate,
but are not decomposition thresholds.

## Process

1. Identify the requested outcome, protected scope, task-graph owner, and
   acceptance evidence. Inspect only the affected files, consumers, and risky
   boundaries.
2. Preserve the active project plan or AgentOS graph. Do not create a parallel
   plan. For substantial staged product work, use
   `.claude/library/process/plan-first.md` to distinguish the final outcome,
   successive usable versions of the same product, and implementation tasks.
   A fix, experiment, route, or work batch is not automatically a product wave.
   Small tasks need no roadmap.
3. Group work by real dependencies, ownership, and acceptance. Define a worker’s
   exact scope and focused checks when delegation is useful; keep tightly
   coupled work together. Do not impose a fixed number of tasks, files, or lines.
4. Record the plan in the active artifact only when it needs to coordinate work
   or survive multiple steps. Otherwise keep it concise in the working context.
5. Proceed autonomously on routine choices within the accepted scope. Ask for
   direction only when a missing decision or proposed change materially affects
   the promised result, scope, data, security, release, cost, or reversibility.
6. Verify each result at its claimed scope. Workers return focused evidence;
   the parent/integrator owns broad acceptance and repeats it only for a concrete
   invalidation or required gate.

Use `.claude/library/process/plan-first.md` for planning and product-wave
semantics, and `.claude/library/process/self-verification.md` for verification
cadence. Do not require separate commits for decomposed tasks.
