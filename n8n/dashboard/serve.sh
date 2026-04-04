#!/bin/bash
# Serve dashboard with n8n webhook proxy (solves CORS)
# Usage: bash n8n/dashboard/serve.sh [port]
PORT="${1:-3333}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v python &>/dev/null; then
  python "$DIR/serve.py" "$PORT"
elif command -v python3 &>/dev/null; then
  python3 "$DIR/serve.py" "$PORT"
else
  echo "ERROR: Python required."
  exit 1
fi
