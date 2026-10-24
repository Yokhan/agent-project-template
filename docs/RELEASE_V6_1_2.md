# Agent Project Template v6.1.2

This is a prepared compatible patch candidate. This document does not establish
a published tag, passing exact-tag CI, or verified downloadable assets. Do not
roll it out until those release checks pass and the exact GitHub release is
confirmed.

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
snapshot alone does not authorize rollout. No downstream project update is
recorded here.
