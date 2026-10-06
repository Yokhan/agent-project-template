---
name: codex-subagent-orchestration
description: "Use Codex subagents for parallel exploration, review, testing, docs research, design audit, and isolated implementation. Trigger when the task can be split across `.codex/agents` workers."
---

# Codex Subagent Orchestration

Use this skill when parallel work can reduce latency without creating edit conflicts.

## Default Pattern

For substantial staged product work, delegation sits inside an agreed wave,
not in place of product planning. The parent agrees with the user on the end
result (audience, capability, acceptance, constraints) and an approximate
sequence of useful waves, then derives and records the detailed nearest-wave
plan within that accepted scope before assigning workers. Routine detail does
not need another approval. Each wave delivers
a whole useful result at its declared scope or is a bounded uncertainty
experiment returning an inspectable decision. Worker assignments are smaller
responsibility contracts with explicit scope, ownership, acceptance, and
evidence; they need not independently deliver the whole wave. The parent
retains wave acceptance and final verification.

1. Use `node scripts/codex-route-task.js "<user request>" --summary` when routing helps select independent work; write route state only when the project needs durable continuity.
2. Discover existing workflow artifacts first: Spec Kit, litkit, Kiro, AgentOS, `PROJECT_SPEC.md`, `tasks/current.md`, or project-local `project-*` skills.
3. If AgentOS is detected, treat it as the orchestrator and use Codex subagents only inside the assigned worker route.
4. Read the route's `fanout.status`, reason, candidates, and role profiles from `scripts/codex-agent-policy.js`.
   Turn useful candidates into bounded `assignments` with exact scope, acceptance, and evidence references; the agent prepares these contracts from the user's task, not the user by hand. Inspect the actual tool schema and declare `hostDispatchCapabilities`: `native-custom-role` only if `agent_type` is supported; otherwise `explicit-model-contract` only if explicit model/effort are supported. Rerun the route with this contract and check both fan-out policy and dispatch readiness. For explicit dispatch, read `dispatch.instructionsSource`, append its `developer_instructions` verbatim to the call-contract message, and use the exact returned model/effort and `fork_turns=none`. For native dispatch, use the returned `agent_type` and bounded message; its TOML owns the profile, so do not invent unsupported explicit fields. Do not launch `dispatch.ready=false`, a missing profile, or a conflicting pinned custom role. Native role identity and explicit contract identity are distinct; the explicit fallback inherits the host sandbox, not the TOML's enforcement.
5. For `required`, spawn the independent required lanes. For `recommended`, spawn without asking when a non-blocking lane materially improves speed, evidence, or context isolation. For `conditional`, spawn only after the independence gate passes. For `skip`, do not spawn.
6. Notify the user which agents started and why. Ask for narrow outputs with file references and verification steps.
7. Keep working on the parent critical path. Wait only when the next action needs a child result.
   In collaboration runtimes, `wait_agent` may wake for an intermediate message; that is not completion. Confirm a final answer or `list_agents` completed status, and keep required children alive until completion. Do not finalize merely because a child reported progress or a wait returned.
8. Consolidate in the parent thread. Parent performs edits unless an `implementer` task is isolated to non-overlapping files.

For prompt templates and the routing matrix, read `docs/CODEX_FANOUT_PATTERNS.md`.

## Safe Prompt

```text
Use Codex subagents with existing project artifacts.
First inspect whether this project has Spec Kit, litkit, Kiro, AgentOS, or project-local workflow docs.
Spawn pr_explorer, reviewer, and tester for read-only grounding.
Read-only means no file writes and no git restore/checkout/reset/clean, stash,
generated-artifact cleanup, or other shared-worktree state change. Report
unexpected changes to the parent; never repair or revert them.
Wait for all results. Parent agent performs edits unless exact [P] tasks with non-overlapping files are assigned.
```

## Guardrails

- Do not use subagents for XS tasks.
- Explicit user opt-out always wins.
- Do not spawn multiple write-capable agents on overlapping files.
- Before write fan-out, validate proposed `{ agent, files }` assignments with `validateWriteAssignments` from `scripts/codex-agent-policy.js`; any conflict blocks spawning.
- Treat `[P]` or equivalent project task metadata as the default signal for safe parallel work.
- Keep `agents.max_depth = 1`.
- Remember that subagents consume additional quota and tokens.
- Use role-aware profiles from `scripts/codex-agent-policy.js`: Sol 6.1 High coordinates and integrates; Luna 6 High performs bounded work; Astra 6 Medium/High returns architecture decisions. Optional Max/XHigh require host support and a bounded reason/budget contract.
- A custom TOML may override explicit spawn model/effort. For integration use parent-owned Sol work; for an effort override use an explicit model/effort launch without a conflicting pinned custom role. Verify actual child metadata, not the request or self-report.
- Treat read-only TOML and prompt as requested permissions; effective enforcement must be verified separately. Do not claim sandbox isolation solely from a clean diff.
- On context overflow, narrow the evidence packet. After two failed attempts reassess cause and scope; do not loop retries or blindly increase effort.
- In Zed, rely on the parent summary; child-thread visibility may lag CLI/app UX.
