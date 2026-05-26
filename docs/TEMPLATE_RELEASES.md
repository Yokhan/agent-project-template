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
git tag v3.8.0
git push origin v3.8.0
```

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release-template.yml`. The workflow runs the release gate and publishes a GitHub release archive named `agent-project-template-<tag>.tar.gz`.

Patch releases are for compatible fixes to rules, skills, hooks, scripts, and docs. Minor releases can add new skills, agents, release flows, or routing behavior. Major releases can change sync contracts or project ownership boundaries.

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
```

Also run a generated-project smoke when the payload changes:

```bash
bash setup.sh template-release-smoke
cd template-release-smoke
bash scripts/test-template.sh
bash scripts/sync-template.sh /path/to/agent-project-template --dry-run
```

## Downstream Update From A Release

Inside a generated project:

```bash
git remote add template https://github.com/Yokhan/agent-project-template.git 2>/dev/null || true
bash scripts/sync-template.sh --from-git --ref v3.8.0 --dry-run
bash scripts/sync-template.sh --from-git --ref v3.8.0
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
