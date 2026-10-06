# Supported Environments

These are the environments the template is designed and tested to support.

## Required Tools

- `git`
- `node` 20+ for JSON parsing, MCP tooling, and metadata scripts
- `bash` for shell-based setup and maintenance helpers; template sync itself is native Node.js

## Optional Tools

- Codex CLI 0.160.1 is the target version for GPT-6 configuration and
  `agents.max_concurrent_threads_per_session` (spawned children, excluding the
  parent). The legacy `max_threads` alias is accepted by the static validator,
  not proof that an old client supports the new profiles. Check the actual
  model catalog, config loading, and effective child metadata on each host.
  Config loading does not prove native custom-role dispatch. The current live
  collaboration schema lacks `agent_type`; use a verified explicit-model-contract
  capability instead, loading role instructions into the message. Native TOML
  role enforcement and sandbox isolation remain unavailable/unverified there.
- The optional read-only SQLite/rollout evidence collector requires Node 22.5+
  (`node:sqlite`), tested locally on Node 24.13.0. Node 20 remains supported for
  normal template/MCP tooling; missing collector capability is not runtime proof.
- AgentOS remains the task-graph owner. Its 2026-10-06 launcher accepts GPT-6
  low/medium/high but drops xhigh/max; those optional efforts are unavailable
  through that adapter until it is updated and tested. This migration does not
  change AgentOS or downstream projects.

- `uvx` or an installed `specify` CLI for `scripts/init-spec-kit.sh`
- network access for `scripts/sync-spec-kit.sh --check` and `--latest-tag`

## Supported Bootstrap Paths

### Linux

- `bash setup.sh <project-name>`
- full validation and bootstrap smoke are supported

### macOS

- `bash setup.sh <project-name>`
- expected to work with the same shell and Node.js toolchain as Linux

### Windows

- `setup.bat` for project creation and native context-router preparation through `npm.cmd`
- Node and PowerShell validation commands run natively
- template updates run natively through `node scripts/sync-template.js` or the thin `scripts/sync-template.cmd` adapter
- Template-owned shell scripts must route OS, architecture, and temp-path behavior through `scripts/lib/platform.sh`
- Raw `uname`, `/tmp`, and `mktemp` are not allowed outside the shared platform helper

## Not A Supported Assumption

- invoking shell-only maintenance tooling as though PowerShell or `cmd.exe` were a Linux shell; use the native Node updater for sync
- Linux filesystem, temp directory, shell, or command behavior on Windows unless explicitly detected first
- project-level Codex model or effort defaults
- copying untracked maintainer files as part of bootstrap

## Verification Surface

Current release validation covers:

- Linux and Windows bootstrap smoke in CI
- release-blocking native updater transactions and MCP initialize/tools-list/cwd boundary tests on Windows
- local validation scripts: `validate-template`, `check-drift`, `test-hooks`, `test-template`, `sync-agents`
- Codex skill validation: `node scripts/validate-codex-skills.js`
- Codex agent validation: `node scripts/validate-codex-agents.js`
- Codex route validation: `node scripts/test-codex-routing.js`
- Codex agent policy validation: `node scripts/test-codex-agent-policy.js`
- Production standard validation: `node scripts/validate-production-standard.js`
- Design context validation through the starter root `DESIGN.md` contract
- Design policy validation: `node scripts/validate-design-policy.js` and `node scripts/test-design-policy.js`
- Spec Kit snapshot validation: `node scripts/validate-spec-kit.js`
- Text/platform policy validation: `node scripts/validate-text-policy.js`
- optional quota-consuming Codex subagent runtime check: `scripts/test-codex-subagents-live.sh --yes`
- downstream migration dry-runs via `downstream-census.sh`
