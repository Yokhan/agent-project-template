# Agent Context Source Of Truth

This document is the template-level source of truth for agent instruction
architecture. Use it before changing `AGENTS.md`, `CLAUDE.md`, `.agents/skills`,
`.codex/agents`, `.claude/skills`, `.claude/agents`, hooks, routing scripts, or
template sync behavior.

## Rule

Do not redesign agent infrastructure from memory. Check:

1. `_reference/agent-sot/sources.json` for the source registry and freshness.
2. `_reference/agent-sot/README.md` for the local interpretation.
3. `_reference/agent-sot/top-works.md` for the priority reading set.
4. Official docs URLs from the registry when behavior may have changed.
5. `_reference/agent-sot/originals/ai-agent-spec-v3-final.md` for the imported
   project spec that motivated this template.

Do not paste full third-party documentation into the repo. Store URLs, dates,
small notes, and local conclusions. User-provided local specs may be stored as
originals when explicitly supplied.

## Architecture

### Hot Memory

Files loaded every session must stay short and directional:

- Codex: `AGENTS.md`.
- Claude Code: `CLAUDE.md`.
- Shared rules: `.claude/library/`.

Hot memory may contain durable invariants, routes to more context, and hard
guardrails. It must not contain full catalogs, long research notes, or copied
documentation.

### Specialist Memory

Reusable procedures and domain knowledge live in skills and agents:

- Codex skills: `.agents/skills/<name>/SKILL.md`.
- Codex subagents: `.codex/agents/*.toml`.
- Claude skills: `.claude/skills/<name>/SKILL.md`.
- Claude subagents: `.claude/agents/*.md`.

Use progressive disclosure: a `SKILL.md` should route to supporting references
instead of forcing all material into every turn.

### Cold Memory

Stable references, architecture records, source registries, and long-form
research live in `docs/`, `_reference/`, `brain/`, and `tasks/`.

Agent SOT material belongs under `_reference/agent-sot/`. Operational summaries
that agents must see during maintenance belong in this file.

The priority reading set is `_reference/agent-sot/top-works.md`. It must contain
at least 20 source cards and each card must reference an ID from
`_reference/agent-sot/sources.json`.

GitHub Spec Kit also has a managed local snapshot under `_reference/spec-kit/`.
Use it for offline reading and deploy it with `scripts/init-spec-kit.sh`.
Refresh it with `scripts/sync-spec-kit.sh --latest-tag` after checking upstream.

## Decision Matrix

Use hooks for deterministic checks that must run every time.
Use skills for reusable workflows, domain knowledge, and long references loaded
only when relevant.
Use subagents for parallel read-only exploration, review, security, docs
research, design review, and isolated implementation with explicit file scope.
Use `AGENTS.md` and `CLAUDE.md` for routing and high-leverage constraints only.
Use scripts for repeatable validation, scaffolding, release, and drift checks.
Use Spec Kit style artifacts (`spec.md`, `plan.md`, `tasks.md`) when task intent
and dependency order must survive multiple sessions or agents.

## Compatibility Rules

- Codex and Claude share `.claude/library/` and `docs/SHARED_CONVENTIONS.md`.
- Codex-specific files stay in `AGENTS.md`, `.codex/`, and `.agents/skills/`.
- Claude-specific files stay in `CLAUDE.md`, `.claude/settings.json`,
  `.claude/hooks/`, `.claude/agents/`, and `.claude/skills/`.
- AgentOS, when present, is the orchestrator. Codex/Claude routes become worker
  execution contracts, not a competing task graph.
- Project-specific extensions use `project-*` overlays and are preserved by sync.

## Freshness

Run `node scripts/validate-agent-sot.js` after any agent infrastructure change.
If a source in `_reference/agent-sot/sources.json` is stale or marked
`requires_fresh_check`, browse the canonical URL before editing behavior.

Current official-doc check: 2026-05-26.

## Minimum Closeout

For agent infrastructure changes, verify:

- `node scripts/validate-agent-sot.js`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-codex-skills.js`
- `node scripts/validate-codex-agents.js`
- `bash scripts/validate-template.sh`
- `bash scripts/test-template.sh`
