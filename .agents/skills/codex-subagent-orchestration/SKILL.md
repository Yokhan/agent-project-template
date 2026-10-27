---
name: codex-subagent-orchestration
description: "Delegate bounded implementation, research, testing and review to Codex workers, sequentially or in parallel. Use for nontrivial work with a clear worker contract, not tiny edits."
---

# Codex Subagent Orchestration

Use Terra Medium as the default executor of nontrivial bounded implementation.
One sequential worker is valid: Sol defines the contract, Terra implements, Sol
accepts. Parallelism is optional, not a prerequisite for delegation. Tiny edits
remain direct; do not create work or extra reviews to reach an agent quota.

Give Terra the complete bounded inspect/change/focused-check cycle. A scout call
followed by the parent doing all implementation does not establish execution
offload. Measure actual calls and completed integration with
`node scripts/codex-delegation-report.js --session <native-session-id> --limit 20`.
The minimum coverage target is 50% of eligible execution/research requests;
report the all-request share alongside it and never describe either as a share
of credits. See `docs/LUNA_EXECUTION_POLICY.md` for the denominator and limits.

## Default Pattern

For substantial staged product work, delegation sits inside an agreed wave,
not in place of product planning. The parent agrees with the user on the end
result (audience, capability, acceptance, constraints) and an approximate
sequence of useful waves, then derives and records the detailed nearest-wave
plan within that accepted scope before assigning workers. Routine detail does
not need another approval. Follow `.claude/library/process/plan-first.md`:
each wave delivers the next usable version of the same product toward the
agreed final outcome. Internal routes, experiments, and worker batches are not
product waves. Worker assignments are smaller
responsibility contracts with explicit scope, ownership, acceptance, and
evidence; they need not independently deliver the whole wave. The parent
retains wave acceptance and final verification. Include the supported product
version and outcome in worker context; never infer a new wave from worker output.

Follow `.claude/library/process/self-verification.md` for verification cadence.
Before dispatch, the parent assigns focused worker checks and owns any broad
wave-boundary acceptance check. Workers return command/result/scope/tested-state
evidence and do not run independent duplicate full suites. The parent integrates
first, then runs the broad check once when needed; a broad repeat requires a
stated concrete invalidation. Do not relabel each patch as another wave or run
simultaneous duplicate broad checks. Preserve mandatory gates and distinguish
reused baseline evidence from checks covering the final delta.

1. Use `node scripts/codex-route-task.js "<user request>" --summary` when routing helps select independent work; write route state only when the project needs durable continuity.
2. Discover existing workflow artifacts first: Spec Kit, litkit, Kiro, AgentOS, `PROJECT_SPEC.md`, `tasks/current.md`, or project-local `project-*` skills.
3. If AgentOS is detected, treat it as the orchestrator and use Codex subagents only inside the assigned worker route.
4. Read the route's `fanout.status`, reason, candidates, and role profiles from `scripts/codex-agent-policy.js`.
   Turn useful candidates into bounded `assignments` with exact scope, acceptance, and evidence references; the agent prepares these contracts from the user's task, not the user by hand. Inspect the actual tool schema and declare `hostDispatchCapabilities`: `native-custom-role` only if `agent_type` is supported; otherwise `explicit-model-contract` only if explicit model/effort are supported. Rerun the route with this contract and check both fan-out policy and dispatch readiness. For explicit dispatch, read `dispatch.instructionsSource`, append its `developer_instructions` verbatim to the call-contract message, and use the exact returned model/effort and `fork_turns=none`. For native dispatch, use the returned `agent_type` and bounded message; its TOML owns the profile, so do not invent unsupported explicit fields. Do not launch `dispatch.ready=false`, a missing profile, or a conflicting pinned custom role. Native role identity and explicit contract identity are distinct; the explicit fallback inherits the host sandbox, not the TOML's enforcement.
5. For `required`, satisfy the required verification lanes. For `recommended`, delegate bounded implementation or useful independent work without asking again within approved scope. For `conditional`, prepare missing scope/acceptance or establish a useful independent lane before dispatch. For `skip`, do not spawn. A design route does not reserve all coding for Sol: settle visual decisions, then delegate component implementation to Terra.
6. Notify the user which agents started and why. Ask for narrow outputs with file references and verification steps.
7. Keep working on independent parent work, or wait when the next step needs the worker's result. Do not duplicate a sequential worker's implementation to avoid waiting.
   For a genuinely blocked gate, use the shared **Useful work while a gate
   waits** contract in `.claude/library/process/plan-first.md`: choose a concrete
   independent result, preserve file/resource owners, and retain the original
   gate. Idle capacity alone is not a reason to dispatch. At each boundary,
   choose the next authorized useful action from the existing goal/task graph;
   an acknowledgement, reminder, or timer is not a result. Check live owner
   activity and current evidence instead of treating a stale turn/status as
   liveness. Never duplicate a busy writer, shared graph, heavy build/install,
   or server mutation to avoid waiting.
   In collaboration runtimes, `wait_agent` may wake for an intermediate message; that is not completion. Confirm a final answer or `list_agents` completed status, and keep required children alive until completion. Do not finalize merely because a child reported progress or a wait returned.
8. Consolidate in the parent thread. Terra implements the assigned files; Sol owns decisions, integration and acceptance. If retaining nontrivial bounded implementation, briefly state the concrete reason (unsafe split, unavailable worker/tools, unresolved judgment, or coordination cost), not a generic preference for Sol.

