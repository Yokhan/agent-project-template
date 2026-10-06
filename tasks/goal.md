# Product Goal

## Final Outcome
`agent-project-template` generates and maintains production-grade agent-ready projects where Codex and Claude preserve final product intent, route work consistently, plan risky work, and verify user-facing outcomes instead of shipping prototype-quality drift.

## Product/Business Priority
The primary user is the downstream product team or operator using a generated project. Every plan or improvement should first improve that team's product-user experience or app-specific business outcomes: safer delivery, faster path to value, adoption, retention, lower support load, revenue instruments, loyalty, conversion, activation, or the KPI the application actually uses. Technical cleanup is justified only when it directly protects or unlocks those outcomes.

## Quality Bar
- UX: agents verify full user journeys, dead ends, states, and return paths for product surfaces.
- Safety: high-risk work uses explicit route, risk, rollback, and verification gates.
- Privacy: auth and identity tasks minimize personal data and require explicit field justification.
- Reliability: template scripts and validators fail on broken contracts before downstream sync.
- Performance: generated projects avoid unnecessary startup/context bloat.
- Accessibility: design and UI work includes keyboard, focus, contrast, motion, and responsive checks.
- Design system: tokens, components, composition trace, Storybook, and rendered geometry gates are required.
- Data/API: contracts, schemas, and validation are part of product quality.
- Docs: linked docs are treated as product surfaces and verified by route/layout/assets/404 checks.
- Domain tone: plans, audits, and reports match the user's language and project vocabulary.
- Staged delivery truth: agree on the final outcome and approximate useful waves, then derive the detailed nearest-wave plan. A wave returns a whole useful result at its declared scope or an inspectable bounded uncertainty decision. Internal enabling tasks, tests and stubs support it but cannot impersonate delivery. Material promise/constraint/wave changes need approval; internal steps remain autonomous.
- Change strategy: compatibility protects verified user, data, and public
  contracts rather than old implementation. Causal architecture evidence found
  during reading triggers an evidence-backed destination and transition
  decision before the first patch; a second failed repair is the fallback gate.

## Current Step
Verify and publish `v5.0.0`, then send Ui storybook the user-authorized instruction
to update all projects under its management using a Sol High swarm: first a
reviewed canary, then the remaining managed fleet. Root does not modify downstream
projects itself. Publication requires exact commit, release
CI, non-draft/non-prerelease GitHub Release and asset checksum evidence; source
version markers alone are not publication proof. Preserve downstream ownership.

## Dependencies
- Shared `.claude/library/` rules.
- Codex skills in `.agents/skills/`.
- Template validation scripts.
- Agent SOT validation.
- Downstream sync release flow.

## Open Risks
- Router expansion could become too broad if gates are not kept backwards-compatible.
- More rules can increase startup noise if entrypoints are not concise.
- Downstream projects still need release-tag sync after the template is ready.
- Ten installed tools must not become ten always-active MCP surfaces; tool-schema
  noise, startup latency, index duplication, and supply-chain exposure require
  stack-aware activation and an explicit full profile.
- Published token-reduction figures are mostly project/vendor results; local
  representative measurements are required before claiming realized savings.
- Representative downstream trees are heavily dirty; rollout must preserve
  their existing work and use one reviewed project at a time.
- A clean Git tree can still diverge from its template manifest: the
  `YokhanAccountService` preview found a committed template-owned README
  conflict and did not reach a complete sync report.
- Codex CLI surfaces can expose different multi-agent runtimes; automatic fan-out must not assume a custom model profile was applied without runtime evidence.
- Glavred recreation is a separate product task; this release must keep the provider explicitly not configured and not run.

## Out Of Scope For Current Step
- Root directly applying updates to downstream projects; fleet execution belongs
  to Ui storybook after the authorized post-release handoff.
- Reworking each downstream product UI.
- Changing user-level Codex or IDE model/sandbox defaults.
- Treating planning, research, architecture-only work, or a debug harness as a delivered product slice.
- Recreating, proxying, or bundling Glavred.
- Updating projects outside Ui storybook's managed scope.
