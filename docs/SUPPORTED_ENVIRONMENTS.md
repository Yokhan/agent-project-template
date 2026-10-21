# Supported Environments

These are the environments the template is designed and tested to support.

## Required Tools

- `git`
- `node` 24+ with a working `node:sqlite` module for setup, native hooks,
  request recovery, and runtime evidence
- `bash` for shell-based setup and maintenance helpers; template sync itself is native Node.js

## Optional Tools

- Codex CLI 0.160.1 is the target version for GPT-6 configuration and
  `agents.max_concurrent_threads_per_session` (spawned children, excluding the
  parent). The legacy `max_threads` alias is accepted by the static validator,
  not proof that an old client supports the new profiles. Check the actual
  model catalog, config loading, and effective child metadata on each host.
  Config loading does not prove native custom-role dispatch. Host schemas and
  effective child model/effort metadata vary by host and version; verify the
  exposed dispatch capability and correlated runtime evidence on each host.
  A role label or supported schema field alone does not prove execution.
- `node:sqlite` is mandatory for native workflow evidence and recovery. Setup
  and the hook runner check both Node.js 24+ and an in-memory SQLite query;
  unsupported runtimes fail before project creation or hook processing.
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

## Managed Disposable Runs

`node scripts/managed-temp.js run -- <executable> <args>` owns scratch and
disposable caches. Windows uses a Job Object to stop the process family before
cleanup; the `vite`, `tsc`, `cargo` and `browser` profiles also assign supported
tool outputs to owned paths. Generic commands must consume the advertised
`AGENT_RUN_*` paths for their custom outputs.

On POSIX, strict process-family supervision is unavailable. Explicit
`--process-contract foreground` supports only test/command runs whose commands
keep descendants in the foreground. The aggregate selects this limited contract
for its nested tests. Interrupted foreground runs remain protected and require
manual recovery; hooks do not infer that an abandoned foreground marker is safe
to delete. Build/browser profiles require Windows supervision.

The optional shared cache has a per-project budget and idle expiry; active or
uncertain leases remain protected. Limits are sampled and do not enforce a
machine-wide hard quota. Existing browser installations, MCP databases, books,
history, sources and unknown directories are outside automatic cleanup.

## Unsupported Assumptions

- invoking shell-only maintenance tooling as though PowerShell or `cmd.exe` were a Linux shell; use the native Node updater for sync
- Linux filesystem, temp directory, shell, or command behavior on Windows unless explicitly detected first
- project-level Codex model or effort defaults
- copying untracked maintainer files as part of bootstrap

## Verification Surface

Current release validation covers:

- Linux bootstrap smoke and Windows fresh-project setup plus generated-project
  hook/runtime/MCP/sync-preview checks in CI
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
