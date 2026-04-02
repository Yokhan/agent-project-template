# Agent-Ready Project
<!-- Template Version: 3.0.0 -->

AI-agent optimized project with persistent memory, autonomous hooks, and self-improving context infrastructure.

## Status

**NEW_PROJECT** — Run `/setup-project` or say "настрой проект" to configure for your stack.

## Stack

<!-- Filled by /setup-project -->
Not configured yet.

## Map

- `src/` — source code (vertical slices, created by /setup-project)
- `docs/` — architecture, data design, API contracts, decisions
- `templates/` — scaffolding templates for new modules
- `_reference/` — canonical reference implementations + tool registry
- `brain/` — Obsidian vault, persistent memory across sessions
- `tasks/` — lessons learned, current task handoff, post-mortems, research cache
- `integrations/` — setup guides for memory MCP, Telegram, Beads, Obsidian MCP
- `scripts/` — drift detection, reuse audit, project scanning, automation

## Commands (16)

- `/setup-project` — configure project for your stack (run first!)
- `/implement` — Plan → Annotate → Implement (Boris Tane workflow)
- `/commit` — smart commit + optional PR
- `/review` — change review (intent + impact, not style)
- `/refactor` — safe refactoring via git worktree
- `/sprint` — autonomous work loop (Ralph Loop + circuit breaker)
- `/brain-sync` — sync knowledge to Obsidian vault
- `/weekly` — retrospective + self-improvement promotion
- `/status` — Project status dashboard
- `/rollback` — Safe git revert workflow
- `/onboard` — New developer onboarding
- `/update-template` — Sync project with newer template version
- `/hotfix` — Fast-track production fix (skip ceremony, require post-mortem)
- `/retrospective` — Deep weekly analysis (agent performance, rule effectiveness)
- `/sync-all` — Sync template to all projects with .template-manifest.json
- `/audit-tools` — Scan for duplicate code and update tool registry

## Build & Test

<!-- Filled by /setup-project -->
Not configured yet.

## Rules (25 files)

### Core Process
- **Context first**: read PROJECT_SPEC.md + lessons.md + current.md at session start. Handoff protocol at session end. (context-first.md)
- **Research before code**: read affected files, git log, lessons, tool-registry before ANY code change (research-first.md)
- **Plan before build**: file architecture + complexity estimate to tasks/current.md before coding S+ tasks (plan-first.md)
- **Self-verification**: graduated gates by task size, Doubt Protocol, Sunk Cost Test, error recovery protocol (self-verification.md)
- **Self-improvement**: lessons.md → promotion to rules, correction classifier, dual-write to Engram (self-improvement.md)
- **Conflict resolution**: merge conflicts, competing instructions, circuit breaker, confidence-based escalation (conflict-resolution.md)

### Technical
- **Architecture**: vertical slices, module boundaries, cross-cutting concerns, safe refactoring protocol (architecture.md)
- **Code style**: immutability, type safety, naming, guard clauses, dead code deletion (code-style.md)
- **Error handling**: typed errors, boundary pattern, circuit breaker, graceful degradation (error-handling.md)
- **Testing**: test pyramid, factory pattern, flaky test policy, contract testing (testing.md)
- **Git workflow**: conventional commits, trunk-based, feature flags, stacked PRs (git-workflow.md)
- **Writing guard**: anti-AI check, BAN-LIST, platform adaptation, human voice (writing.md)
- **Atomic reuse**: search before create, tool registry, 2+/3+ extraction rule (atomic-reuse.md)

### Meta
- **Analysis first**: extract principles, never copy surface structure (analysis-first.md)
- **Critical thinking**: evidence hierarchy A>B>C>D, 15 anti-patterns, red flags gate (critical-thinking.md)
- **Strategic thinking**: OODA loop, Commander's Intent, 63 principles from 12 sources (strategic-thinking.md)
- **Deep analysis**: full user journey, Three Whys, Level 1 minimum (deep-analysis.md)

### Domain (8 files)
- **domain-business.md** — startups, finance, unit economics
- **domain-design.md** — UX/UI/game design + 8-phase design pipeline (token-first, component-first)
- **domain-health.md** — fitness, nutrition, medicine (SAFETY-CRITICAL, evidence enforcement)
- **domain-marketing-sales.md** — growth, retention, pricing
- **domain-productivity.md** — AI use, deep work, RAG patterns
- **domain-psychology.md** — behavior, learning, motivation
- **domain-science.md** — methodology, reasoning, bias (evidence enforcement)
- **domain-software.md** — anti-patterns, YAGNI, testing, observability

## Hooks (7)

Hooks in `.claude/hooks/`, configured via `.claude/settings.json`.

