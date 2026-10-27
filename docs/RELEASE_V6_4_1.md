# v6.4.1: Luna worker policy and coordinator evidence

Prepared source candidate. Publication requires a final scoped commit, exact-tag
Linux and Windows CI, checksum-bound assets, release metadata and a canonical
Git archive match. This note does not establish publication or installed
activation.

## Superseded v6.4.0 candidate

The `v6.4.0` tag is immutable at commit `08ebc055`. Exact-tag CI run
[40475986739](https://github.com/Yokhan/agent-project-template/actions/runs/40475986739)
was cancelled before publication. Do not move or delete the tag. No v6.4.0
release or consumer update followed; v6.4.1 supersedes it as the next candidate.
The previous stable release is v6.3.2 at
`9b52ed7e8e318c5ce738860e7d3f832ef81ee615`; its authorized 36-target rollout is
complete.

## Candidate scope

- The owner restored GPT-6 Luna High for future bounded workers. Preserve
  already-running workers and user-owned parent model, effort and capacity
  settings. Actual model and effort still require correlated runtime evidence.
- Sol 6.1 High retains material architecture consultation; the parent remains
  decision owner. DeepSeek Flash supports bounded, read-only coordinator advice
  and may optionally execute bounded, low-uncertainty tasks when authorized host
  tools are available. Execution requires a reviewable host response and exact
  output for parent integration. It does not earn Luna worker credit or bypass
  security/editorial review. The canonical API model name is `deepseek-flash`;
  an observed Orca alias alone does not prove effective provider identity.
- Coordinator reporting uses a 45-minute cadence and a separate five-minute
  analysis loop. Watcher activation, durable report enqueue and visible assistant
  rendering require separate evidence. Enqueue does not prove rendering, and a
  30-minute no-change heuristic marks `STALL_SUSPECT`; it does not authorize
  termination.

## Wave evidence and remaining gates

The revised `luna-coordination-r2` baseline retains four equally weighted
outcomes after the human model change. Current integration acceptance is 3/4;
shipped outcomes are 0/4. These counts describe source contracts and shipped
outcomes separately; they are not test, file, token or savings percentages.

Focused source checks and independent review are complete. Exact-commit and
exact-tag CI, checksum/metadata/archive verification and any new consumer
installation remain separate gates. No model quality, runtime adoption, savings
or product acceptance claim follows from the source candidate.
