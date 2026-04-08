#!/bin/bash
# platform.sh — Cross-platform helper functions
# Source this file: source "$(dirname "$0")/lib/platform.sh"
# All scripts MUST use these helpers instead of calling node/sed -i/date -I directly.

# --- Node.js detection ---
# Required for JSON parsing. Python is NOT used.
if [ -z "${NODE:-}" ]; then
  if command -v node &>/dev/null; then
    NODE="node"
  else
    NODE=""
  fi
  export NODE
fi

# Run node with auto-detected binary. Usage: _node -e "console.log(1)"
_node() {
  if [ -z "$NODE" ]; then
    echo "ERROR: Node.js not found. Install Node.js: https://nodejs.org/" >&2
    return 1
  fi
  "$NODE" "$@"
}

# JSON helpers via node (replacing python json module)
# Usage: _json_get file.json "key" → prints value
_json_get() {
  local file="$1" key="$2"
  _node -e "const d=JSON.parse(require('fs').readFileSync('$file','utf8'));const v=$key;console.log(typeof v==='object'?JSON.stringify(v):v??'')" 2>/dev/null
}

# Usage: _json_set file.json '{"key":"value"}' → merges into file
_json_set() {
  local file="$1" patch="$2"
  _node -e "
const fs=require('fs');
let d={};try{d=JSON.parse(fs.readFileSync('$file','utf8'))}catch{}
Object.assign(d,JSON.parse('$patch'));
fs.writeFileSync('$file',JSON.stringify(d,null,2));
" 2>/dev/null
}

# Usage: _json_valid file.json → exit 0 if valid, 1 if not
_json_valid() {
  _node -e "JSON.parse(require('fs').readFileSync('$1','utf8'))" 2>/dev/null
}

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
    _node -e "console.log(Math.floor(require('fs').statSync('$file').mtimeMs/1000))" 2>/dev/null || echo 0
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

# Require node (with helpful error)
_require_node() {
  if [ -z "$NODE" ]; then
    echo "ERROR: Node.js is required but not found."
    echo "Install Node.js: https://nodejs.org/"
    return 1
  fi
}

# Legacy aliases (for backward compatibility during migration)
PYTHON="${NODE:-}"
_python() { _node "$@"; }
_require_python() { _require_node; }
