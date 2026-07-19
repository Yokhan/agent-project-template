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
- Progressive JPEG truth: every implementation slice completes the product's real purpose end to end at its declared detail level. Architecture, status, tests, debug markers, mocks, and callable stubs may support a slice but cannot impersonate the product outcome.
- Change strategy: compatibility protects verified user, data, and public
  contracts rather than old implementation. Causal architecture evidence found
  during reading triggers an evidence-backed destination and transition
  decision before the first patch; a second failed repair is the fallback gate.

## Current Step
Benchmark released `v4.9.0` on representative downstream projects before broad
rollout. Measure answer recall first, then token use, tool calls, latency, index
time, peak memory, and disk. Keep Engram for decisions, codebase-memory as the
only persistent code graph, and the remaining tools task-routed and on-demand.
Do not claim realized savings until the benchmark gate passes.

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
- Applying the new template to every downstream project.
- Reworking each downstream product UI.
- Changing user-level Codex or IDE model/sandbox defaults.
- Treating planning, research, architecture-only work, or a debug harness as a delivered product slice.
- Recreating, proxying, or bundling Glavred.
- Publishing or tagging the Change Strategy Gate before its behavior and
  downstream sync contract are verified.
