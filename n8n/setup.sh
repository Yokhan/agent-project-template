#!/bin/bash
# n8n First-Time Setup — creates config, .n8n/.env, and imports workflows
# Usage: bash n8n/setup.sh
set -e

echo "=== n8n Setup for Agent Template ==="
echo ""

# 1. Detect project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Project root: $PROJECT_ROOT"

# 2. Detect Documents directory (Windows-compatible paths)
if [ -n "$USERPROFILE" ]; then
  # Convert to forward-slash Windows path (C:/Users/...)
  DOCS_DIR="$(cygpath -m "$USERPROFILE/Documents" 2>/dev/null || echo "$USERPROFILE/Documents" | sed 's|\\|/|g')"
  PROJECT_ROOT="$(cygpath -m "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT")"
elif [ -n "$HOME" ]; then
  DOCS_DIR="$HOME/Documents"
else
  DOCS_DIR="."
fi
echo "Documents dir: $DOCS_DIR"

# 3. Create n8n config
CONFIG="$PROJECT_ROOT/n8n/config.json"
cat > "$CONFIG" << CFGEOF
{
  "project_root": "$PROJECT_ROOT",
  "documents_dir": "$DOCS_DIR",
  "n8n_url": "http://localhost:5678"
}
CFGEOF
echo "Created: $CONFIG"

# 4. Ensure .n8n/.env exists with required settings
N8N_DIR=""
if [ -n "$USERPROFILE" ]; then
  N8N_DIR="$USERPROFILE/.n8n"
elif [ -n "$HOME" ]; then
  N8N_DIR="$HOME/.n8n"
fi

if [ -n "$N8N_DIR" ]; then
  mkdir -p "$N8N_DIR"
  ENV_FILE="$N8N_DIR/.env"
  if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << ENVEOF
NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path
N8N_SECURE_COOKIE=false
ENVEOF
    echo "Created: $ENV_FILE"
  else
    # Ensure our settings are in there
    grep -q "NODE_FUNCTION_ALLOW_BUILTIN" "$ENV_FILE" || echo "NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path" >> "$ENV_FILE"
    echo "Updated: $ENV_FILE"
  fi
fi

# 5. Check n8n installed
if ! command -v n8n &>/dev/null; then
  echo ""
  echo "n8n not found. Installing..."
  npm install -g n8n 2>/dev/null || { echo "FAILED: npm install -g n8n"; echo "Install manually: npm install -g n8n"; exit 1; }
fi
echo "n8n: $(n8n --version 2>/dev/null || echo installed)"

# 6. Check if n8n is running
echo ""
if curl -s --connect-timeout 2 "http://localhost:5678/healthz" >/dev/null 2>&1; then
  echo "n8n is running."
else
  echo "n8n is NOT running."
  echo "Start in a separate terminal: bash n8n/start.sh"
  echo ""
  echo "After starting n8n:"
  echo "  1. Open http://localhost:5678"
  echo "  2. Create account (first time only)"
  echo "  3. Settings → API → Create API Key"
  echo "  4. Add to .env: N8N_API_KEY=your_key_here"
  echo "  5. Run: bash n8n/import.sh"
  exit 0
fi

# 7. Check API key
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a; source "$PROJECT_ROOT/.env" 2>/dev/null || true; set +a
fi
if [ -z "$N8N_API_KEY" ]; then
  echo ""
  echo "N8N_API_KEY not set."
  echo "  1. Open http://localhost:5678 → Settings → API → Create Key"
  echo "  2. Add to $PROJECT_ROOT/.env: N8N_API_KEY=your_key"
  echo "  3. Re-run: bash n8n/setup.sh"
  exit 0
fi

# 8. Import workflows
echo ""
echo "Importing workflows..."
bash "$PROJECT_ROOT/n8n/import.sh"

echo ""
echo "=== Setup Complete ==="
echo "Activate workflows at: http://localhost:5678"
