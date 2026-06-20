# Template Releases

Use this document when publishing or consuming `agent-project-template` releases.

## Ownership Model

There are three separate surfaces:

| Surface | Owner | Update mechanism |
| --- | --- | --- |
| Template repository | Template maintainers | Git commits, release tags, release notes |
| Generated projects | Project teams | `scripts/sync-template.sh` from local path or git ref |
| AgentOS workspace | AgentOS | AgentOS orchestrates work, then consumes a template release like any other downstream project |

AgentOS is an orchestrator, not the template source of truth. If AgentOS metadata is present, Codex follows AgentOS Strategy/Tactic/Plan/Todo/Gate artifacts as the task graph. Template files still come from this repository and are updated through template sync.

## Version Rule

The template version is declared in:

- `AGENTS.md`
- `CLAUDE.md`
- README badge and release notes

Use semantic version tags:

```bash
git tag v4.3.3
git push origin v4.3.3
```

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release-template.yml`. The workflow runs the release gate and publishes a GitHub release archive named `agent-project-template-<tag>.tar.gz`.

Patch releases are for compatible fixes to rules, skills, hooks, scripts, and docs. Minor releases can add new skills, agents, release flows, or routing behavior. Major releases can change sync contracts, project ownership boundaries, or the default agent operating contract.

## v4 Production Standard Notes

Version `4.0.0` changes the agent operating contract:

- Real product work is not treated as MVP/prototype work unless explicitly requested.
- `tasks/goal.md` carries the persistent final outcome, quality bar, current step, dependencies, and risks.
- Plans, audits, status updates, and final reports must use the language of the user's request.
- Codex routing now exposes `planContract`, `productionBar`, `languagePolicy`, and `qualityGates`.
- Design-system and product-UX work have dedicated skills and rendered verification gates.
- Cross-project lessons can be promoted into rules, skills, validators, or router behavior.

Version `4.0.1` is a compatible patch release that keeps `.github/workflows/release-template.yml` source-only, ships only `.github/workflows/validate-template.yml` to downstream projects, and validates this in setup/sync smoke tests.

Version `4.0.2` is a compatible patch release that keeps source-only starter and bootstrap files out of generated-project sync, specifically `templates/project-starter/*`, `setup.sh`, and `setup.bat`.

Version `4.0.3` is a compatible patch release that adds fail-hard text/platform policy enforcement, blocks mojibake and unsafe shell OS assumptions, generalizes the UI Subtraction Gate for all UI work, and optimizes sync regression smoke coverage.

Version `4.1.0` is a compatible minor release that makes product-user experience and app-specific business outcomes the first priority for plans and improvements. Agents must name the user/business outcome before technical work and treat refactors, tooling, and architecture cleanup as second-order unless they directly unlock or protect revenue, loyalty, retention, conversion, activation, support load, or another application KPI.

Version `4.1.1` is a compatible patch release that updates GitHub workflows and CI templates to Node 24-compatible actions before the GitHub Actions Node 20 runner migration.

Version `4.2.0` is a compatible minor release that adds production design QA infrastructure: root `DESIGN.md` starter context, project-owned `design-policy.ignore`, design workflow command modes, a hard design-policy validator with fixtures, default Codex design-policy hook notifications, and browser/visual hardening gates. Existing downstream `DESIGN.md` and `design-policy.ignore` files are project-owned and must not be overwritten by template sync.

Version `4.3.0` is a compatible minor release that upgrades the production design pipeline and Codex design skills. It adds a detailed design command-mode reference, product/brand/mixed register gates, critique ordering that treats deterministic validators as evidence rather than judgment, design-system register review, and routing regression coverage so conversion/KPI design work is not misrouted as a release task.

Version `4.3.1` is a compatible patch release that fixes release-facing README/CLAUDE documentation drift and adds a regression gate so shipped counts and command lists match the real template filesystem.

Version `4.3.2` is a compatible patch release that promotes the concrete screen anatomy/root-frame contract into the shared design pipeline and Codex design skills, adds regression coverage so future releases cannot drop it, and fixes `sync-template.sh --from-git --dry-run` so it shows the real sync preview from a git ref before modifying downstream projects.

Version `4.3.3` is a compatible patch release that includes design-policy test fixtures in template sync delivery so downstream `test-design-policy` works after normal sync without manual fixture copying.

Downstream projects should sync `v4.3.3` with a dry run first and review local `project-*` skills, auth flows, design systems, task files, CI workflows, design context files, design policy ignores, and business/product planning conventions before applying.

## Release Gate

Before tagging, run:

```bash
bash scripts/validate-template.sh
bash scripts/check-drift.sh
bash scripts/test-hooks.sh
bash scripts/test-template.sh
bash scripts/sync-agents.sh
node scripts/test-codex-routing.js
node scripts/validate-codex-skills.js
node scripts/validate-codex-agents.js
node scripts/validate-production-standard.js
node scripts/validate-design-policy.js
node scripts/test-design-policy.js
```

Also run a generated-project smoke when the payload changes:

```bash
bash setup.sh template-release-smoke
cd template-release-smoke
bash scripts/test-hooks.sh
bash scripts/bootstrap-mcp.sh --dry-run
bash scripts/sync-template.sh /path/to/agent-project-template --dry-run
```

## Downstream Update From A Release

Inside a generated project:

```bash
git remote add template https://github.com/Yokhan/agent-project-template.git 2>/dev/null || true
bash scripts/sync-template.sh --from-git --ref v4.3.3 --dry-run
bash scripts/sync-template.sh --from-git --ref v4.3.3
```

Use `--dry-run` first when a project has local changes. If both the project and template changed the same template-owned file, sync writes `*.template-new` instead of overwriting silently.

## Downstream Update From Main

Use the branch path only for early rollout or canary projects:

```bash
bash scripts/sync-template.sh --from-git --dry-run
bash scripts/sync-template.sh --from-git
```

Release tags are preferred for normal projects because they make rollbacks and AgentOS rollout plans explicit.

## AgentOS Consumption

AgentOS should not copy template internals manually. Recommended flow:

1. AgentOS decides which project should update and which template tag is allowed.
2. The project runs `scripts/sync-template.sh --from-git --ref <tag> --dry-run`.
3. AgentOS reviews conflicts and project-owned overlays.
4. The project applies sync and runs the release gate subset relevant to that project.
5. AgentOS records the template tag in its own orchestration state.

If AgentOS is absent, the parent Codex thread is the orchestrator for the update and must record the chosen route from `scripts/codex-route-task.js`.

## Rollback

Rollback is a normal git operation in the downstream project:

```bash
git tag backup/pre-template-sync-$(date +%Y%m%d-%H%M%S)
git revert <sync-commit>
```

For uncommitted sync attempts, use the backup stash/tag created by `sync-template.sh` or discard only the files changed by the sync after reviewing `git diff`.
