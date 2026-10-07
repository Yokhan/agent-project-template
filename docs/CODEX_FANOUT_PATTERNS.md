# Codex Fan-Out Patterns

Use Luna workers for useful bounded implementation, sequentially or in
parallel. Parallel lanes must be independent and worth their coordination
cost. Tiny edits do not need workers. Parent Codex remains responsible for
scope, decisions, integration, and acceptance.

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

## Delegate bounded work; split only independent lanes

Delegation can be sequential as well as parallel. For a well-scoped,
nontrivial implementation against a settled contract, GPT-6 Luna `high` is the
default implementer recommendation when the host supports delegation and the
handoff is useful. Sol retains contract and product/architecture decisions,
integration, and acceptance. Keep tiny edits direct. When suitable nontrivial
work stays with the parent, briefly state the concrete reason; this is not a
ritual for tiny edits. Respect explicit opt-out, host limits, and unsafe or
inseparable scopes. Project guidance permits delegation but does not require a
worker for every task.

For substantial staged product work, agree on the end result (audience,
capability, acceptance, constraints), an approximate sequence of implementation
waves with useful outcomes and rationale. Then derive and record a detailed
plan for the nearest wave within that accepted scope; routine detail does not
need separate user approval. Later wave count and details can change with evidence. Preserve an
existing approved plan or AgentOS/project-owned task graph. Follow the wave
semantics in `.claude/library/process/plan-first.md`: successive usable versions
of the same product toward its final outcome. A technical route or worker batch
is not a wave; experiments return decisions, not delivered product versions.
Each worker receives the supported version/outcome as context. Changing major
constraints requires reassessing the target and remaining versions together.

Within an accepted wave, the parent can direct routine work autonomously.
Seek product-owner approval before materially changing the promised result,
constraints, or meaning/order of the waves, and present the proposed delta.
Worker tasks are bounded responsibility contracts inside that wave, with exact
scope, ownership, focused checks, acceptance, and evidence; they do not replace wave-level
acceptance. The parent retains integration and verification of the wave.

Verification cadence SOT: `.claude/library/process/self-verification.md`. Assign
focused worker checks before dispatch; reserve broad integration acceptance for
the parent after the useful wave is integrated. Workers do not independently
rerun the full suite, and duplicate broad runs must not overlap. A new patch is
not a new wave. Keep command/result/scope/tested-content-state evidence in the
existing task context, including relevant inputs/toolchain.

Before dispatch, identify the parent's next step and decide whether a bounded
sequential handoff or distinct parallel result is useful. Use exact inputs,
output shape, acceptance criteria, and file/write boundaries. Continue useful
parent work while parallel workers run. Do not delegate merely because a
candidate role exists. Project guidance authorizes useful delegation; it is
not a blanket swarm requirement or a typo-fix ritual. An explicit user opt-out
wins. Avoid recursive fan-out and repeated dispatch batches; consider another
worker batch only when returned evidence reveals new independent work.
Dispatch batches do not define product waves.

Suggested routing:

| Work | Worker profile | Parent retains |
|---|---|---|
| Repository map, focused log/source extraction | Luna `high`, read-only | Synthesis and conflicting evidence resolution |
| Test cases or a targeted test run | Luna `high` | Choosing adequate coverage and accepting result |
| Well-scoped nontrivial documentation or implementation to a settled contract (sequential or parallel) | Luna `high` | Product/architecture decisions, integration, final verification |
| Architecture options under real uncertainty | Astra `medium` consultant | Decision ownership, implementation, reconciliation |
| Deep threat/system review | Astra `high` only when risk justifies it | Scope, remediation, proof and release decisions |
| Ordinary correctness, design, or product review | Sol `high` | Final disposition and acceptance |

Use an implementation worker for a clearly bounded slice with exact file
ownership and acceptance evidence. Security-sensitive changes, shared
architecture, broad migrations, or tightly coupled visual work stay with the
parent when safe ownership boundaries cannot be established. For design work,
Sol retains visual judgment, product/design decisions, and final surface
acceptance; implementation may be split into component or screen contracts
when ownership and visual integration remain clear. Screenshot-driven work is
not categorically excluded from delegation when such contracts exist.

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
integration checks at the wave boundary, and makes the final user-facing claim.
Reuse scoped evidence only where later changes have not invalidated it; commit
SHA alone does not identify dirty content. A local edit or failure alone does
not authorize another full run. Reproduce/fix failures narrowly, widen when
needed, and state concrete invalidation before repeating broad verification.
Unrelated docs changes do not invalidate all tests; report baseline plus checked
delta instead of calling older evidence a current-tree full pass. Required CI,
security, release, and artifact-bound gates remain applicable.
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
