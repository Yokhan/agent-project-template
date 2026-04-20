#!/usr/bin/env bash
# PostToolUse — Encoding Guard
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
  echo "⚠️  [ENCODING] File has UTF-8 BOM: $FILE"
  echo "   Fix: Remove first 3 bytes (EF BB BF). Most tools don't need BOM."
fi

# Check 2: Valid UTF-8 (iconv test)
if command -v iconv >/dev/null 2>&1; then
  if ! iconv -f UTF-8 -t UTF-8 "$FILE" >/dev/null 2>&1; then
    echo "🚨 [ENCODING] File is NOT valid UTF-8: $FILE"
    echo "   This breaks Russian text (кириллица). Re-save as UTF-8."
    # Try to detect actual encoding
    DETECTED=$(file -bi "$FILE" 2>/dev/null | sed 's/.*charset=//')
    if [ -n "$DETECTED" ]; then
      echo "   Detected encoding: $DETECTED"
    fi
  fi
fi

# Check 3: Mixed line endings (CRLF + LF in same file)
if command -v xxd >/dev/null 2>&1; then
  HAS_CRLF=$(grep -cP '\r\n' "$FILE" 2>/dev/null || echo 0)
  HAS_LF=$(grep -cP '(?<!\r)\n' "$FILE" 2>/dev/null || echo 0)
  if [ "$HAS_CRLF" -gt 0 ] && [ "$HAS_LF" -gt 0 ]; then
    echo "⚠️  [ENCODING] Mixed line endings (CRLF + LF) in: $FILE"
    echo "   Pick one. Prefer LF."
  fi
fi

exit 0
