# Agent Project Template v6.1.2

This compatible patch was published on 2026-10-24 at immutable commit
`e2c8bb6566a847c0db3773918672b5731d6f3385`. The stable, non-draft
[release](https://github.com/Yokhan/agent-project-template/releases/tag/v6.1.2),
exact-tag CI and downloaded assets are verified.

## Changes

- Repairs Russian conversational execution-intent routing, including colloquial
  commands and context-dependent requests. Questions, negated actions and
  unlinked short continuations do not gain write authority from this repair.
- Normalizes recognized browser context, attachment preambles and structured
  clarification replies on ordinary prompt submission and native service-chat
  request recovery. The request ledger retains the raw prompt hash and the
  normalization provenance.
- Allows a short continuation to inherit only the accepted task from the same
  session. It records the source request and prompt hash as fresh continuation
  evidence. Unlinked, malformed or unresolved context remains visible and
  cannot seed future execution authority.
- Adds `scripts/codex-delegation-report.js` to report observed native Luna calls
  and completed, integrated useful work. It separates all-request share from
  eligible-task coverage, and flags pending requests and unverified runtime
  profiles. A requested model or prepared worker contract does not count as a
  call; integration provenance does not establish semantic quality.
- Clarifies workload selection by decision uncertainty and required output.
  The 50% Luna coverage floor is a routing diagnostic, not a quota-saving
  result. Input/output size thresholds remain uncalibrated; spending savings
  require a comparison of equivalent accepted outcomes.

## Verified publication and local rollout

- All six [preflight jobs](https://github.com/Yokhan/agent-project-template/actions/runs/40070470065) and the
  [exact-tag Linux/Windows release workflow](https://github.com/Yokhan/agent-project-template/actions/runs/40070918272) passed. The
  Windows Semgrep health probe failed once after installation; rerunning the
  failed job on the same immutable tag passed without a source change.
- Downloaded archive: 1,129,422 bytes; SHA-256
  `ca9bbb23b1df817545d2c6abbbb3ad0c2a1008f8f98c873ce09e20e090fbcb60`. Metadata, checksums
  and canonical Git archive bytes match. Canonical comparison uses the
  command-local `-c core.autocrlf=false` setting on Windows.
- The owner-authorized local rollout updated 36 consumers from 6.1.1, retained
  external rollback bytes and project rules, passed six focused checks per
  consumer, and converged to zero pending writes/conflicts. Three entrypoint
  line-ending repairs use unchanged baseline checks plus a focused text delta.
  Nineteen older/unknown-version consumers remained outside the approved scope.
- Live activation in every already-running chat and quota savings remain
  unverified; configured profiles and file convergence do not prove either.

## Local evidence available before release integration

An earlier local validation report records a `validate-template`
subset with zero errors. Its 142-input replay raised required routes from 15 to
61; in a selected set of 31 execution cases, 30 were delegated and one remained
gated by change-strategy policy. These figures describe routing replay and
local validation only. They do not establish the current candidate's CI or
publication state.

## Prior runtime evidence

An earlier native CLI acceptance observed a request with a runtime-correlated
GPT-6 Luna High child that completed and was integrated. This is prior-root
runtime evidence, separate from validation of the current candidate. It does
not establish current candidate CI or publication, generalize to a workload
benchmark, or demonstrate token/quota savings. The release gate and exact-tag
publication checks remain pending.

## Install and update

After the exact `v6.1.2` release and its assets are verified, use the pinned
commands in [the canonical release protocol](TEMPLATE_RELEASES.md). This source
snapshot alone does not authorize rollout. The verified local rollout above
does not authorize updates to other consumers.
