#!/bin/bash
# Start Agent Command Center — preflight checks + n8n + dashboard
# Usage: bash start.sh [--no-n8n] [--install]
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

NO_N8N=false
INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --no-n8n) NO_N8N=true ;;
    --install) INSTALL=true ;;
  esac
done

echo "=== Agent Command Center — Preflight ==="

# 1. Check Python
PYTHON=""
if command -v python3 &>/dev/null; then PYTHON="python3"
elif command -v python &>/dev/null; then PYTHON="python"
fi
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python not found. Install Python 3.8+ and retry."
  exit 1
fi
echo "✓ Python: $($PYTHON --version 2>&1)"

# 2. Check Node.js (for MCP context-router)
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install Node.js 18+ and retry."
  exit 1
fi
echo "✓ Node: $(node --version)"

# 3. Check MCP context-router dependencies
if [ ! -d "mcp-servers/context-router/node_modules" ]; then
  echo "Installing MCP context-router dependencies..."
  (cd mcp-servers/context-router && npm install --silent 2>/dev/null)
fi
echo "✓ MCP context-router: ready"

# 4. Bootstrap MCP if --install or first run
if [ "$INSTALL" = true ] || [ ! -f ".mcp.json" ]; then
  echo "Bootstrapping MCP servers..."
  bash scripts/bootstrap-mcp.sh --install 2>/dev/null || true
fi
if [ -f ".mcp.json" ]; then
  echo "✓ .mcp.json: exists"
else
  echo "⚠ .mcp.json: missing (MCP tools won't work in Claude Code)"
fi

# 5. Check n8n (optional)
if [ "$NO_N8N" = false ]; then
  if command -v n8n &>/dev/null; then
    echo "✓ n8n: $(n8n --version 2>/dev/null || echo 'installed')"
  else
    echo "⚠ n8n not found. Dashboard works without it. Install: npm install -g n8n"
    NO_N8N=true
  fi
fi

# 6. Check config
if [ ! -f "n8n/config.json" ]; then
  echo "Creating config.json..."
  DOCS_DIR="$(cd ~ && pwd)/Documents"
  # Auto-detect orchestrator: look for project with orchestrator CLAUDE.md
  ORCH_NAME=""
  for d in "$DOCS_DIR"/*/; do
    if [ -f "${d}CLAUDE.md" ] && grep -q "Orchestrator Agent" "${d}CLAUDE.md" 2>/dev/null; then
      ORCH_NAME=$(basename "$d")
      break
    fi
  done
  if [ -z "$ORCH_NAME" ]; then
    echo "  No orchestrator project found. Create one: bash setup.sh my-pa --orchestrator"
    ORCH_NAME=""
  else
    echo "  Found orchestrator: $ORCH_NAME"
  fi
  cat > n8n/config.json << EOCFG
{
  "documents_dir": "$DOCS_DIR",
  "orchestrator_project": "$ORCH_NAME"
}
EOCFG
fi
echo "✓ Config: n8n/config.json"

echo ""
echo "=== Starting Services ==="

# Start n8n (if available and not --no-n8n)
if [ "$NO_N8N" = false ]; then
  if ! curl -s --connect-timeout 1 http://localhost:5678/healthz >/dev/null 2>&1; then
    echo "Starting n8n..."
    NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path n8n start &
    sleep 3
  else
    echo "✓ n8n already running"
  fi
fi

# Start desktop app
APP_EXE="desktop/src-tauri/target/release/agent-os"
if [ -f "$APP_EXE" ]; then
  echo "Starting Agent OS..."
  "$APP_EXE" &
elif command -v cargo &>/dev/null; then
  echo "Desktop app not built. Building..."
  (cd desktop && cargo tauri build) || { echo "Build failed. Run: cd desktop && cargo tauri dev"; exit 1; }
  "$APP_EXE" &
else
  echo "ERROR: Desktop app not built and cargo not found."
  echo "Build: cd desktop && cargo tauri build"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       Agent OS — RUNNING             ║"
echo "╠══════════════════════════════════════╣"
[ "$NO_N8N" = false ] && echo "║  n8n:  http://localhost:5678          ║"
echo "║  Desktop app launched                 ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop"
wait
