# Domain: Design System Production Workflow

## Purpose
Design systems are production contracts, not collections of nice-looking screens.

A usable system must let agents and humans compose product UI without guessing spacing, typography, radius, motion, states, copy density, or component dependencies.

Root `DESIGN.md`, when present, is the project-owned visual contract that agents read before making design decisions. It summarizes the active token/component language without replacing implementation tokens, Storybook, or Figma libraries.

## Required Layers

1. Foundations: color, typography, spacing, radius, shadow, motion, grid, breakpoints, z-index.
2. Atoms: icons, labels, buttons, inputs, badges, dividers, loaders.
3. Molecules: form rows, field groups, search bars, tabs, segmented controls, nav items, alert rows.
4. Organisms: headers, account panels, service cards, forms, tables/lists, empty/error/loading panels, app shells.
5. Templates: repeatable page layouts with real responsive rules.
6. Screens: real product data and navigation states.

Every higher layer must declare which lower-layer tokens/components it uses. If a needed value has no token, stop and add/request the token instead of hardcoding.

## Contract Tables

Storybook, docs, or Figma must expose tables for:

- Typography roles: display, title, section, body, caption, control, data.
- Spacing: container padding, section gaps, component gaps, inline gaps, form gaps.
- Radius: control, card, modal, shell, pill, media.
- Control sizes: height, min width, touch target, icon size, padding.
- Motion: duration, easing, transform distance, opacity rules.
- Layout: page width, grid columns, mobile padding, desktop padding, safe areas.

## Composition Trace

Each molecule, organism, and template should have a visible or testable composition trace:

- Component name.
- Tokens used.
- Child components used.
- States supported.
- Responsive behavior.
- Known exclusions.

This prevents hidden raw values and makes review possible without manually measuring everything.

## Rendered Geometry Gate

Static token references are not enough. Run browser or Storybook checks that compare rendered `getBoundingClientRect()` and computed styles against token values for important components.

Catch at least:

- Parent grid/flex stretching compact cards to full height.
- Buttons using wrong control height, padding, radius, hover/focus state.
- Forms missing label/help/error spacing.
- Text overflow or clipped labels on mobile.
- Icon sizes drifting from token.
- Loading/empty/error panels expanding beyond intended template constraints.

## Product UI Completeness

Landing style is not enough for product UI. A production-ready system also needs:

- Basic forms: input, textarea, select, checkbox, radio, switch, validation, fieldset.
- Account/auth surfaces: login, registration, recovery, expired session, logout confirmation.
- Daily app surfaces: header, nav, list, table, detail, settings, subscription, empty state, loading state, error state.
- Service gateway surfaces: app card, download/action card, access status, quick links, return path.
- Docs/help surfaces: article shell, nav, search, related links, callouts.

## Review Questions

- Can a new product page be assembled without inventing styles?
- Does every non-atomic component depend on lower layers?
- Are all numbers named tokens?
- Does mobile use less chrome and still preserve tap targets?
- Are the states visible in Storybook and testable by an agent?
- Does the design serve the user task or only the brand mood?
