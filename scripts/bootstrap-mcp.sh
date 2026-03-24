#!/usr/bin/env bash
# bootstrap-mcp.sh — Auto-detect available MCP servers and MERGE into .mcp.json
# Usage: bash scripts/bootstrap-mcp.sh [--dry-run]
#
# Detects which MCP servers are installed on the system and merges them into
# the existing .mcp.json. Safe to run multiple times.
#
# Merge rules:
#   - If .mcp.json exists, existing servers are PRESERVED (never removed)
#   - Newly detected servers are ADDED if not already present
#   - Deprecated servers (memcp, claude-memory) get "disabled": true
#   - Existing server configs are never overwritten

set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run]"
      echo "Auto-detect MCP servers and merge into .mcp.json"
      exit 0
      ;;
  esac
done

# --- Check for python (needed for JSON merge) ---

PYTHON=""
if command -v python3 &>/dev/null; then
  PYTHON="python3"
elif command -v python &>/dev/null; then
  PYTHON="python"
else
  echo "ERROR: python3 or python required for JSON merge. Install Python first."
  exit 1
fi

# --- Detection helpers ---

detect_engram() {
  command -v engram.exe &>/dev/null || command -v engram &>/dev/null
}

detect_engram_path() {
  if command -v engram.exe &>/dev/null; then
    command -v engram.exe
  elif command -v engram &>/dev/null; then
    command -v engram
  else
    local win_path="$HOME/.local/bin/engram.exe"
    if [ -f "$win_path" ]; then
      echo "$win_path"
    else
      echo "engram"
    fi
  fi
}

detect_cgc() {
  python3 -m codegraphcontext --help &>/dev/null 2>&1 || \
  python -m codegraphcontext --help &>/dev/null 2>&1 || \
  command -v cgc.exe &>/dev/null || command -v cgc &>/dev/null
}

detect_cgc_path() {
  if command -v cgc.exe &>/dev/null; then
    command -v cgc.exe
  elif command -v cgc &>/dev/null; then
    command -v cgc
  else
    echo "cgc"
  fi
}

detect_obsidian() {
  [ -d "brain" ]
}

detect_godot() {
  [ -f "project.godot" ] || [ -f "godot-mcp/build/index.js" ]
}

detect_godot_mcp_path() {
  if [ -f "godot-mcp/build/index.js" ]; then
    echo "godot-mcp/build/index.js"
  else
    echo "godot-mcp/build/index.js"
  fi
}

detect_web_project() {
  if [ -f "package.json" ]; then
    grep -qE '"(react|next|@docusaurus|vue|angular|svelte)"' package.json 2>/dev/null
  else
    return 1
  fi
}

detect_chrome_devtools() {
  detect_web_project && command -v chrome-devtools-mcp &>/dev/null
}

detect_figma() {
  command -v figma-mcp &>/dev/null 2>&1
}

# --- Detection phase ---

echo "=== MCP Server Bootstrap (merge mode) ==="
echo "Detecting available MCP servers..."
echo ""

# Build detected servers as JSON snippets (one per line: key|json_value)
# These will be merged into existing .mcp.json
DETECTED_SERVERS=""
ENABLED=()
DISABLED=()

# 1. engram (REQUIRED — always enabled)
echo -n "  engram: "
if detect_engram; then
  ENGRAM_PATH=$(detect_engram_path)
  echo "ENABLED ($ENGRAM_PATH)"
  ENABLED+=("engram")
  DETECTED_SERVERS+="engram|{\"command\":\"$ENGRAM_PATH\",\"args\":[\"mcp\"]}
"
else
  echo "NOT FOUND (required! Install engram first)"
  ENABLED+=("engram (stub)")
  DETECTED_SERVERS+="engram|{\"command\":\"engram\",\"args\":[\"mcp\"]}
"
fi

# 2. codegraphcontext
echo -n "  codegraphcontext: "
if detect_cgc; then
  CGC_PATH=$(detect_cgc_path)
  echo "ENABLED ($CGC_PATH)"
  ENABLED+=("codegraphcontext")
  DETECTED_SERVERS+="codegraphcontext|{\"command\":\"$CGC_PATH\",\"args\":[\"mcp\",\"start\"]}
"
else
  echo "DISABLED (not installed)"
  DISABLED+=("codegraphcontext")
fi

# 3. obsidian-mcp (only if brain/ exists)
echo -n "  obsidian-mcp: "
if detect_obsidian; then
  echo "ENABLED (brain/ directory found)"
  ENABLED+=("obsidian-mcp")
  DETECTED_SERVERS+="obsidian|{\"command\":\"obsidian-mcp-server\",\"args\":[\"--vault\",\"./brain\"],\"env\":{\"OBSIDIAN_API_KEY\":\"placeholder\"}}
"
else
  echo "DISABLED (no brain/ directory)"
  DISABLED+=("obsidian-mcp")
fi

