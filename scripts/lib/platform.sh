#!/bin/bash
# platform.sh — Cross-platform helper functions
# Source this file: source "$(dirname "$0")/lib/platform.sh"

# Portable sed -i (macOS requires -i '', GNU requires -i)
_sed_i() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    # macOS/BSD sed
    sed -i '' "$@"
  fi
}

# Portable ISO date (macOS date lacks -I flag)
_date_iso() {
  date -u "+%Y-%m-%dT%H:%M:%S" 2>/dev/null || date "+%Y-%m-%dT%H:%M:%S"
}

# Portable file modification time in epoch seconds
_stat_mtime() {
  local file="$1"
  if stat --version 2>/dev/null | grep -q GNU; then
    stat -c %Y "$file" 2>/dev/null
  elif [ "$(uname)" = "Darwin" ]; then
    stat -f %m "$file" 2>/dev/null
  else
    # Windows Git Bash / fallback: use python
    python3 -c "import os; print(int(os.path.getmtime('$file')))" 2>/dev/null || echo 0
  fi
}

# Cross-platform SHA-256
_get_hash() {
  local file="$1"
  if command -v sha256sum &>/dev/null; then
    sha256sum "$file" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$file" | cut -d' ' -f1
  else
    certutil -hashfile "$file" SHA256 2>/dev/null | sed -n '2p' | tr -d ' ' | tr 'A-F' 'a-f'
  fi
}

# Check if a command exists
_require() {
  local cmd="$1"
  local msg="${2:-$cmd is required but not found}"
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $msg"
    return 1
  fi
}
