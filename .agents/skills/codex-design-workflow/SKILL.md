---
name: codex-design-workflow
description: "Design and implement UI, UX, CSS, frontend screens, design systems, mockups, and game UI with token-first and component-first gates. Use for design, visual polish, responsive UI, accessibility, or Figma-adjacent work."
---

# Codex Design Workflow

Read:

- `.claude/library/domain/domain-design-pipeline.md`
- `.claude/library/domain/domain-design-system.md` for design-system, Storybook, component-library, or token work.

## Required Phases

1. Context: user journey, viewport, product/business priority, root `DESIGN.md` when present, design language, constraints.
2. Analyze: art direction, UX, UI, flow, behavior.
   - Run the UI Subtraction Gate before BOM or any new panel/control.
3. Reference: inspect existing product/system or gold-standard references.
4. BOM: list tokens, components, states, assets, and content.
5. Discover: search existing components, tokens, and styles.
6. Compose: build tokens -> components -> screens.
7. Validate: screenshot or browser check, responsive check, contrast, overflow, 8-state coverage, and rendered geometry for important components.
8. Iterate: fix deviations and re-check.

## Hard Gates

- `tasks/goal.md` owns product/business priority; root `DESIGN.md` owns visual direction and guardrails.
- Do not overwrite a project `DESIGN.md` without explicit product-owner approval.
- No raw visual values when tokens or variables exist.
- No raw shapes when a component exists.
- Every container uses layout mode, flexbox, or grid.
- Interactive controls account for default, hover, active, focus, disabled, loading, error, and empty states where applicable.
- Text must not overlap or overflow at target viewports.
- Molecules and larger components must declare lower-layer token/component dependencies.
- Design-system work must expose foundation tables and Storybook or equivalent inspectable stories.
- Screens must pass the subtraction gate before adding panels, persistent lists, banners, advice blocks, or secondary controls.

## Command Modes

- `shape`: clarify product job, surface, constraints, and visual lane before edits.
- `craft`: implement a confirmed UI change end to end.
- `audit`: technical quality scan for accessibility, responsiveness, token drift, and anti-patterns.
- `critique`: UX/design review with severity, user impact, and next action.
- `distill`: remove, collapse, or move UI before adding anything.
- `harden`: edge cases, i18n, overflow, loading/error/empty, long data, slow/offline states.
- `polish`: final alignment, spacing, density, hierarchy, and visual consistency pass.
- `adapt`: mobile/desktop viewport and touch-target adaptation.
- `clarify`: labels, error copy, instructions, and support/empty state text.
- `typeset/layout`: typography and spatial rhythm fixes.

Use the smallest mode that matches the request. Modes select workflow depth; they do not lower the production bar.

## Hardening Evidence

For M+ UI work, product surfaces, forms, dashboards, app shells, and design-system primitives, close out with real rendered evidence:

- desktop and mobile viewport check;
- geometry check for important controls;
- long text, long word, large number, empty data, and many-item stress;
- loading, error, empty, disabled, focus, hover, active, and default states where applicable;
- slow/offline/API error behavior when the UI depends on network data;
- 200 percent zoom or text scaling when feasible;
- reduced-motion behavior for animated surfaces.

If browser, Storybook, or screenshot evidence is unavailable, state the residual risk instead of calling the UI production-ready.

## UI Subtraction Gate

Before improving any UI screen, decide what must be removed, hidden, collapsed, or moved to another mode. Do not start by adding panels.

Every screen serves exactly one current user job:

- Product dashboard: scan, triage, decide, act.
- Form/editor: create, edit, submit, recover.
- Commerce/gear: compare, select, buy, equip.
- Settings/admin: configure, grant, revoke, audit.
- Content/log/codex: review history, not drive the primary loop.
- Game run/combat: continue, survive, descend, return.
- Game camp/town: spend, cleanse, upgrade, prepare.
- Game skills: understand growth, train.

Before adding UI, ask:

1. Can the player make a decision from this element right now?
2. Is this information needed every second, or only on demand?
3. Does it duplicate another signal?
4. Does it belong to this mode?
5. Is it competing with the primary action?
6. Can it become a badge, drawer, tooltip, details section, or nav badge?
7. Would removing it make the next action clearer?

General UI rules:

- Keep the current mode's best next action before long lists.
- Collapse secondary diagnostics, explanations, and history until needed.
- Move cross-mode information to the mode where it becomes actionable.
- Prefer badges, drawers, tooltips, details sections, or nav badges for on-demand signals.
- Avoid dead disabled buttons in primary action zones; explain unavailable actions where the user can fix them.
- Reset scroll on major tab or mode changes when old scroll position would hide the new primary action.

For mobile and game screens:

- Keep the current mode's best next action before long lists.
- Keep main tap targets at least 52px high.
- Use disclosure for long progression matrices.
- Do not show full wallet on run screens unless spending is possible there.
- Do not show meta-upgrade advice inside an active run unless there is a direct action.
- One danger state gets one primary textual signal; the rest should be visual treatment.

Design reviews must include: Keep, Remove, Collapse, Move, Add only after subtraction.

For Figma writes, also use `$codex-figma-workflow`.
For token/component library work, also use `$codex-design-system-workflow`.
