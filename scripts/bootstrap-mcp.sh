#!/usr/bin/env bash
# bootstrap-mcp.sh — Auto-detect available MCP servers and generate .mcp.json
# Usage: bash scripts/bootstrap-mcp.sh [--dry-run]
#
# Detects which MCP servers are installed on the system and generates
# .mcp.json with only the available ones. Safe to run multiple times.

set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run]"
      echo "Auto-detect MCP servers and generate .mcp.json"
      exit 0
      ;;
  esac
done

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
    # Common install location on Windows
    local win_path="$HOME/.local/bin/engram.exe"
    if [ -f "$win_path" ]; then
      echo "$win_path"
    else
      echo "engram"
    fi
  fi
}

detect_cgc() {
  # Check if codegraphcontext is installed as a Python module
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
  # Check if brain/ directory exists in the project
  [ -d "brain" ]
}

detect_godot() {
  # Check if this is a Godot project or has godot-mcp installed
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
  # Check if this is a web project (React, Next.js, Docusaurus, etc.)
  if [ -f "package.json" ]; then
    grep -qE '"(react|next|@docusaurus|vue|angular|svelte)"' package.json 2>/dev/null
  else
    return 1
  fi
}

detect_chrome_devtools() {
  # Only enable for web projects
  detect_web_project && command -v chrome-devtools-mcp &>/dev/null
}

detect_figma() {
  # Check if figma-desktop MCP port is accessible (port 3845)
  # Skip if not available — this is optional
  command -v figma-mcp &>/dev/null 2>&1
}

# --- Detection phase ---

echo "=== MCP Server Bootstrap ==="
echo "Detecting available MCP servers..."
echo ""

ENABLED=()
DISABLED=()
SERVERS_JSON=""

# 1. engram (REQUIRED — always enabled)
echo -n "  engram: "
if detect_engram; then
  ENGRAM_PATH=$(detect_engram_path)
  echo "ENABLED ($ENGRAM_PATH)"
  ENABLED+=("engram")
  SERVERS_JSON+="    \"engram\": {
      \"command\": \"$ENGRAM_PATH\",
      \"args\": [\"mcp\"]
    }"
else
  echo "NOT FOUND (required! Install engram first)"
  ENABLED+=("engram (stub)")
  SERVERS_JSON+="    \"engram\": {
      \"command\": \"engram\",
      \"args\": [\"mcp\"]
    }"
fi

# 2. codegraphcontext
echo -n "  codegraphcontext: "
if detect_cgc; then
  CGC_PATH=$(detect_cgc_path)
  echo "ENABLED ($CGC_PATH)"
  ENABLED+=("codegraphcontext")
  SERVERS_JSON+=",
    \"codegraphcontext\": {
      \"command\": \"$CGC_PATH\",
      \"args\": [\"mcp\", \"start\"]
    }"
else
  echo "DISABLED (not installed)"
  DISABLED+=("codegraphcontext")
fi

# 3. obsidian-mcp (only if brain/ exists)
echo -n "  obsidian-mcp: "
if detect_obsidian; then
  echo "ENABLED (brain/ directory found)"
  ENABLED+=("obsidian-mcp")
  SERVERS_JSON+=",
    \"obsidian\": {
      \"command\": \"obsidian-mcp-server\",
      \"args\": [\"--vault\", \"./brain\"],
      \"env\": {
        \"OBSIDIAN_API_KEY\": \"placeholder\"
      }
    }"
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
  SERVERS_JSON+=",
    \"godot\": {
      \"command\": \"node\",
      \"args\": [\"$GODOT_PATH\"]
    }"
else
  echo "DISABLED (no project.godot or godot-mcp)"
  DISABLED+=("godot")
fi

# 5. figma-desktop (optional)
echo -n "  figma-desktop: "
if detect_figma; then
  echo "ENABLED"
  ENABLED+=("figma-desktop")
  SERVERS_JSON+=",
    \"figma-desktop\": {
      \"command\": \"figma-mcp\",
      \"args\": []
    }"
else
  echo "DISABLED (not installed or port 3845 not available)"
  DISABLED+=("figma-desktop")
fi

# 6. chrome-devtools (only for web projects)
echo -n "  chrome-devtools: "
if detect_chrome_devtools; then
  echo "ENABLED (web project detected)"
  ENABLED+=("chrome-devtools")
  SERVERS_JSON+=",
    \"chrome-devtools\": {
      \"command\": \"chrome-devtools-mcp\",
      \"args\": []
    }"
else
  if detect_web_project; then
    echo "DISABLED (web project but chrome-devtools-mcp not installed)"
  else
    echo "DISABLED (not a web project)"
  fi
  DISABLED+=("chrome-devtools")
fi

# DEPRECATED servers — always disabled
echo -n "  memcp: "
echo "DISABLED (deprecated)"
DISABLED+=("memcp")

echo -n "  claude-memory: "
echo "DISABLED (deprecated)"
DISABLED+=("claude-memory")

# --- Generate .mcp.json ---

MCP_JSON="{
  \"mcpServers\": {
$SERVERS_JSON
  }
}"

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
echo "Generated .mcp.json with ${#ENABLED[@]} server(s) enabled."

# --- Zed detection and config ---
# Check if running in Zed terminal or Zed is the active editor
if [ -n "${ZED_TERM:-}" ] || pgrep -x "zed" &>/dev/null 2>&1 || pgrep -x "Zed" &>/dev/null 2>&1; then
  echo ""
  echo "Zed detected. Note: Zed uses context_servers in settings.json."
  echo "Copy the server configs to your Zed settings manually if needed."
  echo "Path: ~/.config/zed/settings.json (Linux/Mac) or AppData/Roaming/Zed/settings.json (Windows)"
fi

echo ""
echo "Done. MCP servers configured for this project."
