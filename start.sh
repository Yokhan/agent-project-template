#!/bin/bash
# Start Agent Command Center — n8n + dashboard
# Usage: bash start.sh
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Starting Command Center..."

# Start n8n in background (if not already running)
if ! curl -s --connect-timeout 1 http://localhost:5678/healthz >/dev/null 2>&1; then
  echo "Starting n8n..."
  NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path n8n start &
  sleep 5
else
  echo "n8n already running"
fi

# Start dashboard
echo "Starting dashboard..."
python n8n/dashboard/serve.py 2>/dev/null &

sleep 2
echo ""
echo "=== Agent Command Center ==="
echo "Dashboard:  http://localhost:3333"
echo "n8n:        http://localhost:5678"
echo ""
echo "Shortcuts: / = chat, D = theme, Esc = back, 1-9 = project"
echo "Press Ctrl+C to stop"
wait
