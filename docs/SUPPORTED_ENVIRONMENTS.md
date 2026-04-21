# Supported Environments

These are the environments the template is designed and tested to support.

## Required Tools

- `git`
- `node` 20+ for JSON parsing, MCP tooling, and metadata scripts
- `bash`

## Supported Bootstrap Paths

### Linux

- `bash setup.sh <project-name>`
- full validation and bootstrap smoke are supported

### macOS

- `bash setup.sh <project-name>`
- expected to work with the same shell and Node.js toolchain as Linux

### Windows

- `setup.bat` for project creation
- Git Bash or WSL for running shipped shell scripts such as `bootstrap-mcp.sh`, `check-drift.sh`, and `sync-template.sh`
- PowerShell-to-Git-Bash path normalization is supported for template-owned scripts

## Not A Supported Assumption

- plain `cmd.exe` without Git Bash or WSL for running the shipped shell tooling
- project-level Codex model or effort defaults
- copying untracked maintainer files as part of bootstrap

## Verification Surface

Current release validation covers:

- Linux and Windows bootstrap smoke in CI
- local validation scripts: `validate-template`, `check-drift`, `test-hooks`, `test-template`, `sync-agents`
- downstream migration dry-runs via `downstream-census.sh`
