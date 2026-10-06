# OpenAI Model Guidance

Snapshot checked against official OpenAI documentation on 2026-10-06. This is a
task-routing recommendation, not a benchmark of this repository or a guarantee
that a given host can run a requested profile. Recheck the linked sources when
model availability or client behavior matters.

Sources:

- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/models
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-6-astra

## Recommended task routing

| Work | Recommended profile | Scope |
|---|---|---|
| Orchestration, normal implementation, integration, product/design/correctness decisions, final verification | GPT-6.1 Sol, `high` | Default parent profile; the user/IDE owns the parent session configuration |
| Bounded discovery, log/source extraction, test generation or execution, docs, implementation against an explicit contract | GPT-6 Luna, `high` | Exact deliverable and file/write boundary; Sol owns architecture, integration, and acceptance |
| Architecture consultation for real uncertainty, conflicting constraints, complex migration, or a repeated systemic failure | GPT-6 Astra, `medium` | Consultant returns a decision, rationale, risks, and boundaries; Sol remains orchestrator and integrator |
| Deep security/systems review with material threat or systemic risk | GPT-6 Astra, `high` | Exceptional, evidence-backed escalation; routine review remains Sol `high` |

These are practical defaults, not claims that one model is universally best.
Use Astra when the decision's complexity or cost of error warrants it, not just
because a project is new. Luna may implement when the contract and scope are
bounded. Use Luna `max` or Sol `xhigh` only when supported by the actual host
and justified by a concrete task need; neither is the default, and higher
reasoning effort is not automatically faster or cheaper overall.

## Capability and evidence boundaries

- Check model and effort support in the actual Codex client, account, and
  orchestration path before depending on a profile. API model support does not
  establish Codex or AgentOS support.
- The current AgentOS launcher supports only `low`, `medium`, and `high`
  reasoning efforts. Do not request `max` or `xhigh` through that path unless a
  later capability check verifies support; a silent fallback is not evidence.
- A requested profile is not evidence that it ran. Record requested and
  effective model/effort separately. If runtime metadata cannot establish the
  effective values, report them as `unverified`; never infer them from a
  prompt, role name, successful spawn, or output quality.
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

Use parallel workers only for independent work with material parallel value.
The starting cap is three children per task, also constrained by host slots.
Prefer exact, non-overlapping write scopes; the parent keeps integration and
acceptance. After two failed approaches, stop repeating variants and re-diagnose
the cause, scope, and strategy.

For API implementations, consult current official model and endpoint guidance;
Codex custom-agent profiles and Responses API request parameters are different
configuration surfaces. Do not transpose API settings into Codex config.

## Measurement

Treat the routing matrix as a hypothesis. Validate with representative tasks
before making quality, latency, cost, or savings claims. Compare complete task
outcomes, correction/review work, elapsed time, and aggregate usage where those
measurements are available. Token-price differences do not by themselves prove
lower cost per accepted task; subscription limits and API billing are distinct.
