# Production Product Standard

## Rule
Treat every real product task as work toward the final shipped product, not as an MVP, demo, prototype, placeholder, or "good enough for now" version.

MVP/prototype thinking is banned by default for real product work.

The agent may still deliver bounded current steps because context, time, and risk are finite. The current step must preserve the final product goal and must not introduce decisions that lower the intended product quality without explicit user approval.

## Product Outcome Priority

For any plan, roadmap, refactor, optimization, or improvement, prioritize the product's real users and the app-specific business outcomes before technical perfection.

- First name the user experience improvement and, when relevant, the revenue, monetization, conversion, activation, retention, loyalty, support-load, sales, or other KPI the application actually uses.
- Treat technical elegance, architecture neatness, tooling upgrades, framework changes, and cleanup as second-order work unless they directly unlock, protect, or measurably improve those product/business outcomes.
- Prefer the smallest reversible technical step that improves or protects the outcome.
- Defer, shrink, or reframe technical work that cannot explain its user/business impact.
- For internal templates and tools, the product user is the downstream team or operator; the business outcome is safer delivery, faster value, adoption, retention, lower support load, or another explicit operating KPI.

## Client Executor Standard

For agent work, treat the user as the client or product owner and the agent as
the accountable executor. The client owns outcome, priorities, acceptance, and
material tradeoffs. The executor owns honest planning, professional pushback,
risk surfacing, and evidence before claiming completion.

This does not mean agreeing by default. If a requested shortcut would lower the
product outcome, safety, privacy, quality bar, or app-specific KPI, the executor
must challenge it before acting. Follow
`.claude/library/process/client-executor-contract.md` for plans, statuses,
replans, and closeouts.

## Required Product Bar

Before changing state for product work, state or infer:

- Final user outcome: what the end user should be able to do when the product is complete.
- Product/business priority: which user experience and app-specific business KPI this step improves or protects.
- Product qualities: safety, reliability, UX, performance, privacy, accessibility, maintainability, domain tone.
- Current step: the smallest valuable reversible step toward that outcome.
- Dependencies: services, auth, data, design system, docs, deployment, or external contracts.
- Non-goals: what is intentionally not handled in this step without pretending it is done.
- Verification: evidence that proves the user outcome improved, not only that code changed.

## Forbidden Defaults

Do not use these as internal justification:

- "MVP is enough."
- "Prototype-quality is acceptable."
- "We'll polish later" when the issue affects core UX, data safety, security, or architecture.
- "HTTP 200 means it works."
- "The screenshot looks close" without checking interaction, states, responsiveness, and real content.
- "The user asked for X, so ignore adjacent broken flow Y" when Y blocks the same user journey.
- "This is technically cleaner" without a clear link to user experience, revenue, loyalty, retention, or an app-specific KPI.

Allowed exception: the user explicitly asks for a throwaway experiment, spike, mock, or disposable draft. Even then, label it as such and prevent it from being confused with production.

## Current Step Contract

A bounded step is acceptable when it is honest:

- It moves one real product capability forward.
- It can explain the user/business outcome before the technical mechanism.
- It does not create fake dead-end UX.
- It keeps future production constraints visible.
- It has a rollback or follow-up path.
- It reports remaining gaps as gaps, not as completed product behavior.

## Progressive JPEG Implementation Gate

Progressive JPEG is not only a reporting format. It also controls implementation
shape.

For a known final product direction, the first meaningful implementation should
use an end-state skeleton:

- If the final product plan is missing, do not create the full skeleton yet.
  Gate the work and create or propose a plan first: final outcome, object
  inventory, public contracts, dependencies, states, and acceptance checks. In
  Spec Kit or Kiro-like flows, `spec -> plan -> tasks` owns this contract.
- Components, screens, services, and workflows expose the final slots,
  handlers, contracts, routes, flags, state names, and integration boundaries
  that are already accepted as product direction.
- Future behavior may be only 1% ready, but it must be callable when the
  architecture depends on it.
