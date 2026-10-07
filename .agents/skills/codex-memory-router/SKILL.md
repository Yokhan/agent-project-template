---
name: codex-memory-router
description: "Route requested durable memory saves and scoped searches through tools available in the current session and relevant project artifacts."
---

# Codex Memory Router

Use only memory/search tools actually exposed in the current session; do not assume Engram or another backend is connected. Otherwise search relevant project artifacts with `rg`.
Search is read-only. Save only when requested or when an active authorized workflow requires a durable record; do not turn a lookup into a write.

## Search

Search only the context relevant to the question: `tasks/current.md` for active
handoff, `tasks/lessons.md` for recurring corrections, the maintained
`tasks/.research-cache.md` for reusable research (check freshness), and relevant
`brain/` decision or knowledge notes. Narrow `rg` queries to topic terms and
read matching entries; do not scan or load the whole memory tree by default.

## Save Routing

- Decisions and architecture: save to `brain/04-decisions/` when project-significant; use a connected persistent-memory tool only when available and appropriate.
- Research findings: `tasks/.research-cache.md`.
- Corrections and recurring mistakes: `tasks/lessons.md`.
- Active handoff: `tasks/current.md`.

Deduplicate before saving. Use stable topic keys for evolving architecture or process decisions.
