#!/usr/bin/env bash
# bootstrap-mcp.sh — Auto-detect, install, and configure MCP servers
# Usage: bash scripts/bootstrap-mcp.sh [--dry-run] [--install] [--check] [--zed]
#
# Modes:
#   (default)    Detect installed servers, merge into .mcp.json
#   --install    Also install missing REQUIRED servers (Engram)
#   --check      Health check: verify configured servers actually respond
#   --zed        Also generate Zed context_servers config
#   --dry-run    Show what would be done without writing files
#
# Environment detection:
#   - Claude Code CLI (terminal): writes .mcp.json (mcpServers format)
#   - Zed AI Chat panel: writes to Zed settings.json (context_servers format)
#   - Both can coexist — script handles both when --zed is passed
#
# Merge rules:
#   - Existing servers are PRESERVED (never removed)
#   - Newly detected servers are ADDED if not already present
#   - Deprecated servers (memcp, claude-memory) get "disabled": true

set -euo pipefail

DRY_RUN=false
DO_INSTALL=false
DO_CHECK=false
DO_ZED=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --install) DO_INSTALL=true ;;
    --check) DO_CHECK=true ;;
    --zed) DO_ZED=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--install] [--check] [--zed]"
      echo ""
      echo "  --install   Install missing required servers (Engram)"
      echo "  --check     Verify configured servers respond"
      echo "  --zed       Also configure Zed AI chat panel"
      echo "  --dry-run   Show what would change without writing"
      exit 0
      ;;
  esac
done

# --- OS and environment detection ---

detect_os() {
  case "$(uname -s 2>/dev/null || echo Windows)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*|Windows*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

detect_arch() {
  local arch
  arch=$(uname -m 2>/dev/null || echo "x86_64")
  case "$arch" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "$arch" ;;
  esac
}

detect_zed_settings_path() {
  local os
  os=$(detect_os)
  case "$os" in
    macos)   echo "$HOME/Library/Application Support/Zed/settings.json" ;;
    linux)   echo "$HOME/.config/zed/settings.json" ;;
    windows) echo "$APPDATA/Zed/settings.json" ;;
  esac
}

is_zed_environment() {
  [ -n "${ZED_TERM:-}" ] || pgrep -x "zed" &>/dev/null 2>&1 || pgrep -x "Zed" &>/dev/null 2>&1
}

OS=$(detect_os)
ARCH=$(detect_arch)

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

# --- Check for node/npm (needed for context-router MCP) ---
HAS_NODE=false
if command -v node &>/dev/null && command -v npm &>/dev/null; then
  HAS_NODE=true
  echo "Node.js: $(node --version), npm: $(npm --version)"
else
  echo "WARNING: Node.js/npm not found. Context-router MCP will not work."
  echo "  Install: https://nodejs.org/ or: winget install OpenJS.NodeJS.LTS"
fi

# --- Check for docker (needed for n8n) ---
HAS_DOCKER=false
if command -v docker &>/dev/null; then
  HAS_DOCKER=true
  echo "Docker: $(docker --version 2>/dev/null | head -c 40)"
else
  echo "INFO: Docker not found. n8n auto-install unavailable (optional)."
fi

# --- Install helpers ---

install_engram() {
  echo ""
  echo "--- Installing Engram ---"

  # Method 1: Go install (if Go available)
  if command -v go &>/dev/null; then
    echo "Go found. Installing via: go install github.com/Gentleman-Programming/engram@latest"
    if go install github.com/Gentleman-Programming/engram@latest 2>/dev/null; then
      echo "Engram installed via Go."
      return 0
    fi
    echo "go install failed, trying binary download..."
  fi

  # Method 2: Download binary from GitHub releases
  local bin_dir="$HOME/.local/bin"
  mkdir -p "$bin_dir"

  local bin_name="engram"
  [ "$OS" = "windows" ] && bin_name="engram.exe"

  local download_os="$OS"
  [ "$download_os" = "macos" ] && download_os="darwin"

  local release_url="https://github.com/Gentleman-Programming/engram/releases/latest/download/engram-${download_os}-${ARCH}"
  [ "$OS" = "windows" ] && release_url="${release_url}.exe"

  echo "Downloading from: $release_url"
  if command -v curl &>/dev/null; then
    if curl -fsSL "$release_url" -o "$bin_dir/$bin_name"; then
      chmod +x "$bin_dir/$bin_name" 2>/dev/null || true
      echo "Engram installed to $bin_dir/$bin_name"
      echo ""
      echo "NOTE: Make sure $bin_dir is in your PATH."
      echo "  Add to ~/.bashrc or ~/.zshrc:  export PATH=\"\$HOME/.local/bin:\$PATH\""
      return 0
    fi
  elif command -v wget &>/dev/null; then
    if wget -q "$release_url" -O "$bin_dir/$bin_name"; then
      chmod +x "$bin_dir/$bin_name" 2>/dev/null || true
      echo "Engram installed to $bin_dir/$bin_name"
      return 0
    fi
  fi

  echo "ERROR: Could not download Engram. Install manually:"
  echo "  https://github.com/Gentleman-Programming/engram/releases"
  return 1
}

