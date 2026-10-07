---
name: codex-design-workflow
description: "Design or refine UI, UX, frontend screens, and game UI using the project's visual system. Use for implementation, visual review, accessibility, responsive adaptation, or design-tool work; use the design-system workflow for broad system work."
---

# Codex Design Workflow

Read:

- `.claude/library/domain/domain-design-pipeline.md`
- `.claude/library/domain/domain-design-system.md` for design-system, Storybook, component-library, or token work.
- `references/design-command-modes.md` for M+ design work, command-mode requests, register selection, critique, hardening, or polish.
- `references/design-checks.md` for compact browser, accessibility, overflow, and motion checks.

## Workflow

Start from the requested outcome and scope. Read the design pipeline and the
relevant project context, then inspect existing tokens/components before
changing the surface. For a screen or flow, consider the user job and subtract
unneeded UI before adding controls. Apply only the analysis, references,
inventory, implementation, and cleanup steps that help this change; a narrow
edit does not need a full phase-by-phase pass. Add future-facing seams only
when the accepted change depends on them.

Choose the smallest useful design mode. Use `references/design-command-modes.md`
when the user requests a named mode or the decision needs register-aware
judgment. Use `references/design-checks.md` to select relevant checks.

## Hard Gates

- `tasks/goal.md` owns product/business priority; root `DESIGN.md` owns visual direction and guardrails.
- Do not overwrite a project `DESIGN.md` without explicit product-owner approval.
- No raw visual values when tokens or variables exist.
- No raw shapes when a component exists.
- Every container uses layout mode, flexbox, or grid.
- New or materially reworked full screens make their anatomy clear: root frame,
  base background, independent background composition, content frame, and
  optional overlay layer. A focused edit need only respect the affected layers.
- Interactive controls account for default, hover, active, focus, disabled, loading, error, and empty states where applicable.
- Represent accepted future behavior only when the current change depends on a
  known contract; keep incomplete behavior clearly unavailable or safely
  bounded.
- If a broad screen/component change lacks a material product decision or
  contract, resolve or propose that decision before implementing beyond the
  accepted scope.
- Later layers must retire old wrong UI layers. Do not preserve stale disabled controls, hidden panels, skipped stories, or commented layouts as the normal path.
- Text must not overlap or overflow at target viewports.
- Molecules and larger components must declare lower-layer token/component dependencies.
- New broad design-system work should expose useful foundation tables and
  inspectable stories; a bounded edit to an existing layer needs focused
  evidence for the changed contract.
- When adding panels, persistent lists, banners, advice blocks, or secondary
  controls, consider whether existing UI should be removed, collapsed, or moved.
  Keep the change focused on the current primary job and report only applicable
  subtraction findings.
- Stubbed UI behavior must be dev-only, explicitly unavailable, or safe no-op. Do not make product users believe incomplete behavior is production-ready.

## Screen Anatomy Gate

For a new or materially reworked full screen, app shell, landing page, docs
page, auth page, dashboard, or full-page Storybook example, make these layers
clear:

1. Name the root frame: viewport/min-height, isolation, overflow, base surface, and base text color.
2. Name the base background: flat fill, gradient, image/media slot, or another approved tokenized surface.
3. Name the background composition: decorative/media layer independent from content spacing.
4. Name the content frame: safe-area, responsive padding, max-width/grid, column model, and allowed organisms.
5. Name the overlay layer policy: modals, drawers, toasts, sticky actions, or none.

Bounded surfaces and edge-to-edge sections use different layout rules. If the boundary is visible (glass/card/panel/modal/framed media), the surface owns internal padding and content slots. If the boundary is not visible, content aligns to the content frame/grid and must not be wrapped in a fake card just to create spacing.

## Command Modes

Use the smallest mode that matches the request:

- `shape`, `craft`, `audit`, `critique`, `distill`
- `harden`, `polish`, `adapt`, `clarify`, `typeset/layout`

Read `references/design-command-modes.md` before using a mode for M+ work or when the task needs register-aware judgment. Modes select workflow depth; they do not lower the production bar.

## Hardening Evidence

Apply the **Public Copy Gate** in `.claude/library/technical/writing.md` to
customer-facing content, including UI states, metadata and accessibility text.
Keep implementation notes in the owner report; verify the actual action before
showing a success message. Inspect the assembled surface for accidental repeats.

For broad or risk-bearing UI work—especially product surfaces, forms,
dashboards, app shells, and design-system primitives—close out with rendered
evidence suited to the change:

- desktop and mobile viewport check;
- geometry check for important controls;
- long text, long word, large number, empty data, and many-item stress;
- loading, error, empty, disabled, focus, hover, active, and default states where applicable;
- slow/offline/API error behavior when the UI depends on network data;
- 200 percent zoom or text scaling when feasible;
- reduced-motion behavior for animated surfaces.

If browser, Storybook, or screenshot evidence is unavailable, state what could
not be checked and the resulting limitation instead of calling the UI
production-ready. Report confidence or a main doubt only when it helps explain
a material uncertainty.

## UI Subtraction Gate

When adding or materially rearranging UI, consider what should be removed,
hidden, collapsed, or moved. Do not add panels without checking whether they
serve the task.

Identify the primary user job while allowing supporting tasks when they belong
in the same surface:

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
- Keep main tap targets usable and consistent with the platform or project
  accessibility standard; check geometry when the change affects it.
- Use disclosure for long progression matrices.
- Do not show full wallet on run screens unless spending is possible there.
- Do not show meta-upgrade advice inside an active run unless there is a direct action.
- One danger state gets one primary textual signal; the rest should be visual treatment.

For reviews about adding or trimming UI, use the relevant subtraction lens:
what to keep, remove, collapse, or move, and what (if anything) to add. Report
only applicable findings; existing UI need not be removed when it serves the
task.

For Figma writes, also use `$codex-figma-workflow`.
For a new broad design system or substantial system-contract change, use
`$codex-design-system-workflow`; for a bounded edit to an existing system layer,
use only its relevant guidance and focused checks.
