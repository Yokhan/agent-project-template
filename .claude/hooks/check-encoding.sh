#!/usr/bin/env bash
# PostToolUse - Encoding Guard
# Checks that written/edited files are valid UTF-8 without BOM.
# Warns on encoding issues to catch Codex/GPT writing Windows-1251 or latin1.
# Exit 0 always (warn-only).

[ "${TEST_MODE:-}" = "1" ] && echo "check-encoding: OK (test mode)" && exit 0

# Only check after file write/edit operations
TOOL="${TOOL_NAME:-}"
case "$TOOL" in
  Write|Edit|file_write|file_edit) ;;
  *) exit 0 ;;
esac

FILE="${FILE_PATH:-}"
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# Check 1: UTF-8 BOM
if head -c 3 "$FILE" 2>/dev/null | xxd -p | grep -q "efbbbf"; then
  echo "WARNING [ENCODING] File has UTF-8 BOM: $FILE"
  echo "   Fix: Remove first 3 bytes (EF BB BF). Most tools don't need BOM."
fi

# Check 2: Valid UTF-8 (iconv test)
if command -v iconv >/dev/null 2>&1; then
  if ! iconv -f UTF-8 -t UTF-8 "$FILE" >/dev/null 2>&1; then
    echo "ERROR [ENCODING] File is NOT valid UTF-8: $FILE"
    echo "   This breaks Russian text. Re-save as UTF-8."
    DETECTED=$(file -bi "$FILE" 2>/dev/null | sed 's/.*charset=//')
    if [ -n "$DETECTED" ]; then
      echo "   Detected encoding: $DETECTED"
    fi
  fi
fi

# Check 3: Mixed line endings (CRLF + LF in same file)
if command -v awk >/dev/null 2>&1; then
  if awk 'BEGIN { has_crlf=0; has_lf=0 } /\r$/ { has_crlf=1; next } { has_lf=1 } END { exit !(has_crlf && has_lf) }' "$FILE" 2>/dev/null; then
    echo "WARNING [ENCODING] Mixed line endings (CRLF + LF) in: $FILE"
    echo "   Pick one. Prefer LF."
  fi
fi

exit 0
