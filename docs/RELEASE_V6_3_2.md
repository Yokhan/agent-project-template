# v6.3.2 — Preserve user-owned thread capacity

This compatible patch fixes a consumer validation failure found during the
v6.3.1 rollout. AgentOS kept its existing `max_threads = 6`; the updater preserved
that setting, but the validator rejected it by applying the three-child task
dispatch ceiling to the session capacity setting.

## Changed behavior

The validator accepts positive safe decimal integers for either capacity key.
Digit separators such as `1_000` remain accepted in decimal integer values.
Capacity above the task dispatch ceiling produces a warning rather than a
validation error. Zero, fractional and unsafe integer values remain rejected;
conflicting aliases, depth and model-setting guards remain in place.

The [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
and [subagent guide](https://learn.chatgpt.com/docs/agent-configuration/subagents)
describe the current key and legacy alias as session capacity settings. They
are separate from this template's bounded task dispatch policy. Both pages were
checked on 2026-10-26.

No configuration file is rewritten. The existing task fan-out policy, models,
effort, permissions, lifecycle hooks and managed supervisor stay unchanged.
Accepting a capacity value statically does not prove that a particular client
or host can run that many children.

## Validation and release boundary

The existing agent-policy fixture accepts both capacity keys at six and with
valid digit separators, verifies
that config bytes remain unchanged, and rejects invalid values. This is a
regression check of configuration validation, not a live subagent-capacity test.

The source snapshot is a prepared candidate. Publication requires exact-commit
and exact-tag Linux/Windows CI plus downloaded checksum, metadata and canonical
archive verification. Consumer installation then requires a new reviewed
digest-bound plan and its own acceptance evidence. The historical AgentOS
v6.3.1 check failure remains recorded until the new validator is installed and
checked there.

The delivery/recovery rule and UI workflow from
[v6.3.1](RELEASE_V6_3_1.md) remain in force. This patch does not establish machine
watcher activation, live hook trust, UI acceptance or product deployment.
