# Domain: Design System Production Workflow

## Purpose
Design systems are production contracts, not collections of nice-looking screens.

A usable system must let agents and humans compose product UI without guessing spacing, typography, radius, motion, states, copy density, or component dependencies.

Root `DESIGN.md`, when present, is the project-owned visual contract that agents read before making design decisions. It summarizes the active token/component language without replacing implementation tokens, Storybook, or Figma libraries.

The design system must declare whether each surface is operating in product register, brand register, or mixed register. Product register prioritizes task clarity, state coverage, density, and user/business outcomes. Brand register can carry stronger art direction, but still needs proof, offer clarity, conversion, and loyalty impact.

## Scope

Use the full layer model, contract tables, and representative stories when
creating a new broad system or substantially changing its overall contract.
A bounded change to an existing layer should inspect that layer and direct
dependencies, preserve the surrounding system, and verify the changed behavior
without rebuilding or documenting unrelated layers.

Add future-facing slots, handlers, states, events, or flags only when the
accepted current change depends on that known contract. Keep unfinished product
behavior explicitly unavailable, dev-only, or safely no-op.

## System Layers

1. Foundations: color, typography, spacing, radius, shadow, motion, grid, breakpoints, z-index.
2. Atoms: icons, labels, buttons, inputs, badges, dividers, loaders.
3. Molecules: form rows, field groups, search bars, tabs, segmented controls, nav items, alert rows.
4. Organisms: headers, account panels, service cards, forms, tables/lists, empty/error/loading panels, app shells.
5. Templates: repeatable page layouts with real responsive rules.
6. Screens: real product data and navigation states.

Every higher layer must declare which lower-layer tokens/components it uses. If a needed value has no token, stop and add/request the token instead of hardcoding.

## Screen Anatomy Contract

Every full screen, template, and full-page Storybook/Figma example starts from the same layered frame contract before product UI is placed:

1. Root frame: viewport/min-height, isolation, overflow, base surface, and base text color.
2. Base background: flat fill, gradient, image/media slot, or another approved surface token.
3. Background composition: absolute decorative or media layer independent from content spacing.
4. Content frame: safe-area, responsive padding, max-width/grid, column model, and allowed organisms.
5. Overlay layer: modal, drawer, toast, sticky action, or temporary system layer only when the scenario needs it.

Headers, heroes, forms, cards, product rails, docs content, and account panels live inside the content frame. Background images, gradients, decorative shapes, and texture layers must not define content spacing or grid behavior.

Bounded vs edge-to-edge rule:

- Visible bounded surfaces (glass, cards, panels, modals, framed media) own internal padding, radius, border/effect tokens, and content-slot rules.
- Edge-to-edge content sections use the page grid/content frame directly and must not be wrapped in fake cards just to create spacing.
- Atomic stories show the atom itself without unrelated frames. Molecule/organism/template stories may add only the minimum wrapper needed to demonstrate the real composition contract.

## Contract Tables

Storybook, docs, or Figma must expose tables for:

- Typography roles: display, title, section, body, caption, control, data.
- Spacing: container padding, section gaps, component gaps, inline gaps, form gaps.
- Radius: control, card, modal, shell, pill, media.
- Control sizes: height, min width, touch target, icon size, padding.
- Motion: duration, easing, transform distance, opacity rules.
- Layout: page width, grid columns, mobile padding, desktop padding, safe areas.
- Screen anatomy: root frame, base background, background composition, content frame, overlay layer, and bounded/edge-to-edge usage.

## Composition Trace

Each molecule, organism, and template should have a visible or testable composition trace:

- Component name.
- Tokens used.
- Child components used.
- States supported.
- Responsive behavior.
- Screen anatomy role, when the component participates in a template or screen.
- Known future behavior exposed through slots, handlers, events, states, or
  feature flags only when the accepted current contract depends on it.
- Known exclusions.

This prevents hidden raw values and makes review possible without manually measuring everything.

If an accepted current contract depends on a capability that is not implemented
yet, keep it clearly unavailable, dev-only, or safely no-op. Do not present it
as production-ready behavior.

When the component sharpens, retire superseded design-system layers. Remove or
replace obsolete variants, stale stories, disabled controls, hidden panels,
release-only exclusion harnesses, and feature flags that no longer belong to the
final component contract. Keep temporary migration scaffolding only with an
explicit removal condition.

## Rendered Geometry Checks

Static token references alone do not establish rendered behavior. For new or
materially changed components, use browser or Storybook checks to compare
rendered geometry and computed styles against relevant tokens. For a focused
edit, check the affected properties and states.

Catch at least:

- Parent grid/flex stretching compact cards to full height.
- Buttons using wrong control height, padding, radius, hover/focus state.
- Forms missing label/help/error spacing.
- Text overflow or clipped labels on mobile.
- Icon sizes drifting from token.
- Loading/empty/error panels expanding beyond intended template constraints.

## Product UI Coverage

When the system scope includes product UI, cover the relevant real product
surfaces rather than treating a landing page as sufficient. Depending on the
accepted product, this may include:

- Basic forms: input, textarea, select, checkbox, radio, switch, validation, fieldset.
- Account/auth surfaces: login, registration, recovery, expired session, logout confirmation.
- Daily app surfaces: header, nav, list, table, detail, settings, subscription, empty state, loading state, error state.
- Service gateway surfaces: app card, download/action card, access status, quick links, return path.
- Docs/help surfaces: article shell, nav, search, related links, callouts.

## Review Questions

- Can a new product page be assembled without inventing styles?
- Is the surface being reviewed in the correct product or brand register?
- Does every non-atomic component depend on lower layers?
- Are all numbers named tokens?
- Does mobile use less chrome and still preserve tap targets?
- Are the states visible in Storybook and testable by an agent?
- Does the design serve the user task or only the brand mood?
