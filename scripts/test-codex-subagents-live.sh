#!/usr/bin/env bash
# Runs a live Codex subagent smoke test. This consumes Codex quota.
# Usage: CODEX_LIVE_TEST=1 bash scripts/test-codex-subagents-live.sh
#        bash scripts/test-codex-subagents-live.sh --yes

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${CODEX_LIVE_MODEL:-gpt-5.3-codex-spark}"
OUTPUT_FILE=""
ERROR_FILE=""

usage() {
  cat <<'EOF'
Usage: scripts/test-codex-subagents-live.sh --yes

Runs a live Codex CLI smoke test that spawns the repo-scoped pr_explorer agent.
This consumes Codex quota. Set CODEX_LIVE_TEST=1 instead of --yes if desired.

Optional:
  CODEX_LIVE_MODEL=model-name   Override model, default gpt-5.3-codex-spark
EOF
}

find_codex() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*)
      if command -v codex.cmd >/dev/null 2>&1; then
        command -v codex.cmd
        return 0
      fi
      ;;
  esac

  if command -v codex >/dev/null 2>&1; then
    command -v codex
    return 0
  fi

  if command -v codex.cmd >/dev/null 2>&1; then
    command -v codex.cmd
    return 0
  fi

  if [ -n "${APPDATA:-}" ]; then
    local candidate="$APPDATA/npm/codex.cmd"
    if [ -f "$candidate" ]; then
      if command -v cygpath >/dev/null 2>&1; then
        cygpath "$candidate"
      else
        printf '%s\n' "$candidate"
      fi
      return 0
    fi
  fi

  return 1
}

cleanup() {
  [ -n "$OUTPUT_FILE" ] && rm -f "$OUTPUT_FILE"
  [ -n "$ERROR_FILE" ] && rm -f "$ERROR_FILE"
}

main() {
  if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    usage
    exit 0
  fi

  if [ "${CODEX_LIVE_TEST:-}" != "1" ] && [ "${1:-}" != "--yes" ]; then
    echo "SKIP: live Codex subagent test consumes quota."
    echo "Run with --yes or CODEX_LIVE_TEST=1."
    exit 0
  fi

  cd "$ROOT_DIR"

  if [ ! -f ".codex/agents/pr-explorer.toml" ]; then
    echo "ERROR: .codex/agents/pr-explorer.toml not found"
    exit 1
  fi

  local codex_bin
  codex_bin="$(find_codex || true)"
  if [ -z "$codex_bin" ]; then
    echo "ERROR: codex CLI not found in PATH"
    exit 1
  fi

  OUTPUT_FILE="$(mktemp 2>/dev/null || mktemp -t codex-live-agent)"
  ERROR_FILE="$(mktemp 2>/dev/null || mktemp -t codex-live-agent-err)"
  trap cleanup EXIT

  local prompt
  prompt='Spawn the repo-scoped pr_explorer Codex subagent. Ask it only to read .codex/agents/pr-explorer.toml and return exactly PR_EXPLORER_READY plus the agent name. Wait for the child result. Do not edit files.'

  echo "Running live Codex subagent smoke with model: $MODEL"
  if ! "$codex_bin" exec --json --ephemeral -s read-only -m "$MODEL" "$prompt" >"$OUTPUT_FILE" 2>"$ERROR_FILE"; then
    echo "ERROR: codex exec failed"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    exit 1
  fi

  if ! grep -q "PR_EXPLORER_READY" "$OUTPUT_FILE"; then
    echo "ERROR: child agent marker not found"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    tail -40 "$OUTPUT_FILE" 2>/dev/null || true
    exit 1
  fi

  if ! grep -q '"tool":"spawn_agent"' "$OUTPUT_FILE"; then
    echo "ERROR: spawn_agent tool call not found in JSON output"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    tail -40 "$OUTPUT_FILE" 2>/dev/null || true
    exit 1
  fi

  if ! grep -q '"tool":"wait"' "$OUTPUT_FILE"; then
    echo "ERROR: wait tool call not found in JSON output"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    tail -40 "$OUTPUT_FILE" 2>/dev/null || true
    exit 1
  fi

  echo "PASS: Codex spawned pr_explorer and returned PR_EXPLORER_READY"
}

main "$@"
