#!/usr/bin/env bash
# update-template.sh — Update project from newer template version
# Delegates to the native transaction engine through sync-template.sh.
# Usage: ./scripts/update-template.sh TEMPLATE PROJECT --plan-file OUTSIDE_PROJECT.json [--apply]

exec "$(dirname "$0")/sync-template.sh" "$@"
