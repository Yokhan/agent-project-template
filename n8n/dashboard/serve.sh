#!/bin/bash
# Serve dashboard on localhost:3333 — instant load, no n8n overhead
# n8n webhooks still used for API calls (agent-state, chat, feed, etc.)
# Usage: bash n8n/dashboard/serve.sh [port]
PORT="${1:-3333}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Dashboard: http://localhost:$PORT"
echo "n8n API:   http://localhost:5678/webhook/*"
echo ""

if command -v python &>/dev/null; then
  cd "$DIR" && python -m http.server "$PORT" --bind 127.0.0.1
elif command -v python3 &>/dev/null; then
  cd "$DIR" && python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "ERROR: Python required. Install python."
  exit 1
fi
