#!/bin/bash
# Import n8n workflows from JSON files
# Usage: bash n8n/import.sh
# Idempotent — skips workflows that already exist by name

set -e

# Load .env
if [ -f .env ]; then
  set -a; source .env 2>/dev/null || true; set +a
fi

N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:-}"
WF_DIR="n8n/workflows"

if [ ! -d "$WF_DIR" ]; then
  echo "No workflow directory: $WF_DIR"
  exit 0
fi

# Check n8n is running
if ! curl -s --connect-timeout 3 "$N8N_URL/healthz" >/dev/null 2>&1; then
  echo "n8n not running at $N8N_URL. Skipping import."
  exit 0
fi

if [ -z "$N8N_API_KEY" ]; then
  echo "WARNING: N8N_API_KEY not set in .env. Cannot import workflows."
  echo "  1. Open $N8N_URL → Settings → API → Create API Key"
  echo "  2. Add to .env: N8N_API_KEY=your_key_here"
  exit 0
fi

# Detect python
if command -v python3 &>/dev/null; then PYTHON=python3
elif command -v python &>/dev/null; then PYTHON=python
else echo "WARNING: Python not found. Cannot parse JSON for import."; exit 0; fi

# Get existing workflow names
EXISTING=$($PYTHON -c "
import json, urllib.request
req = urllib.request.Request('$N8N_URL/api/v1/workflows', headers={'X-N8N-API-KEY': '$N8N_API_KEY'})
data = json.loads(urllib.request.urlopen(req, timeout=5).read())
for wf in data.get('data', []):
    print(wf['name'])
" 2>/dev/null || echo "")

# Load config for path injection
CONFIG_FILE="n8n/config.json"
PROJ_ROOT="."
DOCS_DIR="."
if [ -f "$CONFIG_FILE" ]; then
  PROJ_ROOT=$($PYTHON -c "import json; print(json.load(open('$CONFIG_FILE')).get('project_root','.'))" 2>/dev/null || echo ".")
  DOCS_DIR=$($PYTHON -c "import json; print(json.load(open('$CONFIG_FILE')).get('documents_dir','.'))" 2>/dev/null || echo ".")
fi

IMPORTED=0
SKIPPED=0

for wf_file in "$WF_DIR"/*.json; do
  [ -f "$wf_file" ] || continue
  WF_NAME=$($PYTHON -c "import json; print(json.load(open('$wf_file'))['name'])" 2>/dev/null)

  if [ -z "$WF_NAME" ]; then
    echo "  SKIP: $wf_file (cannot read name)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Check if already exists
  if echo "$EXISTING" | grep -qx "$WF_NAME"; then
    echo "  EXISTS: $WF_NAME (skipping)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Import — inject config paths into workflow JSON
  TMP_WF="/tmp/n8n-import-$$.json"
  sed "s|__PROJECT_ROOT__|$PROJ_ROOT|g; s|__DOCUMENTS_DIR__|$DOCS_DIR|g" "$wf_file" > "$TMP_WF"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$N8N_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$TMP_WF")
  rm -f "$TMP_WF"

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "  IMPORTED: $WF_NAME"
    IMPORTED=$((IMPORTED + 1))
  else
    echo "  FAILED: $WF_NAME (HTTP $HTTP_CODE)"
  fi
done

echo ""
echo "=== Import: $IMPORTED new, $SKIPPED skipped ==="

if [ "$IMPORTED" -gt 0 ]; then
  echo "Activate workflows at: $N8N_URL"
  echo "TIP: Webhook workflows must be activated to accept requests."
fi
