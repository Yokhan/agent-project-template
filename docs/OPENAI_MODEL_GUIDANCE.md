# OpenAI Model Guidance

GPT-6 Luna capabilities checked against official OpenAI documentation on 2026-10-27.
The bounded-work profile reflects current project policy, not a benchmark of this
repository or a guarantee
that a given host can run a requested profile. Recheck the linked sources when
model availability or client behavior matters.

Sources:

- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/models
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna

## Recommended task routing

| Work | Recommended profile | Scope |
|---|---|---|
| Orchestration, contract preparation, integration, product/design/correctness decisions, final verification | GPT-6.1 Sol, `high` | Default parent profile; direct implementation for tiny edits or a concrete scope, judgment, host or coordination-cost reason; user/IDE owns parent settings |
| Well-scoped nontrivial implementation, bounded discovery, log/source extraction, test generation or execution, docs against an explicit contract | GPT-6 Luna, `high` | Exact deliverable and file/write boundary; Sol owns contract/architecture decisions, integration, and acceptance |
| Architecture consultation for real uncertainty, conflicting constraints, complex migration, or a repeated systemic failure | GPT-6.1 Sol, `high` | Read-only consultant returns a decision, rationale, risks, and boundaries; the parent retains decision ownership |
| Deep security/systems review with material threat or systemic risk | GPT-6.1 Sol, `high` | Exceptional, evidence-backed review; routine review remains Sol `high` |

These are practical defaults, not claims that one model is universally best.
Use a read-only Sol `high` consultation when the decision's complexity or cost
of error warrants it, not just because a project is new. Luna is the default implementer for useful nontrivial
bounded work, including sequential handoffs. Use Luna `max` or Sol `xhigh` only when supported by the actual host
and justified by a concrete task need; neither is the default, and higher
reasoning effort is not automatically faster or cheaper overall.

When an authorized provider integration supports the task, DeepSeek Flash may be considered
as a fast-worker alternative under its separate provider/architecture contract. It does not
set a native Codex model default or replace the DeepSeek Flash advisor at material
coordinator boundaries.

## Capability and evidence boundaries

- Check model and effort support in the actual Codex client, account, and
  orchestration path before depending on a profile. API model support does not
  establish Codex or AgentOS support.
- The current AgentOS launcher supports only `low`, `medium`, and `high`
  reasoning efforts. Do not request `max` or `xhigh` through that path unless a
  later capability check verifies support; a silent fallback is not evidence.
- A requested profile is not evidence that it ran. Custom-agent TOML may
  override an explicit spawn model or effort. Record requested and effective
  model/effort separately from correlated runtime metadata. If metadata cannot
  establish the effective values, report them as `unverified`; never infer
  Luna (or another profile) from a prompt, role name, successful spawn, or
  output quality.
- Runtime evidence for a child should correlate the parent, spawn, child ID,
  role/profile metadata, child activity/completion, and a wait/result for that
  same child. Use the repository trace validator where applicable.
- Keep parent model, effort, approval, and sandbox under user/IDE/orchestrator
  control. Do not add project-wide model or permission defaults to
  `.codex/config.toml`. Role-specific worker recommendations belong in the
  policy source and supported custom-agent configuration.
- AgentOS owns its Strategy/Tactic/Plan/Todo/Gate graph. Codex routing supplies
  worker contracts; it must not create a competing task graph.

## Prompt and workflow guidance

Give the worker the desired outcome, relevant context, explicit scope and
permissions, acceptance evidence, and expected response. Load only the
instructions and project context relevant to the task. Preserve useful
workflow-specific constraints; remove repeated ceremony that does not change a
decision or protect an observed failure.

Use sequential Luna delegation for useful, well-scoped nontrivial implementation
when it improves execution; parallel workers still require independent work
with material parallel value. The starting cap is three concurrent children
per task, also constrained by host slots. Prefer exact, non-overlapping write
scopes; the Sol parent retains contract decisions, integration, and acceptance.
Keep tiny edits direct, respect explicit user opt-out, and do not delegate
unsafe or inseparable scopes. After two failed approaches, stop repeating
variants and re-diagnose the cause, scope, and strategy.

For API implementations, consult current official model and endpoint guidance;
Codex custom-agent profiles and Responses API request parameters are different
configuration surfaces. Do not transpose API settings into Codex config.

## Measurement

### Workload policy, refreshed 2026-10-27

Choose by decision uncertainty, required output and accepted-task cost. Large
input alone does not justify Sol: precise extraction can use Luna, while a
short unresolved architecture question can justify Sol. Use the workload table
in `LUNA_EXECUTION_POLICY.md`; retain complete worker contracts and fresh source
grounding.

Compare accepted outcomes on matching contracts and source states. Record usage, elapsed time, corrections, and parent integration effort where available. Historical Terra data remains distinct from Luna data; no cost or performance advantage is assumed.

Treat the routing matrix as a hypothesis. Validate with representative tasks
before making quality, latency, cost, or savings claims. Compare complete task
outcomes, correction/review work, elapsed time, and aggregate usage where those
measurements are available. Token-price differences do not by themselves prove
lower cost per accepted task; subscription limits and API billing are distinct.
