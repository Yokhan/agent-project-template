# Codex Fan-Out Patterns

Use workers when independent work can proceed in parallel and the result is
worth the coordination cost. This is a routing guide, not a requirement to
spawn agents. Parent Codex remains responsible for scope, integration, and
acceptance.

## Starting policy

- Default orchestrator: GPT-6.1 Sol, `high`.
- Bounded discovery, tests, documentation, and contract-scoped implementation:
  GPT-6 Luna, `high`.
- Architecture consultation for a genuine unresolved decision: GPT-6 Astra,
  `medium`; use `high` only for unusually deep or consequential risk.
- Luna `max` and Sol `xhigh` are optional, host-supported escalations with a
  concrete reason, not baseline settings. Astra is not a required step for a
  new project.
- Start with at most three child agents per task, subject to the actual host's
  available slots. A smaller number or no children is often better.

These are proposed profiles. The host may not support or honor a requested
model/effort. Record requested and effective values separately; when runtime
metadata does not establish the effective values, report `unverified`. A role
label, spawn success, prompt, or plausible output is not runtime proof.

## Split only independent lanes

For substantial staged product work, agree on the end result (audience,
capability, acceptance, constraints), an approximate sequence of implementation
waves with useful outcomes and rationale. Then derive and record a detailed
plan for the nearest wave within that accepted scope; routine detail does not
need separate user approval. Later wave count and details can change with evidence. Preserve an
existing approved plan or AgentOS/project-owned task graph. Each wave must
deliver a whole useful result at its declared scope or be a bounded uncertainty
experiment that returns an inspectable decision; smaller enabling tasks are
not themselves wave outcomes. A wave need not demonstrate the whole eventual
product journey.

Within an accepted wave, the parent can direct routine work autonomously.
Seek product-owner approval before materially changing the promised result,
constraints, or meaning/order of the waves, and present the proposed delta.
Worker tasks are bounded responsibility contracts inside that wave, with exact
scope, ownership, acceptance, and evidence; they do not replace wave-level
acceptance. The parent retains integration and verification of the wave.

Before spawning, identify the parent's next step and ask whether a child can
produce a distinct result without editing the same files or waiting on another
child. Use exact inputs, output shape, acceptance criteria, and file/write
boundaries. Continue useful parent work while workers run. Do not delegate a
task merely because a candidate role exists. Project guidance authorizes
automatic delegation for useful independent lanes; it is not a blanket swarm
requirement for every task or a typo fix. An explicit user opt-out wins. Avoid recursive fan-out
and repeated waves; consider another small wave only when returned evidence
reveals new independent work.

Suggested routing:

| Work | Worker profile | Parent retains |
|---|---|---|
| Repository map, focused log/source extraction | Luna `high`, read-only | Synthesis and conflicting evidence resolution |
| Test cases or a targeted test run | Luna `high` | Choosing adequate coverage and accepting result |
| Documentation or isolated implementation to a settled contract | Luna `high` | Product/architecture decisions, integration, final verification |
| Architecture options under real uncertainty | Astra `medium` consultant | Decision ownership, implementation, reconciliation |
| Deep threat/system review | Astra `high` only when risk justifies it | Scope, remediation, proof and release decisions |
| Ordinary correctness, design, or product review | Sol `high` | Final disposition and acceptance |

Use an implementation worker only for a clearly bounded slice with exact,
non-overlapping file ownership. Keep security-sensitive changes, shared
architecture, broad migrations, and screenshot-driven multi-component design
with the parent unless the owner deliberately establishes a safe split.

## Existing task ownership

Inspect the task artifacts relevant to the request. If AgentOS owns a
Strategy/Tactic/Plan/Todo/Gate graph, use it as the task graph and treat Codex
workers as execution contracts. Do not generate a parallel graph. Preserve
project-specific `project-*` ownership and user scope. Check current source,
downstream consumers, and dirty worktree before assigning writes. Never
overwrite unowned changes or include secrets in a worker packet.

