#!/bin/bash
# Start n8n with required environment for agent template pipelines
# Usage: bash n8n/start.sh [--background]
#
# Required: npm install -g n8n (or run bootstrap-mcp.sh --install)

set -e

# Allow Code node to run shell commands
export NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path
export N8N_RUNNERS_TASK_TIMEOUT=120
export N8N_SECURE_COOKIE=false

# Load project .env if exists
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

export N8N_URL="${N8N_URL:-http://localhost:5678}"

# Check n8n installed
if ! command -v n8n &>/dev/null; then
  echo "ERROR: n8n not found. Install: npm install -g n8n"
  exit 1
fi

# Check if already running
if curl -s --connect-timeout 2 "$N8N_URL/healthz" >/dev/null 2>&1; then
  echo "n8n already running at $N8N_URL"

  # Import workflows if not yet imported
  if [ -f n8n/import.sh ]; then
    bash n8n/import.sh
  fi
  exit 0
fi

echo "Starting n8n at $N8N_URL..."

if [ "$1" = "--background" ]; then
  nohup n8n start > /dev/null 2>&1 &
  N8N_PID=$!
  echo "n8n PID: $N8N_PID"

  # Wait for startup
  for i in $(seq 1 15); do
    sleep 1
    if curl -s --connect-timeout 1 "$N8N_URL/healthz" >/dev/null 2>&1; then
      echo "n8n started successfully"
      # Import workflows
      if [ -f n8n/import.sh ]; then
        bash n8n/import.sh
      fi
      exit 0
    fi
  done
  echo "WARNING: n8n started but not responding yet. Check manually."
else
  # Foreground — import workflows first time via background check
  echo "Running in foreground. Press Ctrl+C to stop."
  echo "TIP: Run with --background for background mode."

  # Schedule import after startup (background subshell)
  (
    for i in $(seq 1 15); do
      sleep 1
      if curl -s --connect-timeout 1 "$N8N_URL/healthz" >/dev/null 2>&1; then
        [ -f n8n/import.sh ] && bash n8n/import.sh
        break
      fi
    done
  ) &

  n8n start
fi
