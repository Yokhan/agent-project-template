#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 PROJECT --plan-file OUTSIDE_PROJECT.json [--apply]"
  echo "Preview is the default. Apply requires the exact saved preview plan."
  exit 1
fi

PROJECT_PATH="$1"
shift
exec node "$SCRIPT_DIR/scripts/sync-template.js" "$SCRIPT_DIR" "$PROJECT_PATH" --bootstrap "$@"
