#!/usr/bin/env bash
# codex-hook-adapter.sh — Translates Codex hook env vars to Claude hook format
# Usage: bash scripts/codex-hook-adapter.sh <event-type>
# Events: session-start, pre-tool-use, post-tool-use, session-stop
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_DIR/.claude/hooks"
EVENT="${1:-}"

if [[ -z "$EVENT" ]]; then
  echo "Usage: codex-hook-adapter.sh <event-type>" >&2
  exit 1
fi

# Translate Codex env vars to Claude-compatible format
# Codex uses: CODEX_TOOL_NAME, CODEX_TOOL_INPUT, CODEX_COMMAND
# Claude hooks expect: TOOL_NAME, TOOL_INPUT, FILE_PATH, COMMAND
export TOOL_NAME="${CODEX_TOOL_NAME:-${TOOL_NAME:-}}"
export TOOL_INPUT="${CODEX_TOOL_INPUT:-${TOOL_INPUT:-}}"
export FILE_PATH="${CODEX_FILE_PATH:-${FILE_PATH:-}}"
export COMMAND="${CODEX_COMMAND:-${COMMAND:-}}"

# Route to appropriate Claude hook scripts based on event type
case "$EVENT" in
  session-start)
    if [[ -x "$HOOKS_DIR/session-start.sh" ]]; then
      bash "$HOOKS_DIR/session-start.sh"
    fi
    ;;

  pre-tool-use)
    # Run security hooks: deny sensitive paths + bash safety
    if [[ -x "$HOOKS_DIR/deny-sensitive-paths.sh" ]]; then
      bash "$HOOKS_DIR/deny-sensitive-paths.sh" || exit $?
    fi
    # For shell/bash commands, run pre-bash-safety
    if [[ "$TOOL_NAME" == "shell" || "$TOOL_NAME" == "bash" || "$TOOL_NAME" == "Bash" ]]; then
      if [[ -x "$HOOKS_DIR/pre-bash-safety.sh" ]]; then
        bash "$HOOKS_DIR/pre-bash-safety.sh" || exit $?
      fi
    fi
    # For file edit/write, run pre-edit-safety (branch protection + secret scanning)
    if [[ "$TOOL_NAME" == "file_edit" || "$TOOL_NAME" == "file_write" || "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
      if [[ -x "$HOOKS_DIR/pre-edit-safety.sh" ]]; then
        bash "$HOOKS_DIR/pre-edit-safety.sh" || exit $?
      fi
    fi
    ;;

  post-tool-use)
    # Run prompt injection defender
    if [[ -x "$HOOKS_DIR/prompt-injection-defender.sh" ]]; then
      bash "$HOOKS_DIR/prompt-injection-defender.sh" || true
    fi
    # Run encoding check for file operations
    if [[ "$TOOL_NAME" == "file_write" || "$TOOL_NAME" == "file_edit" || "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
      if [[ -x "$HOOKS_DIR/check-encoding.sh" ]]; then
        bash "$HOOKS_DIR/check-encoding.sh" || true
      fi
    fi
    # Run session audit logger
    if [[ -x "$HOOKS_DIR/session-audit.sh" ]]; then
      bash "$HOOKS_DIR/session-audit.sh" || true
    fi
    ;;

  session-stop)
    if [[ -x "$HOOKS_DIR/session-stop.sh" ]]; then
      bash "$HOOKS_DIR/session-stop.sh"
    fi
    ;;

  *)
    echo "Unknown event: $EVENT" >&2
    echo "Valid events: session-start, pre-tool-use, post-tool-use, session-stop" >&2
    exit 1
    ;;
esac
