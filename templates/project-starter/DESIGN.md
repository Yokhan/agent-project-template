---
name: Project Design Context
description: Agent-readable product design context for this project.
colors: {}
typography: {}
spacing: {}
rounded: {}
components: {}
---

# Design Context

This file is the durable visual source of truth for AI agents working on this project. Keep it short, concrete, and current.

`tasks/goal.md` owns product intent, user value, and app-specific business outcomes. `DESIGN.md` owns visual decisions, design tokens, component behavior, and visual guardrails.

## 1. Overview

Describe the product's visual direction, density, tone, and the user context where the interface is used.

- Product surface:
- Primary users:
- Visual direction:
- Density:
- Accessibility baseline:

## 2. Colors

List only colors that are actually used or intentionally approved. Prefer design tokens or CSS variables over raw values.

- Primary:
- Surface:
- Text:
- Muted:
- Accent:
- Danger/success/warning:

## 3. Typography

Document the type roles agents should reuse. Include exact values only when they exist in the project.

- Display:
- Heading:
- Body:
- Label:
- Data:

## 4. Spacing, Radius, And Layout

Document the spacing/radius/layout scale that keeps screens consistent.

- Spacing scale:
- Radius scale:
- Layout grid or shell:
- Mobile constraints:
- Touch target minimum:

## 5. Components

Describe reusable component behavior and states. Do not duplicate full implementation details; name the contract agents must preserve.

- Buttons:
- Inputs:
- Navigation:
- Cards or list items:
- Tables or data views:
- Empty/loading/error states:

## 6. Do's And Don'ts

Use forceful, testable rules. Reference `tasks/goal.md` when a design choice protects user experience, revenue, retention, loyalty, conversion, activation, support load, or another project KPI.

### Do

- Do preserve the product's primary user job before adding decoration.
- Do use existing tokens and components before creating new visual values.
- Do verify responsive layout, text overflow, contrast, focus, loading, error, empty, and disabled states.

### Don't

- Don't add decorative UI that competes with the user's next action.
- Don't introduce raw colors, spacing, radius, fonts, or shadows when project tokens exist.
- Don't overwrite this file from a template update without explicit product-owner approval.
