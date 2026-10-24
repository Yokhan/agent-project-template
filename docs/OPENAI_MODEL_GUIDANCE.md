# OpenAI Model Guidance

Routing and pricing checked against official OpenAI documentation on 2026-10-24. This is a
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
| Orchestration, contract preparation, integration, product/design/correctness decisions, final verification | GPT-6.1 Sol, `high` | Default parent profile; direct implementation for tiny edits or a concrete scope, judgment, host or coordination-cost reason; user/IDE owns parent settings |
| Well-scoped nontrivial implementation, bounded discovery, log/source extraction, test generation or execution, docs against an explicit contract | GPT-6 Luna, `high` | Exact deliverable and file/write boundary; Sol owns contract/architecture decisions, integration, and acceptance |
| Architecture consultation for real uncertainty, conflicting constraints, complex migration, or a repeated systemic failure | GPT-6 Astra, `medium` | Consultant returns a decision, rationale, risks, and boundaries; Sol remains orchestrator and integrator |
| Deep security/systems review with material threat or systemic risk | GPT-6 Astra, `high` | Exceptional, evidence-backed escalation; routine review remains Sol `high` |

These are practical defaults, not claims that one model is universally best.
Use Astra when the decision's complexity or cost of error warrants it, not just
because a project is new. Luna is the default implementer for useful nontrivial
bounded work, including sequential handoffs. Use Luna `max` or Sol `xhigh` only when supported by the actual host
and justified by a concrete task need; neither is the default, and higher
reasoning effort is not automatically faster or cheaper overall.

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

### Workload and benchmark check, 2026-10-24

Choose by decision uncertainty, required output and accepted-task cost. Large
input alone does not justify Sol: precise extraction can use Luna, while a
short unresolved architecture question can justify Sol. Use the workload table
in `LUNA_EXECUTION_POLICY.md`; retain complete worker contracts and fresh source
grounding.

Current [official API pricing](https://developers.openai.com/api/docs/pricing)
lists Standard prices per million tokens:

| Exact model | Uncached input | Cached input | Output |
| --- | --- | --- | --- |
| `gpt-6.1-sol` | $2.00 | $0.10 | $10.00 |
| `gpt-6-luna` | $0.10 | $0.01 | $0.50 |

Luna is 20 times cheaper per uncached input/output token and 10 times cheaper
per cached input token at these API rates. Sol's model page also documents a
long-context surcharge above 272K input tokens. These are dated rate-card facts,
not a prediction of this account's included allowance.

The [Codex credit rate card](https://learn.chatgpt.com/docs/pricing) separately
lists Sol at 50/2.5/250 credits and Luna at 2.5/0.25/12.5 credits per million
input/cached-input/output tokens at Standard speed. The same page explicitly
says credit prices alone do not determine included subscription usage. Preserve
speed-mode distinctions and do not convert raw token totals into dashboard
percentages using guessed multipliers.

[Artificial Analysis's exact High-vs-High comparison](https://artificialanalysis.ai/models/comparisons/gpt-6-1-sol-high-vs-gpt-6-luna-high)
reports Intelligence Index 50 vs 33, SciCode 56% vs 50%, Terminal-Bench 4.0
52% vs 5%, and output speed 49 vs 123 tokens/s (Sol vs Luna). These results
support testing bounded generation on Luna while retaining difficult autonomous
terminal work and decisions in Sol. They do not establish performance on this
repository. Read the [publisher's methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking):
the index combines different task families, so a single aggregate score cannot
choose a model for every task. No checked source directly validates a universal
input/output-size routing threshold for this workflow.

Compare accepted outcomes on matching contracts and source states. Record
uncached input, cache hits, output/reasoning tokens, tools, speed tier, elapsed
time, corrections and parent integration effort where available. Include child
and parent work in the total; reading and rewriting a worker's output twice can
erase the expected benefit. Keep API estimates, purchased-credit estimates and
observed subscription usage as distinct measurements. The current conversation
replay measures routing coverage, not comparative model quality or savings.

For example, with equal token counts, token mix and Standard API conditions,
splitting the work equally between Sol and Luna leaves Luna with about 4.8% of
the combined uncached-input/output spend at a 20:1 price ratio. A low spending
share therefore does not establish a low workload share. Warm-cache conditions
also matter: one million Sol cache-hit tokens and one million Luna uncached
input tokens both list at $0.10, before output and other charges. Avoid replaying
large already-understood context merely to move a call to the cheaper model.

Treat the routing matrix as a hypothesis. Validate with representative tasks
before making quality, latency, cost, or savings claims. Compare complete task
outcomes, correction/review work, elapsed time, and aggregate usage where those
measurements are available. Token-price differences do not by themselves prove
lower cost per accepted task; subscription limits and API billing are distinct.
