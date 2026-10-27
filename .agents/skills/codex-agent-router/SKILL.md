---
name: codex-agent-router
description: "Choose relevant repository skills, shared rules, project task ownership, and bounded Codex worker profiles for non-trivial work. Trigger when routing workflow or delegation."
---

# Codex Agent Router

Use the project router for work where routing changes the workflow, rules,
risk, or coordination. A tiny local edit or direct answer need not trigger a
full route. Run `node scripts/codex-route-task.js "<user request>" --summary`
when available; load only the returned skills and rules. If the router is
unavailable, use the task-relevant shared rules in `.claude/library/` and
continue with a proportionate approach.

## Ownership and scope

- Preserve user instructions, project-owned `project-*` artifacts, and an
  existing AgentOS task graph. AgentOS remains the plan owner; Codex returns a
  worker contract and does not create a competing graph.
- Read the relevant source, downstream consumers, and current worktree state
  before changes. Protect dirty work, secrets, project overlays, release tags,
  preview/rollback contracts, and explicit user scope.
- Research, planning, and verification should match task size and risk. Continue
  safe, reversible work inside the accepted scope; ask only when a missing
  decision materially changes behavior, data, security, release, scope, cost,
  or irreversible state.
- After two failed approaches, stop local retries and re-diagnose the cause,
  scope, and strategy before proceeding.

## Model and delegation policy

- Sol 6.1 `high` is the default orchestrator and integrator.
- GPT-6 Luna `high` is the default implementer for useful, well-scoped nontrivial
  implementation, documentation, tests, or discovery against an explicit
  contract and exact scope. Delegation may be sequential; parallel fan-out
  still requires independent lanes with material parallel value. Sol retains
  contract and architecture decisions, integration, and acceptance. Keep tiny
  edits direct; when suitable nontrivial work stays with the parent, briefly
  explain why rather than adding a ritual for tiny edits.
- For genuine decision uncertainty or deep-risk review, use a read-only
  GPT-6.1 Sol `high` consultation. It returns a recommendation to the
  orchestrator; it does not replace the orchestrator.
- Luna `max` or Sol `xhigh` are optional only when host-supported and justified;
  they are not defaults. Never claim a requested profile is effective without
  runtime evidence. Unknown model or effort is `unverified`.
- Spawn no more than three children for a task, and fewer when host slots,
  independence, or expected value warrant it. Respect explicit user opt-out,
  host limits, and unsafe or inseparable scopes. Parallel fan-out requires
  independent lanes with material parallel value, exact acceptance criteria,
  and non-overlapping write ownership. The parent integrates and verifies. Do
  not recursively fan out by default.
- For design work, Sol retains visual/product judgment and final acceptance;
  bounded implementation can be assigned by settled component or screen
  contract when ownership and visual integration are clear.
- A requested model is not runtime evidence. Custom-agent TOML can override an
  explicit spawn model; verify effective metadata or report it as `unverified`.
  Never infer Luna from a worker-role label.

`delegationDecision.nextAction` is an execution obligation. `prepare-contract`
means the coordinator prepares scope/acceptance from source inspection and
reroutes with the actual host dispatch capabilities; it is not a parent-only
fallback. For useful nontrivial execution, complete bounded Luna work and
integrate its result, or record a concrete exception through the current native
request ledger. Native event/profile evidence and useful integration are
separate checks; neither candidate names nor a started irrelevant agent suffice.

For detailed model guidance and fan-out patterns, read
[`docs/OPENAI_MODEL_GUIDANCE.md`](../../../docs/OPENAI_MODEL_GUIDANCE.md) and
[`docs/CODEX_FANOUT_PATTERNS.md`](../../../docs/CODEX_FANOUT_PATTERNS.md).

## Change and verification

Route by actual task need (for example implementation, debugging, review,
design, writing, security, template sync, or OpenAI-specific guidance), not by
keyword alone. Correct a misroute in the intent model and regression tests when
that router is in scope; do not expand an unrelated task to do so.

Use a change-strategy review when evidence shows a broken ownership/contract
boundary, obsolete compatibility layer, architecture conflict, or repeated
repair failure. Otherwise prefer a bounded repair. Verify the outcome with the
smallest checks that can establish it, expanding coverage for higher risk. Do
not claim a test, runtime profile, preview, or rollback was verified unless
current evidence supports the claim.
