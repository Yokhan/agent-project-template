#!/usr/bin/env bash
# Runs a live Codex subagent smoke test. This consumes Codex quota.
# Usage: CODEX_LIVE_TEST=1 bash scripts/test-codex-subagents-live.sh
#        bash scripts/test-codex-subagents-live.sh --yes

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$ROOT_DIR/scripts"
[ -f "$SCRIPT_DIR/lib/platform.sh" ] && source "$SCRIPT_DIR/lib/platform.sh"
MODEL="${CODEX_LIVE_MODEL:-gpt-6.1-sol}"
ROLE="${CODEX_LIVE_ROLE:-pr_explorer}"
CHILD_MODEL="${CODEX_LIVE_CHILD_MODEL:-gpt-6-luna}"
CHILD_EFFORT="${CODEX_LIVE_CHILD_EFFORT:-high}"
PARENT_EFFORT="${CODEX_LIVE_EFFORT:-high}"
VALIDATION_MODE="${CODEX_LIVE_VALIDATION_MODE:-explicit-profile}"
APP_CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
APP_CODEX_STATE_DB="${CODEX_LIVE_STATE_DB:-$APP_CODEX_HOME/state_5.sqlite}"
APP_CODEX_SESSIONS_ROOT="${CODEX_LIVE_SESSIONS_ROOT:-$APP_CODEX_HOME/sessions}"
OUTPUT_FILE=""
ERROR_FILE=""

usage() {
  cat <<'EOF'
Usage: scripts/test-codex-subagents-live.sh --yes

Runs a live Codex CLI smoke test with an explicit child model/effort and the
selected repo role's developer instructions. This consumes Codex quota. The
current collaboration.spawn_agent contract has no agent_type, so native-role
mode is rejected instead of treating task_name as a configured role. Set
CODEX_LIVE_TEST=1.

Optional:
  CODEX_LIVE_BIN=path          Override Codex executable; must support --strict-config and exec
  CODEX_LIVE_MODEL=model-name  Override parent model, default gpt-6.1-sol
  CODEX_LIVE_ROLE=role-name     Override child role, default pr_explorer
  CODEX_LIVE_CHILD_MODEL=model  Required child model evidence, default gpt-6-luna
  CODEX_LIVE_CHILD_EFFORT=name  Required child effort evidence, default high
  CODEX_LIVE_EFFORT=name        Parent effort, default high
  CODEX_LIVE_VALIDATION_MODE=name explicit-profile (default); native-role is unsupported
  CODEX_LIVE_STATE_DB=path      Read-only Codex state database override
  CODEX_LIVE_SESSIONS_ROOT=path Read-only Codex rollout directory override
EOF
}

