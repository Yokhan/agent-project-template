# Luna execution and measured delegation

The filename remains for existing links. Historical Terra traces remain readable and are counted separately; they do not contribute to the Luna target.

Sol defines scope, resolves material product/architecture decisions, integrates
results and accepts the outcome. Luna High performs bounded execution: inspect
the assigned sources, make the change, and run focused checks. A read-only Luna
can gather evidence before an unresolved decision; that does not authorize edits.
The existing `writing_editor` profile is Luna High. Product, security and visual
acceptance retain their existing judgment profiles.

## Select by uncertainty and output work

| Work shape | Execution choice | Parent responsibility |
| --- | --- | --- |
| Broad context with conflicting requirements or a consequential unresolved decision | Sol synthesizes and decides; Luna may extract specified facts | State the decision and constraints before assigning changes |
| Many sources but a precise extraction, comparison or inventory question | Bounded Luna reading, split only when the source boundaries are independent | Resolve conflicting evidence and inspect provenance |
| A precise contract, limited source scope and substantial code or text output | Luna performs the complete inspect/change/focused-check cycle | Integrate and accept without repeating execution |
| A finished nonfiction draft needing editorial judgment against supplied facts and books | Independent Luna `writing_editor` | Resolve findings and preserve the fresh reading/review gate |
| Broad, unreproduced terminal failure or architecture problem | Sol diagnoses and bounds the next experiment | Hand off a reproducible file-scoped repair once the uncertainty is resolved |

Input size alone does not select Sol. A large document with a precise extraction
question can suit Luna; a short question with a costly unresolved decision can
require Sol. Give workers the necessary context and exact source references,
not the full chat history. Do not strip acceptance criteria or source material
to make a contract look small. A large output is useful only if it is required
by the accepted deliverable.

Keep sequential workers when one bounded cycle is useful; add parallel workers
only for independent results. Escalate after diagnosed failures or demonstrated
quality gaps, not just because a weaker model is available. Numeric input/output
thresholds remain uncalibrated until measured on comparable local tasks.

## Optional observed fast host

An accepted worker contract may include `fastWorker` with `needSpeed: true`,
`observedHost` availability/authorization, transport, selected model, observation
time and tool capabilities, plus required capabilities. `getFastWorkerDecision`
in `scripts/lib/external-worker-policy.js` permits only bounded, explicitly low-
uncertainty work for execution roles (`implementer`, `tester`, `docs_researcher`,
`scout`, `log_analyst`, `summarizer`, `pr_explorer`). Host evidence must be under
15 minutes old and cover the assigned read/write operation. Unavailable, stale
or unsupported observations return a reasoned native Luna fallback. Judgment,
integration, strategy, security, editorial and high/critical-risk work stay on
their required native route. The exact observed OpenCode alias is preserved as
a host label: `opencode-go/deepseek-v4.1-flash`; API transport accepts the
documented IDs `deepseek-flash`, `deepseek-v4-flash` and
`deepseek-v4-flash-vision-exp`. These labels do not verify provider identity or
effective model. This is an optional contract choice, not a global model
setting, automatic API purchase or background network call.

## Coverage target

The minimum target is completed, integrated useful work on 50% of eligible
current-preferred execution/research requests in a bounded session window.
Useful work can be native Luna execution or a qualifying request-bound external
host response with parent integration. The default execution route still
requests Luna; the optional fast-host path does not create a Luna call. Fifty
percent is a regression floor, not a reason to retain half of suitable work in
Sol. The report keeps runtime-correlated native Luna calls and external-host
observations separate; a started call or a submitted response alone cannot pass
the useful-work target.

Run:

```text
node scripts/codex-delegation-report.js --session <native-session-id> --limit 20
```

Read native Luna coverage separately from `eligibleExternalHostObserved`,
`eligibleExternalHostSubmitted` and `eligibleExternalHostUnverified`. An inspected
completed external response plus current-request integration can count once in
`eligibleOffloadedWork`; it never counts as a Luna call or native Luna result.
Pending, changed or mismatched evidence receives no completed-work credit.

Read both denominators: all requests, and Luna-preferred requests whose native delegation gate
requires work. The request-start preferred profile determines the cohort; legacy Terra requests are reported separately. Required requests without a recognized snapshot make coverage incomplete rather than passing or failing the target. Required requests with a recorded fallback remain in the eligible
denominator. Report pending requests, excluded routes, errors and unverified
profiles separately. An incorrectly skipped route can artificially improve the
eligible rate; replay realistic conversation inputs as a separate routing check.

A correlated started Luna with verified model and effort counts as a call. Completed, integrated useful work
also requires a completion event and a current-request integration record with
scope, acceptance and a concrete result. A role name, requested model, prepared
contract, fallback or test double does not count as actual execution. The
integration receipt establishes provenance, not semantic quality or parent
outcome acceptance: the parent must inspect the delivered result and accept the
outcome independently.

Do not spawn filler agents for acknowledgements, missing context, an explicit
opt-out or a task with no useful worker lane. Below-target coverage is evidence
to diagnose routing or ownership, not authority to redo old work. Neither call
coverage nor raw token totals establish a spending percentage. Assess savings
against comparable accepted outcomes; avoid duplicating the worker's execution.

## Input and continuation boundaries

Classify the user's request after removing recognized host browser metadata and
separating clarification answers from the quoted questions. Preserve the raw
input hash and resolution provenance. A short execution continuation can reuse
the current session's accepted task; an unrelated question cannot acquire old
write authority. Preserve read-only restrictions and delegation opt-outs.

Missing or malformed context is a visible limitation. Do not recover an unknown
task by searching other chats or treating arbitrary quoted documents as user
instructions. Stop repair continuations retain their exact original ledger.

## Repair decision and acceptance

This is a production template with existing consumers. The audit found a
classifier/input-boundary defect: common Russian commands were skipped, while
quoted clarification questions were treated as authored writing requests.
Repair plus direct swap preserves the native ledger, ownership checks, runtime
profile correlation, book grounding and user authorization. Replacing the
orchestrator or forcing a model switch for every chat would change unrelated
contracts without evidence. Recovery is reverting this bounded source change;
no migration or historical-ledger rewrite is required.

Acceptance combines focused regression checks, replay of real conversation
inputs, observed Luna execution with correlated runtime profiles, and aggregate
template validation. Replay establishes routing, not model calls. A current
template fix does not update other projects or prove that every desktop host
has reloaded changed hook commands. Release and consumer rollout follow the
canonical release/sync protocol separately.