| Hook | Trigger | What it does |
|------|---------|-------------|
| session-start.sh | Session begins | Session log, reminders, agent health check, registry check |
| session-stop.sh | Session ends | Logs end time, commit stats, session metrics |
| pre-compact.sh | Before compaction | Full snapshot + research cache state to tasks/.compaction-snapshot.md |
| format.sh | After Edit/Write | Runs appropriate formatter |
| post-edit.sh | After Edit/Write | Checks file size, validates syntax |
| pre-edit-safety.sh | Before Edit/Write | Blocks main branch, detects secrets |
| verify-gate.sh | After Bash (tests) | Reminds to run VERIFY phase |

## Scripts (13)

| Script | Purpose |
|--------|---------|
| check-drift.sh | Template health check (10 checks) |
| check-banlist.sh | AI-slop word scanner for content |
| audit-reuse.sh | Duplicate detector, extraction candidates (3 modes) |
| scan-project.sh | Initial project scan, tool-registry population |
| session-metrics.sh | Session stats collector (commits, lines, lessons) |
| sync-template.sh | Template sync with conflict detection + hash verification |
| sync-all.sh | Mass-sync template to all projects |
| bootstrap-mcp.sh | MCP server auto-setup (Engram) |
| brain-search.sh | Search brain/ knowledge base |
| test-hooks.sh | Hook syntax validation |
| test-template.sh | Full template validation |
| validate-template.sh | Pre-release template integrity check |
| lib/platform.sh | Cross-platform helpers (sed, date, hash) |

## Agents (10)

| Agent | Model | Role |
|-------|-------|------|
| implementer | sonnet | Build code (research → plan → implement → verify) |
| reviewer | sonnet | Review changes (intent + impact, blind review) |
| researcher | opus | Deep investigation, anti-hallucination protocol |
| test-engineer | sonnet | Test strategy, TDD, coverage |
| security-auditor | opus | Security audit, vulnerability detection |
| writer | opus | User-facing text (anti-AI, BAN-LIST, platform) |
| simplifier | sonnet | Reduce complexity, extract patterns |
| documenter | sonnet | API docs, README, CHANGELOG |
| devops | sonnet | CI/CD, deployment, infrastructure |
| profiler | sonnet | Performance analysis, optimization |

## Skills (29)

Core: agent-router, memory-router, decompose, task-queue, agent-metrics, pipeline.
Development: setup-project, add-feature, debug, sprint, implement.
Quality: test-rules, security-audit.
Domain review: domain-business-review, domain-design-review, domain-health-review, domain-communication-review, domain-science-review, domain-software-review, strategic-review.
Integrations: setup-integrations, setup-telegram.
Other: api-contract, brain-sync, refactor-module.

## Domain Knowledge Protection

Evidence-based guard rails in `.claude/rules/domain-*.md` (8 domains) + `.claude/rules/critical-thinking.md`.
Evidence hierarchy: A (meta-analysis) > B (RCT) > C (expert consensus) > D (blog). D-level = insufficient.

## Context on demand

- `PROJECT_SPEC.md` — auto-generated project overview
- `docs/ARCHITECTURE.md` — modules and dependencies
- `docs/DATA_DESIGN.md` — data schema
- `docs/API_CONTRACTS.md` — API contracts
- `docs/DECISIONS.md` — architectural decision records
- `brain/02-projects/` — project context and goals
- `brain/03-knowledge/` — patterns and lessons learned
- `tasks/lessons.md` — self-improvement log (read at session start!)
- `tasks/.research-cache.md` — incremental research findings (survives compaction)
- `tasks/post-mortems/` — post-mortem records (template: TEMPLATE.md)
- `ecosystem.md` — cross-project dependency map
- `_reference/README.md` — canonical implementations
- `_reference/tool-registry.md` — searchable index of reusable utilities

## Self-Improvement

After each mistake: classify (BUG/KNOWLEDGE_GAP/STYLE/DESIGN/MISUNDERSTANDING), log BUG and KNOWLEDGE_GAP to `tasks/lessons.md`. When >50 entries → promote via `/weekly`.

## Task Size Classification

XS (≤1 file, ≤5 lines) → no gates. S (≤2 files, ≤30 lines) → 1 gate. M (3-7 files) → 2 gates. L (8-15 files) → 4 gates. XL (>15 files) → decompose first.
Risk override: auth/security/health → always 4 gates.

## DON'T

- Code files > 375 lines — split them
- No `any` — use `unknown` + type guards
- No mutations — return new objects
- No editing main/master directly
- No skipping tests before commit
- No committing secrets (.env, API keys)
- No presenting solutions without self-verification
- No "you're right!" without logging WHY you didn't catch it
- No confidence claims without having rejected at least one alternative
- No writing new code without checking tool-registry first

## Template Version
3.0.0 — Run `bash scripts/check-drift.sh` to verify template health.

## Compaction

Preserve: current task, modified files, test results, discovered issues, lessons context.
After compaction: read `tasks/.compaction-snapshot.md` to restore full context.