find_codex() {
  if [ -n "${CODEX_LIVE_BIN:-}" ]; then
    if codex_supports_live_smoke "$CODEX_LIVE_BIN"; then
      printf '%s\n' "$CODEX_LIVE_BIN"
      return 0
    fi
    echo "ERROR: CODEX_LIVE_BIN is not a usable Codex CLI (requires --version, --strict-config, and exec); refusing to substitute another executable" >&2
    return 1
  fi

  case "$(_detect_os)" in
    windows)
      if [ -n "${LOCALAPPDATA:-}" ]; then
        local bundled_root candidate
        bundled_root="$(_to_shell_path "$LOCALAPPDATA/OpenAI/Codex/bin")"
        # A newer install directory can be incomplete or contain a broken
        # launcher. Walk newest-first, but choose only a CLI that can actually
        # report its version and expose the subcommand used by this smoke test.
        while IFS= read -r candidate; do
          [ -n "$candidate" ] || continue
          candidate="$candidate/codex.exe"
          if codex_supports_live_smoke "$candidate"; then
            printf '%s\n' "$candidate"
            return 0
          fi
        done < <(ls -td "$bundled_root"/* 2>/dev/null || true)
      fi
      if command -v codex.cmd >/dev/null 2>&1; then
        local candidate
        candidate="$(command -v codex.cmd)"
        if codex_supports_live_smoke "$candidate"; then
          printf '%s\n' "$candidate"
          return 0
        fi
      fi
      ;;
  esac

  if command -v codex >/dev/null 2>&1; then
    local candidate
    candidate="$(command -v codex)"
    if codex_supports_live_smoke "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  if command -v codex.cmd >/dev/null 2>&1; then
    local candidate
    candidate="$(command -v codex.cmd)"
    if codex_supports_live_smoke "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  if [ -n "${APPDATA:-}" ]; then
    local candidate="$APPDATA/npm/codex.cmd"
    if [ -f "$candidate" ]; then
      local shell_candidate
      if command -v cygpath >/dev/null 2>&1; then
        shell_candidate="$(cygpath "$candidate")"
      else
        shell_candidate="$candidate"
      fi
      if codex_supports_live_smoke "$shell_candidate"; then
        printf '%s\n' "$shell_candidate"
        return 0
      fi
    fi
  fi

  return 1
}

codex_supports_live_smoke() {
  local candidate="$1" global_help
  [ -n "$candidate" ] && [ -f "$candidate" ] && [ -x "$candidate" ] || return 1
  "$candidate" --version >/dev/null 2>&1 || return 1
  global_help="$("$candidate" --help 2>/dev/null)" || return 1
  case "$global_help" in
    *--strict-config*) ;;
    *) return 1 ;;
  esac
  "$candidate" exec --help >/dev/null 2>&1
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

  case "$VALIDATION_MODE" in
    explicit-profile) ;;
    native-role)
      echo "ERROR: custom-role-unsupported: this launcher uses collaboration.spawn_agent, whose supported contract has no agent_type; native-role validation cannot be requested through task_name"
      exit 2
      ;;
    *)
      echo "ERROR: unsupported validation mode: $VALIDATION_MODE"
      exit 2
      ;;
  esac

  local role_file role_instructions
  role_file="$(node -e 'const {getAgentProfile}=require("./scripts/codex-agent-policy.js"); const p=getAgentProfile(process.argv[1]); if(!p?.file) process.exit(2); process.stdout.write(p.file)' "$ROLE")" || {
    echo "ERROR: role profile not found in agent policy: $ROLE"
    exit 1
  }
  if [ ! -f ".codex/agents/$role_file" ]; then
    echo "ERROR: role instruction source .codex/agents/$role_file not found"
    exit 1
  fi
  role_instructions="$(node -e 'const fs=require("fs"); const text=fs.readFileSync(process.argv[1],"utf8"); const match=text.match(/(?:^|\n)developer_instructions\s*=\s*"""([\s\S]*?)"""/); if(!match) process.exit(3); process.stdout.write(match[1].trim())' ".codex/agents/$role_file")" || {
    echo "ERROR: developer_instructions missing from .codex/agents/$role_file"
    exit 1
  }

  local codex_bin
  if ! codex_bin="$(find_codex)"; then
    if [ -z "${CODEX_LIVE_BIN:-}" ]; then
      echo "ERROR: no Codex CLI found that supports the required smoke-test flags"
    fi
    exit 1
  fi

  OUTPUT_FILE="$(_temp_file codex-live-agent)"
  ERROR_FILE="$(_temp_file codex-live-agent-err)"
  trap cleanup EXIT

  local prompt
  prompt="Before any other tool, call collaboration.spawn_agent exactly once with task_name=$ROLE, model=$CHILD_MODEL, reasoning_effort=$CHILD_EFFORT, fork_turns=none. Include the following developer_instructions verbatim in the child message and ask the child to follow them within this bounded acceptance: inspect the exact source file .codex/agents/$role_file, then map the actual subagent trace validation path and relevant tests; report concise findings and risks; make no edits. developer_instructions: $role_instructions. The task_name is only a runtime task label, not proof that a native configured role was loaded. The child must return its result as its final response only; it must not call collaboration.send_message or send commentary, because a message wakeup is not task completion. After collaboration.wait_agent returns, check collaboration.list_agents for this child ID. If the child is still running or wait returned only a generic wakeup, wait again; continue until the child status is completed or the child has a successful final response. Do not stop just because wait_agent returned. Parent embeds the trusted role instructions source; no parent-authored result is substituted. Child self-report is task output, never proof of effective profile or completion."

  echo "Running live Codex subagent smoke with model: $MODEL"
  "$codex_bin" --version
  # Collab spawn resolves the persisted parent thread; --ephemeral makes that
  # parent unavailable and produces a false runtime failure.
  if ! "$codex_bin" --strict-config -c "model_reasoning_effort=\"$PARENT_EFFORT\"" exec --json -s read-only -m "$MODEL" "$prompt" >"$OUTPUT_FILE" 2>"$ERROR_FILE"; then
    echo "ERROR: codex exec failed"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    exit 1
  fi

  if ! node scripts/validate-subagent-trace.js \
    --file "$OUTPUT_FILE" \
    --mode "$VALIDATION_MODE" \
    --expected-role "$ROLE" \
    --expected-model "$CHILD_MODEL" \
    --expected-effort "$CHILD_EFFORT" \
    --state-db "$APP_CODEX_STATE_DB" \
    --sessions-root "$APP_CODEX_SESSIONS_ROOT"; then
    echo "UNVERIFIED: requested validation mode did not pass linked runtime evidence"
    tail -40 "$ERROR_FILE" 2>/dev/null || true
    exit 1
  fi

  echo "PASS: $VALIDATION_MODE evidence for $CHILD_MODEL ($CHILD_EFFORT); native role and instruction delivery are separate proof requirements"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
