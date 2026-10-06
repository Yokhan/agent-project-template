#!/usr/bin/env bash
# Offline regression tests for the live Codex smoke launcher's selection rules.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/test-codex-subagents-live.sh"

fixture_root="$(_temp_dir codex-live-launcher-test)"
fixture_base="$(cd "$(dirname "$fixture_root")" && pwd)"
cleanup_fixture() {
  local resolved
  [ -d "$fixture_root" ] || return 0
  resolved="$(cd "$fixture_root" && pwd)" || return 1
  case "$resolved" in
    "$fixture_base"/codex-live-launcher-test.*) rm -rf -- "$resolved" ;;
    *) echo "Refusing cleanup outside validated launcher fixture" >&2; return 1 ;;
  esac
}
trap cleanup_fixture EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

make_codex_stub() {
  local file="$1" mode="$2" strict_config="$3"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'case "$1" in' \
    '  --version) [ "$2" = "" ] 2>/dev/null; exit "'"$mode"'" ;;' \
    '  --help) [ "'"$strict_config"'" = "1" ] && echo --strict-config; exit 0 ;;' \
    '  exec) [ "${2:-}" = "--help" ]; exit "'"$mode"'" ;;' \
    '  *) exit 1 ;;' \
    'esac' > "$file"
  chmod +x "$file"
}

# Simulate Windows discovery and keep path conversion deterministic.
_detect_os() { printf 'windows\n'; }
_to_shell_path() { printf '%s\n' "$1"; }
LOCALAPPDATA="$fixture_root/local-app-data"
newer="$LOCALAPPDATA/OpenAI/Codex/bin/99-no-strict-config/codex.exe"
older="$LOCALAPPDATA/OpenAI/Codex/bin/98-usable/codex.exe"
# Newer CLI launches and exposes exec, but lacks a global flag used by this
# smoke test; discovery must continue to the older capable candidate.
make_codex_stub "$older" 0 1
make_codex_stub "$newer" 0 0

selected="$(find_codex)" || fail "Windows discovery did not find a viable bundled CLI"
[ "$selected" = "$older" ] || fail "selected '$selected'; expected viable older bundle '$older'"

CODEX_LIVE_BIN="$newer"
export CODEX_LIVE_BIN
if find_codex >"$fixture_root/explicit.stdout" 2>"$fixture_root/explicit.stderr"; then
  fail "invalid explicit CODEX_LIVE_BIN unexpectedly succeeded"
fi
grep -q 'refusing to substitute another executable' "$fixture_root/explicit.stderr" || \
  fail "invalid explicit override did not explain that fallback was refused"
unset CODEX_LIVE_BIN

# Native-role mode must stop before resolving or launching any Codex binary.
if CODEX_LIVE_TEST=1 CODEX_LIVE_VALIDATION_MODE=native-role \
  bash "$ROOT_DIR/scripts/test-codex-subagents-live.sh" --yes \
  >"$fixture_root/native.stdout" 2>"$fixture_root/native.stderr"; then
  fail "native-role mode unexpectedly launched without an agent_type contract"
fi
grep -q 'custom-role-unsupported' "$fixture_root/native.stdout" || \
  fail "native-role mode did not report custom-role-unsupported"

echo "PASS: launcher selection rejects broken newest bundles, honors explicit overrides, and refuses unsupported native-role mode"
