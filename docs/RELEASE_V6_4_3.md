# v6.4.3 Candidate - Child Hook Ownership

Status: prepared candidate; not published. The stable release is
[v6.4.2](https://github.com/Yokhan/agent-project-template/releases/tag/v6.4.2).
Do not use v6.4.3 for consumer rollout until exact-commit Linux/Windows
preflight, exact-tag Linux/Windows CI, and release asset verification pass.

## Change

When this host supplies an observed child identity with `UserPromptSubmit`, the
hook resolves that prompt through the child's recorded `SubagentStart` and
keeps it in the parent request ledger. It does not create a new logical request
or move the session's current request. Parent control notices and `Stop` remain
associated with the parent request. Unknown children and turn mappings that
conflict with the observed child are refused.

The hook adds instructions scoped to the child task, including its assigned
source-reading, security, editorial, and exact-artifact duties. It presents the
parent ledger as routing and ownership evidence. Parent-level delegation,
source packets, editorial application, and final acceptance are not added to
the child's assignment.

## Evidence and limits

The behavior is scoped to locally observed hook metadata. Current Codex hook
documentation lists `agent_id` for `SubagentStart` and `SubagentStop`, while
the documented `UserPromptSubmit` fields are `turn_id` and `prompt`; this
candidate does not claim every host supplies a child identity on that event.
The focused synthetic child-routing fixture passed with
`node scripts/test-codex-hooks.js --child-routing-only`. This is source/fixture
evidence only; it does not establish native activation or full release
acceptance.

This patch does not rewrite historical ledgers or change timeouts, budgets,
watchers, model or effort settings, or native activation. v6.4.3 is not
published. Exact-commit preflight and exact-tag CI gate publication. After
publication, downloaded checksum, release metadata and canonical archive
verification gate rollout.