For prompt templates and the routing matrix, read `docs/CODEX_FANOUT_PATTERNS.md`.

When native request hooks are active, record the bounded assignment and actual
integration with `scripts/codex-turn.js integrate` using the observed child ID.
The hooks correlate completion and effective profile separately. Record concrete
exceptions with `fallback`; this never counts as verified Terra execution. Do not
clear the ledger or start another request to bypass an unresolved gate.

## Worker closeout

Workers report the bounded iteration result and evidence without implying
release or final product acceptance. Include elapsed time when available, raw
command result, and separate wrapper/cleanup status when those disagree. At
wave closure or a newly material blocker, the parent reviews the existing goal,
findings, persona/journey/state map, backlog, and opportunities, then records
the selected and deferred next-wave work. Preserve carryover evidence, severity,
and next-wave placement; report accepted and shipped counts separately against
the declared baseline. For substantive durable closeout, use the shared
task-wave handoff via `node scripts/codex-turn.js handoff`. Follow the closure,
carryover, release, and next-wave contract in
`.claude/library/process/product-goal-loop.md#closure-carryover-and-next-action`.

For long-running work, use the shared current-turn evidence, all-project
reporting, `STALL_SUSPECT`, and bounded recovery contract in
`.claude/library/process/product-goal-loop.md#delivery-observation-and-recovery`;
do not add project timers or treat a stale turn as proof that a worker is dead.

## Safe Prompt

```text
Use Codex subagents when the route approves bounded execution or useful
independent lanes and dispatch is ready. Follow the project's
existing artifacts; if no lane is approved, continue without spawning.
Inspect whether this project has Spec Kit, litkit, Kiro, AgentOS, or project-local workflow docs.
For approved implementation, assign a Terra Medium implementer, sequentially if
necessary. Add read-only exploration/review or testing only where useful.
Read-only means no file writes and no git restore/checkout/reset/clean, stash,
generated-artifact cleanup, or other shared-worktree state change. Report
unexpected changes to the parent; never repair or revert them.
Wait for assigned results. Parent integrates and accepts; workers own assigned edits.
```

## Guardrails

- Do not use subagents for XS tasks.
- Explicit user opt-out always wins.
- Do not spawn multiple write-capable agents on overlapping files.
- Before write fan-out, validate proposed `{ agent, files }` assignments with `validateWriteAssignments` from `scripts/codex-agent-policy.js`; any conflict blocks spawning.
- Treat `[P]` or equivalent project task metadata as the default signal for safe parallel work.
- Keep `agents.max_depth = 1`.
- Remember that subagents consume additional quota and tokens.
- Worker completion is not a reason for the parent to repeat all checks; reuse
  evidence only where content, scope, inputs, and toolchain still match.
- Use role-aware profiles from `scripts/codex-agent-policy.js`: Sol 6.1 High coordinates and integrates; Terra 6.1 Medium performs bounded work; Astra 6 Medium/High returns architecture decisions. Optional Max/XHigh require host support and a bounded reason/budget contract.
- A custom TOML may override explicit spawn model/effort. For integration use parent-owned Sol work; for an effort override use an explicit model/effort launch without a conflicting pinned custom role. Verify actual child metadata, not the request or self-report.
- For a Terra implementation use `implementer`, not a Sol-pinned `reviewer` with a Terra override. If observed model/effort differs, report the mismatch and correct subsequent dispatch; do not count it as Terra or infer cost savings. Prefer a bounded `fork_turns=none` evidence packet over inherited full history.
- Treat read-only TOML and prompt as requested permissions; effective enforcement must be verified separately. Do not claim sandbox isolation solely from a clean diff.
- On context overflow, narrow the evidence packet. After two failed attempts reassess cause and scope; do not loop retries or blindly increase effort.
- In Zed, rely on the parent summary; child-thread visibility may lag CLI/app UX.

## User-requested team scale

When the user requests a larger team, decompose the whole nearest usable product
version into genuinely useful independent lanes, each with product contribution,
exact non-overlapping ownership, dependencies and acceptance. Separate the
requested scale and conservative defaults from actual host slots, writer and
resource limits. Record planned, accepted, live and settled counts using actual
dispatch acknowledgements and current handles. If placement is constrained,
ask the coordinator for placement while continuing authorized independent work;
never invent lanes, exceed host limits, duplicate writers or claim reserved
capacity as active work. Consults are separate from implementation lanes. A `consumer_fenced`
response is an ownership refusal, not a capacity diagnosis or an execution
attempt. Preserve the validated contract and owner and relay placement to the
actual Run coordinator; do not create another Run, take over, or bypass its API.
An enqueue is not execution; distinguish ready/turn start from settled work.

## Visible delegation and optional advisor

When the host supports visible sessions, reveal and name the same authoritative
session and read back its workspace and identity. Do not create a duplicate
chat, history or Run for visibility; do not steal foreground from background work.
For material plan, pipeline or answer review, use an actually available
DeepSeek Flash session as a read-only advisor when useful and permitted by the
host and task privacy boundaries. Check availability and selected model; report
actual effective runtime as unverified unless correlated evidence establishes it.
The advisor has no decision authority and must not bypass network stops, send
private material outside its authorized boundary, upload data, or add paid keys.
If unavailable, continue with a transparent fallback; never create a session to
simulate evidence of consultation.