# --- Detection helpers ---

detect_engram() {
  command -v engram.exe &>/dev/null || command -v engram &>/dev/null || {
    local win_path="$HOME/.local/bin/engram.exe"
    local unix_path="$HOME/.local/bin/engram"
    [ -f "$win_path" ] || [ -f "$unix_path" ]
  }
}

detect_engram_path() {
  if command -v engram.exe &>/dev/null; then
    command -v engram.exe
  elif command -v engram &>/dev/null; then
    command -v engram
  else
    local win_path="$HOME/.local/bin/engram.exe"
    local unix_path="$HOME/.local/bin/engram"
    if [ -f "$win_path" ]; then
      echo "$win_path"
    elif [ -f "$unix_path" ]; then
      echo "$unix_path"
    else
      echo "engram"
    fi
  fi
}

detect_cgc() {
  $PYTHON -m codegraphcontext --help &>/dev/null 2>&1 || \
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

# --- Health check ---

check_engram_health() {
  local engram_path
  engram_path=$(detect_engram_path)
  if "$engram_path" mcp --help &>/dev/null 2>&1 || "$engram_path" --version &>/dev/null 2>&1; then
    return 0
  fi
  return 1
}

run_health_check() {
  echo ""
  echo "=== MCP Health Check ==="

  local all_ok=true

  echo -n "  engram: "
  if detect_engram; then
    if check_engram_health; then
      echo "OK (responds)"
    else
      echo "INSTALLED but NOT RESPONDING"
      all_ok=false
    fi
  else
    echo "NOT INSTALLED (required!)"
    all_ok=false
  fi

  echo -n "  .mcp.json: "
  if [ -f ".mcp.json" ]; then
    if $PYTHON -c "import json; json.load(open('.mcp.json'))" &>/dev/null; then
      echo "OK (valid JSON)"
    else
      echo "CORRUPT (invalid JSON!)"
      all_ok=false
    fi
  else
    echo "MISSING (run bootstrap-mcp.sh first)"
    all_ok=false
  fi

  # Check Zed config if in Zed environment
  if is_zed_environment; then
    local zed_path
    zed_path=$(detect_zed_settings_path)
    echo -n "  zed settings: "
    if [ -f "$zed_path" ]; then
      if $PYTHON -c "import json; d=json.load(open('$zed_path')); assert 'context_servers' in d" &>/dev/null 2>&1; then
        echo "OK (context_servers found)"
      else
        echo "NO context_servers (run with --zed to configure)"
      fi
    else
      echo "NOT FOUND at $zed_path"
    fi
  fi

  echo ""
  if $all_ok; then
    echo "All checks passed."
  else
    echo "Some checks FAILED. Fix issues above, then re-run with --check."
  fi
}

if [ "$DO_CHECK" = true ]; then
  run_health_check
  exit 0
fi

# --- Main: Detection phase ---

echo "=== MCP Server Bootstrap ==="
echo "OS: $OS | Arch: $ARCH"
echo "Detecting available MCP servers..."
echo ""

DETECTED_SERVERS=""
ENABLED=()
DISABLED=()
ENGRAM_INSTALLED=false

# 1. engram (REQUIRED)
echo -n "  engram: "
if detect_engram; then
  ENGRAM_PATH=$(detect_engram_path)
  echo "ENABLED ($ENGRAM_PATH)"
  ENABLED+=("engram")
  ENGRAM_INSTALLED=true
  DETECTED_SERVERS+="engram|{\"command\":\"$ENGRAM_PATH\",\"args\":[\"mcp\"]}
"
else
  if [ "$DO_INSTALL" = true ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "NOT FOUND — would install (--dry-run)"
    else
      install_engram
      # Re-detect after install
      if detect_engram; then
        ENGRAM_PATH=$(detect_engram_path)
        echo "  engram: ENABLED after install ($ENGRAM_PATH)"
        ENABLED+=("engram")
        ENGRAM_INSTALLED=true
        DETECTED_SERVERS+="engram|{\"command\":\"$ENGRAM_PATH\",\"args\":[\"mcp\"]}
"
      else
        echo "  engram: INSTALL FAILED — creating stub (will error at runtime!)"
        ENABLED+=("engram (stub)")
        DETECTED_SERVERS+="engram|{\"command\":\"engram\",\"args\":[\"mcp\"]}
"
      fi
    fi
  else
    echo "NOT FOUND (required!)"
    echo ""
    echo "  To auto-install:  bash scripts/bootstrap-mcp.sh --install"
    echo "  Manual install:   https://github.com/Gentleman-Programming/engram/releases"
    echo ""
    ENABLED+=("engram (stub)")
    DETECTED_SERVERS+="engram|{\"command\":\"engram\",\"args\":[\"mcp\"]}
"
  fi
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
  echo "DISABLED (not installed — optional)"
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

# 4. godot (only if project.godot exists)
echo -n "  godot: "
if detect_godot; then
  GODOT_PATH=$(detect_godot_mcp_path)
  echo "ENABLED ($GODOT_PATH)"
  ENABLED+=("godot")
  DETECTED_SERVERS+="godot|{\"command\":\"node\",\"args\":[\"$GODOT_PATH\"]}
"
else
  echo "DISABLED (no project.godot — optional)"
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
  echo "DISABLED (not installed — optional)"
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

# 7. context-router (template MCP — dynamic rule loading)
echo -n "  context-router: "
if [ -f "mcp-servers/context-router/package.json" ]; then
  # Install deps if needed
  if [ ! -d "mcp-servers/context-router/node_modules" ]; then
    echo -n "installing deps... "
    (cd mcp-servers/context-router && npm install --silent 2>/dev/null) || true
  fi
  if [ -d "mcp-servers/context-router/node_modules" ]; then
    echo "ENABLED (dynamic rule routing)"
    ENABLED+=("context-router")
    DETECTED_SERVERS+="context-router|{\"command\":\"npx\",\"args\":[\"tsx\",\"mcp-servers/context-router/src/index.ts\"]}
"
  else
    echo "FAILED (npm install failed)"
    DISABLED+=("context-router")
  fi
else
  echo "DISABLED (mcp-servers/context-router/ not found)"
  DISABLED+=("context-router")
fi

# 8. n8n (workflow automation — optional, requires docker)
echo -n "  n8n: "
N8N_URL="${N8N_URL:-http://localhost:5678}"
# Check if n8n is already running
if curl -s --connect-timeout 2 "$N8N_URL/healthz" >/dev/null 2>&1 || \
   curl -s --connect-timeout 2 "$N8N_URL/api/v1/workflows" >/dev/null 2>&1; then
  echo "ENABLED (running at $N8N_URL)"
  ENABLED+=("n8n")
elif [ "$DO_INSTALL" = true ]; then
  # Try to install via docker
  if command -v docker &>/dev/null; then
    echo -n "installing via docker... "
    if docker ps -a --format '{{.Names}}' | grep -q "^n8n$" 2>/dev/null; then
      # Container exists, start it
      docker start n8n >/dev/null 2>&1 || true
      echo "STARTED (existing container)"
    else
      # Create new container
      docker run -d \
        --name n8n \
        -p 5678:5678 \
        -v n8n_data:/home/node/.n8n \
        -e N8N_SECURE_COOKIE=false \
        --restart unless-stopped \
        n8nio/n8n:latest >/dev/null 2>&1 && echo "INSTALLED (docker)" || echo "FAILED (docker run failed)"
    fi
    # Verify
    sleep 3
    if curl -s --connect-timeout 5 "$N8N_URL/healthz" >/dev/null 2>&1; then
      ENABLED+=("n8n")
    else
      echo "  n8n: started but not yet responding (may need a few more seconds)"
      DISABLED+=("n8n")
    fi
  else
    echo "SKIPPED (docker not installed — install Docker Desktop first)"
    echo "    Manual: docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n"
    DISABLED+=("n8n")
  fi
else
  echo "NOT RUNNING (optional — install with: --install + docker)"
  DISABLED+=("n8n")
fi

# DEPRECATED
echo -n "  memcp: "
echo "DEPRECATED (will be disabled if present)"
DISABLED+=("memcp")

echo -n "  claude-memory: "
echo "DEPRECATED (will be disabled if present)"
DISABLED+=("claude-memory")

# --- Merge phase: .mcp.json (Claude Code CLI) ---

echo ""
echo "--- Merge (.mcp.json for Claude Code) ---"

EXISTING_JSON="{}"
if [ -f ".mcp.json" ]; then
  EXISTING_JSON=$(cat .mcp.json)
  echo "Found existing .mcp.json — merging (existing servers preserved)"
else
  echo "No existing .mcp.json — creating new"
fi

MERGED_JSON=$($PYTHON -c "
import json, sys

existing = json.loads('''$EXISTING_JSON''')
servers = existing.get('mcpServers', {})

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

deprecated = ['memcp', 'claude-memory']
disabled_list = []
for dep in deprecated:
    if dep in servers:
        servers[dep]['disabled'] = True
        disabled_list.append(dep)

if added:
    print(f'Added: {chr(44).join(added)}', file=sys.stderr)
if preserved:
    print(f'Preserved: {chr(44).join(preserved)}', file=sys.stderr)
if disabled_list:
    print(f'Disabled (deprecated): {chr(44).join(disabled_list)}', file=sys.stderr)

existing['mcpServers'] = servers
print(json.dumps(existing, indent=2))
" 2>&1 1>/tmp/mcp_merged.json)

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
else
  if [ -f ".mcp.json" ]; then
    cp ".mcp.json" ".mcp.json.bak"
    echo "Backed up .mcp.json to .mcp.json.bak"
  fi
  echo "$MCP_JSON" > .mcp.json
  echo "Generated .mcp.json"
fi

# --- Zed configuration ---

if [ "$DO_ZED" = true ] || is_zed_environment; then
  echo ""
  echo "--- Zed AI Chat Configuration ---"
  echo ""
  echo "Zed uses context_servers in its own settings.json (NOT .mcp.json)."
  echo "This is needed ONLY if you use Zed's built-in AI chat panel."
  echo "If you use Claude Code in Zed's terminal — .mcp.json above is enough."
  echo ""

  ZED_SETTINGS_PATH=$(detect_zed_settings_path)

  # Generate context_servers snippet from detected servers
  ZED_SNIPPET=$($PYTHON -c "
import json

detected_lines = '''$DETECTED_SERVERS'''.strip().split('\n')
context_servers = {}

for line in detected_lines:
    if not line.strip():
        continue
    key, val_json = line.split('|', 1)
    val = json.loads(val_json)

    # Convert mcpServers format to context_servers format
    if 'command' in val:
        cs = {'command': {'path': val['command'], 'args': val.get('args', [])}}
        if 'env' in val:
            cs['command']['env'] = val['env']
        context_servers[key] = cs
    elif 'url' in val:
        context_servers[key] = {'url': val['url']}

print(json.dumps({'context_servers': context_servers}, indent=2))
")

  if [ "$DRY_RUN" = true ]; then
    echo "Would add to Zed settings ($ZED_SETTINGS_PATH):"
    echo "$ZED_SNIPPET"
  else
    if [ -f "$ZED_SETTINGS_PATH" ]; then
      # Merge into existing Zed settings
      cp "$ZED_SETTINGS_PATH" "${ZED_SETTINGS_PATH}.bak"
      $PYTHON -c "
import json, sys

with open('$ZED_SETTINGS_PATH') as f:
    settings = json.load(f)

snippet = json.loads('''$ZED_SNIPPET''')
cs = settings.get('context_servers', {})
new_cs = snippet.get('context_servers', {})

added = []
for k, v in new_cs.items():
    if k not in cs:
        cs[k] = v
        added.append(k)

settings['context_servers'] = cs

with open('$ZED_SETTINGS_PATH', 'w') as f:
    json.dump(settings, f, indent=2)

if added:
    print(f'Added to Zed: {chr(44).join(added)}')
else:
    print('Zed settings already up to date.')
"
      echo "Updated $ZED_SETTINGS_PATH (backup: .bak)"
    else
      echo "Zed settings not found at: $ZED_SETTINGS_PATH"
      echo ""
      echo "Add this to your Zed settings.json manually:"
      echo "$ZED_SNIPPET"
    fi
  fi
fi

# --- Final notes ---

if [ "$ENGRAM_INSTALLED" = false ] && [ "$DO_INSTALL" = false ]; then
  echo ""
  echo "WARNING: Engram not installed. Memory features will not work."
  echo "  Auto-install: bash scripts/bootstrap-mcp.sh --install"
  echo "  Verify after:  bash scripts/bootstrap-mcp.sh --check"
fi

echo ""
echo "Done. Next steps:"
echo "  1. Restart Claude Code to pick up .mcp.json changes"
if is_zed_environment && [ "$DO_ZED" != true ]; then
  echo "  2. For Zed AI chat: re-run with --zed flag"
fi
echo "  3. Verify: bash scripts/bootstrap-mcp.sh --check"
