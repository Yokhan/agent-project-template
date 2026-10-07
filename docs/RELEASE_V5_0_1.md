# v5.0.1 — Skills and product-wave alignment

Release preparation dated 2026-10-07. This document records a candidate, not a
publication claim. Verify the exact GitHub tag, non-draft/non-prerelease release,
CI and asset checksum before deployment.

## Changes

- Public copy now has an explicit acceptance gate shared by writing, feature,
  design and UX review skills: no self-justification, internal production notes,
  revision residue or accidental duplicate blocks. Finished presentation keeps
  truthful limits and cannot invent functionality or future commitments.
- Product waves mean successive usable versions of one product toward its
  agreed final result. Internal routes, task batches, migrations and research
  remain enabling checkpoints. Changed constraints trigger a joint review of
  the final target and remaining waves.
- Workers use focused checks; the parent owns broad integration at a justified
  boundary. No full-suite cascade after small edits, no duplicate worker
  aggregates. Required security, CI and release gates remain mandatory.
- Codex and shared compatibility skills now follow the same planning,
  authorization and project/AgentOS ownership rules. Removed fixed task-size
  quotas, automatic commits, unnecessary phase approvals and compulsory reports.
- Coverage requests analyze measured gaps without silently writing tests or
  fetching tools. Health checks diagnose without implying repair permission.
  Release preparation does not imply publication or downstream apply.
- Task routing now selects the product planner for staged versions of one
  product, no longer treats every mention of a version as a release, recognizes
  Russian migration verbs, and does not read “субагентами” as a bug report.
- Skill validation checks explicit local Markdown file links in entrypoints and
  nested references. Fixtures cover valid/missing targets, nested paths, encoded
  spaces and excluded code/URL examples. This is a file-target guard, not an
  anchor, bare-path or semantic validator.

## Verification record

Local candidate checks are recorded here after integration. Publication gates
on Linux and Windows remain pending until run against the publication commit.

- Codex CLI 0.125.0 app-server `skills/list`, with the canonical project cwd and
  `forceReload: true`, discovered 46 template skills, none disabled, no errors.
  This proves discovery on this host, not implicit selection for every request.
- A local ignored legacy `coverage` copy was found outside the shipped Git
  payload. It was preserved outside the discovery tree; the maintained entry is
  `codex-coverage`. No books, user defaults or downstream projects were changed.
- Independent read-only decision evaluation covered eight requests: staged
  product versions, internal migration, coverage analysis, health diagnosis,
  AgentOS delegation, release preparation, a post-check text delta and required
  security/release gates. The evaluator selected from tracked skill metadata
  before loading relevant rules, without the author's expected answers. Parent
  review found the eight decisions consistent with the intended boundaries.
  This bounded sample is not an autonomous end-to-end execution benchmark.
- Routing and link-guard focused regressions passed during development. Final
  integration results are recorded below.

| Check | Local result |
| --- | --- |
| `scripts/test-template.sh` | 199/200 in one broad run; only the README script count failed. Corrected 71 to 72 and reran that exact check successfully. Setup and native sync smoke passed. |
| Post-run routing delta | Added two plural-version planning cases and passed `test-codex-routing.js`; the earlier broad run is baseline evidence, not a fresh 200/200 claim. |
| `EXPECTED_RELEASE_TAG=v5.0.1 scripts/validate-template.sh` | 0 errors, 0 warnings after count and routing corrections. |
| `scripts/test-hooks.sh` | All 12 hook checks passed on Windows. |
| `scripts/sync-agents.sh` | 0 issues, 0 warnings. |
| `scripts/test-ci-native-exit.js` | Passed, including isolated PowerShell failure propagation. |
| `scripts/check-drift.sh` | 0 errors, 3 age warnings for existing audit/product-boundary/provenance documents; not a freshness or production-runtime pass. |

Host: Windows, Node 24.13.0, Git Bash, Codex CLI 0.125.0. Subsequent changes
record these results and maintain handoff/docs only; check their text/diff
separately instead of repeating the broad suite. Fresh Linux and Windows CI,
including `setup.bat` and pinned-tool bootstrap, have not run for this candidate.

### Public-copy follow-up

The later user request adds the Public Copy Gate to the shared writing rules
and writing/feature/design/UX entrypoints. It supersedes the earlier candidate
archive; the 199/200 baseline above predates this follow-up. Maintained behavioral
scenarios are in `tests/rules/public-copy.test.md`. Wiring checks do not claim
that every generated website has automatically been scanned or reviewed.

Seven independent read-only editing/decision scenarios were reviewed: private
prototype copy, simulated public booking, unapproved future features, residue
outside the hero, legitimate technical language, incident communication and
intentional repetition. The observed outputs respected the boundary: clean
product copy without false transactions or invented commitments. No live site
or product behavior was exercised by this evaluation.

Focused production-standard and skill checks passed. One structural validation
run found only a stale handoff status header after the task body changed; the
header was updated and the exact `progressive-status.js --check` passed.
Other structural checks passed in that run; no second broad pass is claimed.

## Compatibility and publication

This patch retains v5 ownership, sync, model recommendation and external library
contracts. Existing project overlays and AgentOS plans remain authoritative.
No dependency profile or host-wide model configuration is changed.

After authorized publication, use the exact release checkout's native updater,
review the external digest-bound preview, then apply that same plan. Merge the
active wave and verification rules into preserved AGENTS/CLAUDE project
entrypoints; a manifest version alone does not remove conflicting local rules.
Do not automatically delete unfamiliar local skills: inspect provenance and
preserve a recoverable copy before resolving a duplicate.

Read [the migration guide](MIGRATION_V5.md) and
[the release checklist](RELEASE_CHECKLIST.md) for required gates. Live MCP tool
startup and comparative model quality are separate evidence; neither follows
from skill discovery or structural validation. No token-saving percentage or
universal command prohibition is claimed.

## Design basis

Skill Creator guided the removal of competing procedural recipes in favor of
focused entrypoints and shared rules. Official OpenAI guidance describes
description-based selection and progressive loading, so this audit separates
discovery, routing and behavior rather than equating a valid file with a working
workflow: [Build skills](https://learn.chatgpt.com/docs/build-skills),
[App-server skill discovery](https://learn.chatgpt.com/docs/app-server),
[Evaluate skills](https://developers.openai.com/blog/eval-skills).
