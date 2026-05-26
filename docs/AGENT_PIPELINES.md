# Agent Pipelines

Shared, agent-neutral workflow definitions for Claude Code, Codex, and future agents.

Agent-specific wrappers may live under `.claude/pipelines/` or `.agents/skills/`, but these definitions are the contract.

## Gates

| Gate | Pass condition | On fail |
| --- | --- | --- |
| `research_done` | Affected files, history, lessons, registry, and risks are summarized | Continue research |
| `plan_approved` | User approval when risk or size requires it | Wait for user |
| `typecheck_pass` | Relevant typecheck or syntax check passes | Fix before next phase |
| `tests_pass` | Relevant tests pass | Fix or document blocker |
| `review_pass` | Review finds no blocking defects | Address findings |
| `security_pass` | Vulnerability is closed and no new obvious attack surface appears | Rework patch |
| `design_validated` | Screenshot/manual checks pass and design rules are met | Iterate |

## Artifact-Driven Work

When a project already has Spec Kit, litkit, Kiro, AgentOS, or another
artifact-driven flow, use those artifacts instead of inventing a parallel process.
Common artifact chain:

1. Spec: user-visible behavior and acceptance criteria.
2. Plan: architecture, constraints, risks, and verification.
3. Tasks: dependency order plus `[P]` markers for independent work.
4. Implement: parent-owned sequencing, with subagents only on safe splits.

Codex-specific routing and prompts live in `docs/CODEX_FANOUT_PATTERNS.md`.
Codex route selection is made explicit with `node scripts/codex-route-task.js "<task>" --summary --write-state`.

## Feature

Use for new capabilities, modules, screens, commands, or workflows.

1. Research
   - Read affected files and neighbors.
   - Check recent git history for those files.
   - Check `tasks/lessons.md`, `PROJECT_SPEC.md`, and `_reference/tool-registry.md`.
   - Classify risk.
   - Output: research summary and approach options.
2. Brainstorm
   - Required for HIGH/CRITICAL risk, optional for MEDIUM.
   - Compare at least 2 approaches with reversibility and test cost.
3. Plan
   - Save a concrete plan for M+ work.
   - Include file architecture, implementation order, risks, Plan B, and test scenarios.
4. Implement
   - Work in small batches.
   - Keep business logic in modules and entry points thin.
5. Test
   - Add or update focused tests.
   - Run relevant checks.
6. Review
   - Look for behavioral regressions, missing tests, and broken boundaries.
7. Closeout
   - Summarize outcome, verification, confidence, and remaining doubt.

## Bugfix

Use for incorrect behavior, failed tests, crashes, or regressions.

1. Research
   - Read the failing code path, callers, tests, recent history, and lessons.
2. Reproduce
   - Create or identify a minimal failing case.
   - Do not fix until the failure is observable.
3. Diagnose
   - Explain root cause and blast radius.
4. Fix
   - Make the smallest root-cause fix that preserves unrelated behavior.
5. Regression test
   - Add a test or smoke check that fails without the fix.
6. Verify and closeout
   - Run checks and record lesson if the bug pattern is reusable.

## Security Patch

Use for vulnerabilities, secrets, auth, injection, permissions, CVEs, or data exposure.

Risk is always HIGH or CRITICAL.

1. Research
   - Identify affected files, data, actors, trust boundaries, and logs.
2. Assess
   - Classify severity and exploitability.
   - State what would prove the patch works.
3. Plan
   - User checkpoint required for CRITICAL or broad changes.
4. Patch
   - Keep the fix narrow. Do not refactor unrelated code.
5. Security verification
   - Prove the exploit path is closed.
6. Regression tests
   - Cover vulnerable and allowed behavior.
7. Closeout
   - Note any rotation, disclosure, or deployment steps.

## Design

Use for Figma, UI, CSS, frontend screens, design systems, game UI, or visual polish.

1. Context
   - Identify user journey, viewport, design language, and constraints.
2. Analyze
   - Use the 5 lenses: art direction, UX, UI, flow, behavior.
3. Reference
   - Inspect comparable gold-standard products or existing system components.
4. Bill of materials
   - List required tokens, components, states, assets, and content.
5. Discover
   - Search design system before creating anything.
6. Compose
   - Build tokens -> components -> screens.
7. Validate
   - Screenshot, responsive checks, contrast, overflow, and state coverage.
8. Iterate
   - Fix deviations and re-validate.

## Template Maintenance

Use for `AGENTS.md`, `CLAUDE.md`, skills, subagents, hooks, MCP router, setup/sync payloads, and validation scripts.

1. Route
   - Run `node scripts/codex-route-task.js "<task>" --summary --write-state`.
   - Confirm whether AgentOS or project artifacts own the task graph.
2. Boundary check
   - Read `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md`.
   - Preserve `project-*` overlays and project-owned files.
3. Patch
   - Update Unix and Windows setup/sync paths together.
   - Keep model, effort, sandbox, and approval defaults out of project `.codex/config.toml`.
4. Smoke
   - Run skill, agent, route, hook, and template validation relevant to the change.
5. Sync proof
   - Prove new template-owned files are included in setup and sync allowlists.
6. Closeout
   - State compatibility impact for existing projects and AgentOS workspaces.

## Template Release

Use for release tags, release notes, downstream rollout, and AgentOS rollout coordination.

1. Freeze scope
   - Identify the version and whether the release is patch, minor, or major.
2. Validate
   - Run the release gate from `docs/TEMPLATE_RELEASES.md`.
3. Tag
   - Create a `vX.Y.Z` git tag only after validation is green.
4. Downstream instructions
   - Tell projects to use `scripts/sync-template.sh --from-git --ref <tag>`.
5. AgentOS note
   - If AgentOS is present, it chooses rollout order and records the template tag; it does not replace template sync.

## Closeout Format

For completed work, use:

1. What was incomplete or wrong before.
2. What is true now.
3. What this gives the project or user.
4. What to expect next.