# 4. godot (only if project.godot exists or godot-mcp is installed)
echo -n "  godot: "
if detect_godot; then
  GODOT_PATH=$(detect_godot_mcp_path)
  echo "ENABLED ($GODOT_PATH)"
  ENABLED+=("godot")
  DETECTED_SERVERS+="godot|{\"command\":\"node\",\"args\":[\"$GODOT_PATH\"]}
"
else
  echo "DISABLED (no project.godot or godot-mcp)"
  DISABLED+=("godot")
fi

# 5. figma-desktop (optional)
echo -n "  figma-desktop: "
if detect_figma; then
  echo "ENABLED"
  ENABLED+=("figma-desktop")
  DETECTED_SERVERS+="figma-desktop|{\"url\":\"http://127.0.0.1:3845/mcp\"}
"
else
  echo "DISABLED (not installed)"
  DISABLED+=("figma-desktop")
fi

# 6. chrome-devtools (only for web projects)
echo -n "  chrome-devtools: "
if detect_chrome_devtools; then
  echo "ENABLED (web project detected)"
  ENABLED+=("chrome-devtools")
  DETECTED_SERVERS+="chrome-devtools|{\"command\":\"npx\",\"args\":[\"chrome-devtools-mcp@latest\"]}
"
else
  if detect_web_project; then
    echo "DISABLED (web project but chrome-devtools-mcp not installed)"
  else
    echo "DISABLED (not a web project)"
  fi
  DISABLED+=("chrome-devtools")
fi

# DEPRECATED servers — mark for disabling
echo -n "  memcp: "
echo "DEPRECATED (will be disabled if present)"
DISABLED+=("memcp")

echo -n "  claude-memory: "
echo "DEPRECATED (will be disabled if present)"
DISABLED+=("claude-memory")

# --- Merge phase (Python) ---

echo ""
echo "--- Merge ---"

# Read existing .mcp.json or start with empty
EXISTING_JSON="{}"
if [ -f ".mcp.json" ]; then
  EXISTING_JSON=$(cat .mcp.json)
  echo "Found existing .mcp.json — merging (existing servers preserved)"
else
  echo "No existing .mcp.json — creating new"
fi

# Use Python to merge: existing servers preserved, new ones added, deprecated disabled
MERGED_JSON=$($PYTHON -c "
import json, sys

existing = json.loads('''$EXISTING_JSON''')
servers = existing.get('mcpServers', {})

# Detected servers: add only if not already present
detected_lines = '''$DETECTED_SERVERS'''.strip().split('\n')
added = []
preserved = []
for line in detected_lines:
    if not line.strip():
        continue
    key, val_json = line.split('|', 1)
    if key in servers:
        preserved.append(key)
    else:
        servers[key] = json.loads(val_json)
        added.append(key)

# Deprecated servers: set disabled=true if present, never remove
deprecated = ['memcp', 'claude-memory']
disabled_list = []
for dep in deprecated:
    if dep in servers:
        servers[dep]['disabled'] = True
        disabled_list.append(dep)

# Report
if added:
    print(f'Added: {', '.join(added)}', file=sys.stderr)
if preserved:
    print(f'Preserved (untouched): {', '.join(preserved)}', file=sys.stderr)
if disabled_list:
    print(f'Disabled (deprecated): {', '.join(disabled_list)}', file=sys.stderr)

existing['mcpServers'] = servers
print(json.dumps(existing, indent=2))
" 2>&1 1>/tmp/mcp_merged.json)

# Print merge report (from stderr captured above)
if [ -n "$MERGED_JSON" ]; then
  echo "$MERGED_JSON"
fi

MCP_JSON=$(cat /tmp/mcp_merged.json)
rm -f /tmp/mcp_merged.json

echo ""
echo "--- Summary ---"
echo "Enabled:  ${ENABLED[*]}"
echo "Disabled: ${DISABLED[*]}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "Would write .mcp.json:"
  echo "$MCP_JSON"
  echo ""
  echo "(Dry run — no files modified)"
  exit 0
fi

# Backup existing .mcp.json if present
if [ -f ".mcp.json" ]; then
  cp ".mcp.json" ".mcp.json.bak"
  echo "Backed up existing .mcp.json to .mcp.json.bak"
fi

echo "$MCP_JSON" > .mcp.json
echo "Generated .mcp.json (merge mode)."

# --- Zed detection and config ---
if [ -n "${ZED_TERM:-}" ] || pgrep -x "zed" &>/dev/null 2>&1 || pgrep -x "Zed" &>/dev/null 2>&1; then
  echo ""
  echo "Zed detected. Note: Zed uses context_servers in settings.json."
  echo "Copy the server configs to your Zed settings manually if needed."
  echo "Path: ~/.config/zed/settings.json (Linux/Mac) or AppData/Roaming/Zed/settings.json (Windows)"
fi

echo ""
echo "Done. MCP servers configured for this project."
