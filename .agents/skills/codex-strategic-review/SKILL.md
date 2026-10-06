---
name: codex-strategic-review
description: "Review plans, decisions, roadmaps, or execution against strategic thinking: user victory, constraints, reversibility, tradeoffs, sequencing, and local versus global optimization."
---

# Codex Strategic Review

Read `.claude/skills/strategic-review/SKILL.md` for the full checklist when needed.

## Process

1. Identify the decision or outcome under review and the scope the user accepted.
2. Identify relevant users, constraints, success evidence, and business/product
   measures when they apply. Do not invent a KPI or force a business lens onto
   work with no meaningful product/business dimension.
3. Check whether the proposed approach serves the requested outcome rather than
   optimizing only a local metric. Challenge it when evidence conflicts with
   safety, privacy, quality, or the user's intended result; do not agree by
   default.
4. Compare alternatives when the choice materially affects outcome, risk, or
   cost. Surface irreversible choices, unsupported assumptions, and evidence
   needed for any completion claim.
5. Use TRIZ when requirements genuinely conflict and the framework could
   expose a better separation or resource. Use terrain/competitor analysis for
   competitive strategy, not ordinary engineering. Use the marketing lens only
   for marketing/GTM decisions. Use plan-reality prompts for consequential or
   client-facing plans when they add clarity.
6. For staged product work, assess the claimed increment and evidence at its
   stated scope. Future contracts/stubs, readiness levels, project status
   headers, and end-to-end journey checks apply only when accepted architecture
   or the actual task requires them; do not prescribe an end-state skeleton or
   final-plan gate for every implementation.
   Preserve the production quality bar for production work and use the owning
   domain guide for its acceptance evidence.
7. Recommend the next smallest valuable move and name material uncertainty or
   a replan trigger when useful.
8. After repeated repair, compatibility-only scaffolding, architecture drift,
    or a proposed breaking rewrite, use `$codex-change-strategy`. Compare
    destination and transition alternatives against protected contracts, total cost,
    objective evidence, and the client approval boundary.

For client-facing plans, status, replans, and closeouts, follow
`.claude/library/process/client-executor-contract.md`.
