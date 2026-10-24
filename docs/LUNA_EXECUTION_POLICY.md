# Luna execution and measured delegation

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

## Coverage target

The minimum target is Luna involvement in 50% of eligible execution/research
requests in a bounded session window. The default policy still requires useful
Luna work on every supported, nontrivial bounded execution route. Fifty percent
is a floor for detecting regressions, not a reason to retain half of suitable
work in Sol.

Run:

```text
node scripts/codex-delegation-report.js --session <native-session-id> --limit 20
```

Read both denominators: all requests, and requests whose native delegation gate
requires work. Required requests with a recorded fallback remain in the eligible
denominator. Report pending requests, excluded routes, errors and unverified
profiles separately. An incorrectly skipped route can artificially improve the
eligible rate; replay realistic conversation inputs as a separate routing check.

A correlated started Luna counts as a call. Completed, integrated Luna work also
requires a completion event and a current-request integration record with scope,
acceptance and a concrete result. A role name, requested model, prepared contract,
fallback or test double does not count as actual execution. The integration
receipt establishes provenance, not semantic quality: the parent must inspect
the delivered result.

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
