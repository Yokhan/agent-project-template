# v6.3.1 — Evidence-based progress and owned recovery

This compatible patch makes long-running delivery reviews explicit. It adds
the shared rule before consumer rollout; publication, installation, watcher
activation and useful product progress require separate evidence.

## Rule changes

- Review every tracked project at the shared runtime's configured report
  cadence, including unchanged, paused, externally blocked and completed work.
  The current machine configuration uses ten-minute reports; the template does
  not install a timer in each project.
- Distinguish operational activity from material progress. Reads, pings and
  repeated tests may show an active executor without advancing a user outcome.
  A newly accepted patch, artifact, user path, dependency or release gate can
  establish a material change. Preserve the existing repeated-failure strategy
  breaker and select the nearest authorized useful action.
- Time without change establishes only `STALL_SUSPECT`. Refresh current
  request/turn/fence, tool outcome, relevant artifact and owned runtime evidence
  before a control action. Preserve declared long jobs, user pauses and choices,
  completed conceptual work and genuine external waits.
- Recovery requires verified ownership, supported host controls and actual
  settlement before resuming the same session/history. Keep finite budgets and
  dedupe. Unknown ownership is escalated; no unknown OS process is killed.
- Report the exact blocking layer and owner. Independently accepted units keep
  their own release gates and can ship without waiting for an unrelated unit.

The rule lives in the existing
[product goal loop](../.claude/library/process/product-goal-loop.md#delivery-observation-and-recovery),
with a short pointer from the orchestration skill. Existing validator anchors
and proportionality scenarios check the contract; they do not prove live
recovery capability or a working machine watcher.

## UI workflow already present in v6.3.0

The [shared recipe](../.claude/library/process/product-delivery-recipes.md),
[design pipeline](../.claude/library/domain/domain-design-pipeline.md),
[design-system contract](../.claude/library/domain/domain-design-system.md),
[design skill](../.agents/skills/codex-design-workflow/SKILL.md) and its
[checks](../.agents/skills/codex-design-workflow/references/design-checks.md)
already cover source discovery, existing tokens/components/assets, optional
style-grounded image exploration, direction approval, implementation mapping,
settled geometry and the actual consumer/user path. Source routing selects
these workflows. Request-bound Stop checks validate handoff consistency and
evidence hashes; they do not accept the visual design or force image generation.

Local project evidence was studied separately: an accepted generated UI
direction can precede source integration while browser, consumer, device and
production acceptance remain open. Private prompts, images and project evidence
are not copied into this public template. No image-generation hook is made
mandatory for every edit.

## Activation and rollout boundary

The existing machine coordinator watcher is a separately owned local tool.
Local activation requires observed report delivery and a singleton process/start
receipt; this source release does not establish that activation. A durable report
queued to a busy coordinator does
not prove that the coordinator already showed assistant prose to the user.
Capacity monitoring remains a separate existing process.

After exact-commit and exact-tag platform CI, verify the stable release and
downloaded checksum, metadata and canonical Git archive. Consumer updates use
one exact verified release and its native updater: preview, inspect ownership
and dirty conflicts, then apply the same digest-bound plan with rollback.
Preserve project-owned plans/AgentOS graphs and actual model/settings. Missing
or deleted roots are not recreated; unsafe or unsupported transitions remain
held individually. No source self-sync or per-project watcher installation.