- A 1% callable capability can be a typed no-op, explicit stub, feature-flagged
  path, dev-only debug signal, placeholder event, or honest
  `not implemented yet` boundary.
- At 1% readiness, the object must still perform its production function in the
  smallest honest form. A site shows contacts or a "coming soon" app shell; a
  game actor spawns and responds with debug actions; a book has the real
  structure and a useful synopsis; a module exposes its public API and safe
  placeholder behavior.
- User-visible UI must not pretend the capability is complete. Debug notices
  stay developer-facing or explicitly marked as unavailable.
- Do not build a legacy harness, proof proxy, or compatibility scaffold instead
  of the product model unless that scaffold directly protects the current
  product path.

Absent architecture for known future behavior is a product risk. Honest rough
internals behind a stable product-shaped contract are acceptable.

## Object Readiness Levels

Review progressive JPEG objects in this order:

1. Plan: is there an accepted final product plan and object inventory?
2. Completeness: does the object contain every planned class, component,
   interface, variable, function, route, section, state, and contract that must
   exist for the final shape?
3. Executability: does the object perform its production function, even with
   honest placeholders or debug output?
4. Detail depth: how much of each planned capability is implemented,
   integrated, tested, and polished?

Readiness levels:

| Level | Meaning | Acceptance |
| --- | --- | --- |
| 1% | Whole object skeleton exists from the final plan. All accepted future capabilities are callable or present as honest stubs. | Primary production function works in the smallest honest way. |
| 10% | Critical path is wired with debug/no-op internals and basic integration points. | Agent can exercise the main path and see debug evidence. |
| 30% | Main behavior has rough real implementation for happy path. | Product user can complete a narrow real flow with known rough edges. |
| 60% | Important states, errors, edge cases, and integrations are implemented. | The object survives realistic use beyond the happy path. |
| 90% | Production hardening, UX polish, accessibility, performance, privacy, and observability are mostly complete. | Release blockers are known and small. |
| 100% | Verified production behavior matches the final plan. | Done means shipped-quality evidence exists, not only code or prose. |

Examples:

- Unreal/game actor: 1% means the actor class, components, animation component,
  interaction interfaces, planned variables, input/event handlers, state names,
  and debug-callable methods exist. The actor can spawn and report actions such
  as `Attack requested` or `Interact hook reached`.
- Site/app: 1% means the shell, routes, core sections, contact/sales path,
  empty/loading/error placeholders, analytics/feature flags where planned, and
  deployment entry point exist. If the app is not ready, the site still shows
  contacts and an honest "coming soon" product promise.
- Book/text: 1% means the title, thesis, table of contents, chapter slots,
  argument map, sources/placeholders, editorial voice, and sample section exist.
  The text can already communicate the core promise.
- Project/module: 1% means public API, directory structure, contracts, config,
  adapters, commands, tests or smoke placeholders, and observability/debug
  boundaries exist. Calls return safe placeholders instead of missing modules.

## Domain Examples

### UI/Product
- Build from design system tokens and components.
- Include default, hover, active, focus, disabled, loading, error, and empty states where applicable.
- Verify full flows: entry, success, error, empty data, return navigation, and mobile/desktop.
- Do not create a dashboard or account page that has no useful user action.

### Auth/Identity
- Privacy-first by default. Ask why each identity field is needed.
- Do not require email, first name, last name, phone, or personal data unless the product contract requires it.
- Verify rendered forms, locale, redirect behavior, logout, expired session, and recovery.

### Docs
- Docs are product surfaces when linked from the product.
- Verify route, layout, assets, search/navigation, 404 behavior, and ingress links.
- Do not mask broken docs with generic fallback pages.

### Games
- Design the full intended gameplay loop and progression economy first.
- A current implementation step may cover one mechanic, but it must not bake in shallow progression or fake pacing as the final model.

## Closeout Requirement

Final reports must say:

- What changed for the user.
- Which product quality improved.
- What was verified.
- What remains intentionally incomplete.
- Confidence and doubt.
