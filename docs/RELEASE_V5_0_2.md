# v5.0.2 — Bounded implementation routing

Release notes for the v5.0.2 source snapshot. This document is not publication
evidence. Verify the exact tag commit, successful release workflow, GitHub
Release state and packaged asset checksum before calling the release published
or rolling it out.

## Changes

- For well-scoped, nontrivial implementation, GPT-6 Luna High is the recommended
  bounded implementer when delegation is supported and useful. That can be a
  sequential handoff, not only parallel fan-out. GPT-6.1 Sol retains contract
  and decision ownership, then integrates and accepts the result. Tiny edits
  remain direct.
- Six Codex skills were updated to align implementation routing and orchestration
  with the shared contract: `codex-agent-router`, `codex-design-workflow`,
  `codex-feature-workflow`, `codex-pipeline-workflow`, `codex-sprint` and
  `codex-subagent-orchestration`. The policy also applies to eligible MCP
  workers; it does not guarantee an available model or prove a host adopted the
  recommendation.
- Candidate policy remains aligned across CLI and MCP routes. Candidate choice
  still respects explicit write intent, user opt-out, available host slots and
  architecture/ownership blockers. Required independent verification for
  high-risk state changes remains in force and is not displaced by an
  implementer.
- The patch changes routing guidance, not project-wide user/IDE defaults or
  product behavior. It makes no claim of runtime adoption, cost savings,
  published state or downstream rollout.

## Verification status

The integrated local release gate passed on 2026-10-07: template smoke 201/201,
hooks 12/12, structure/version validation, native-exit propagation and entrypoint
parity. Drift detection reported no errors and two document-age warnings. MCP
tests passed, including routing parity after the final classifier correction.
Codex discovered 46 repository skills without errors; all six changed skills
were enabled. Independent review confirmed the corrected read-only and
implementation-verb cases. Details are in [the release checklist](RELEASE_CHECKLIST.md).

The publication workflow must still validate the immutable commit on Linux and
Windows before publishing its checksum-bound archive. Check that workflow and
the exact GitHub Release for publication evidence. No downstream sync or
effective-worker-model guarantee is represented by these notes.

## Grounding applied

Fresh primary reading informed these notes: concrete, contextual facts replace
unsupported evaluation; readers need the comparison point that makes a result
meaningful; and acceptance is described as a useful action within explicit
limits. Accordingly, the notes separate the recommendation from runtime
adoption, list the preserved blockers and gates, and distinguish historical
focused reruns from the pending release acceptance evidence.