For template changes, keep source and downstream work distinct. Pin the exact
release, preview before applying downstream changes, and retain the verified
rollback path; a fan-out plan does not authorize either a release or a
downstream mutation.

## Runtime evidence and handoff

For a claim that a custom profile actually ran, use a correlated runtime trace
where available: parent identity, spawn event, distinct child thread ID,
requested profile, effective model/effort metadata, child activity or
completion, and a wait/result associated with that same child. Run
`node scripts/validate-subagent-trace.js` for repository trace records. Missing
effective metadata means `unverified`; describe what is and is not known.
This validator is a launch smoke, not a general task/workflow state tracker.
It checks the latest linked child lifecycle and turn IDs when present: an old
completed turn does not prove a newly resumed task.
Child completion and abort evidence must match that child's session and source
rollout; a sibling's event cannot establish or invalidate its result.

Each worker should return:

- result and exact changed files (if any);
- evidence or commands run, with outcomes;
- remaining uncertainty or blockers;
- whether the task stayed within its assigned scope.

The parent inspects the diff, resolves conflicts, runs proportionate
integration checks, and makes the final user-facing claim. Repeat a check only
when code changed, a check failed, or new risk makes the evidence stale.
After two failed approaches, re-diagnose rather than merely raising effort or
spawning another worker.

## Minimal prompt contract

### Machine-readable resource contract (CLI)

Use `node scripts/codex-route-task.js "<task>" --contract-file contract.json`.
The file must be a JSON object; `scope`, `acceptance`, and `evidenceRefs` are
arrays of nonempty strings. A bounded default worker contract is:

```json
{
  "role": "implementer",
  "scope": ["src/isolated.js"],
  "acceptance": ["the isolated module passes its contract tests"],
  "hostDispatchCapabilities": ["explicit-model-contract"]
}
```

For optional effort escalation, also supply `requestedEffort`, `reason`, a
`budget` object containing positive `maxTokens` and `maxAttempts`, and freshly
verified `hostCapabilities` (model ID to supported-effort array). An invalid
or unsupported request blocks dispatch; unavailable host evidence is
`unverified`, not permission to silently downgrade. Budgets are caller-owned
contracts, not automatic runtime token enforcement.

Consult the returned `dispatch`: integration and unbounded work stay with the
Sol parent. A custom agent TOML may override explicit spawn settings, so
effort overrides use explicit model/effort without a conflicting custom role.
All returned resource decisions are recommendations until trace verification.
Declare dispatch capability only after inspecting the actual host tool schema.
Native custom-role needs `agent_type`; explicit-model-contract needs explicit
model and reasoning effort. The agent derives bounded assignments from the task,
declares the observed host capabilities and reruns the route; the user need not
author contract JSON manually. Recommended/required routes surface the
orchestration skill; a recommendation alone is not dispatch or activation.
For explicit dispatch, the call contract identifies the local instructions
source: the parent reads and embeds its developer instructions before launching.
For native dispatch, use the returned `agent_type` contract and let the TOML
select the profile; unsupported native fields must not be substituted silently.
Missing capability blocks readiness. Explicit contract identity is not an
effective native role, and its sandbox is inherited/unverified, not TOML-enforced.
The MCP router currently exposes additive default recommendations; custom
resource-contract input and per-role assignments are CLI-only, not MCP parity.

The read-only `tester` profile proposes cases or runs checks without writes;
use an exactly scoped `implementer` for generating test files.

Modern collaboration `wait_agent` wakes for messages as well as completion.
A progress message is not a final answer. Confirm actual final/completed child
status before integrating a required lane or ending the parent turn; otherwise
the host may interrupt a still-running child when the parent exits. Runtime
completion evidence must not count an interrupted or aborted turn as success.

```text
Outcome:
Inputs and relevant context:
Exact scope / files:
Allowed actions and permissions:
Acceptance evidence:
Return format:
Report unknown runtime/model metadata honestly; do not expand scope.
```

No benchmark or cost-savings claim follows from this routing table alone.
Measure representative accepted tasks, including review/correction effort,
before asserting quality, latency, or savings.
