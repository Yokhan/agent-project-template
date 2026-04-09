#!/usr/bin/env bash
# import-graph.sh — Find most-imported files (hot files) in a project
# Usage: bash scripts/import-graph.sh [directory] [--top N]
#
# Shows which files are imported most frequently across the codebase.
# Hot files = high blast radius = change carefully.
# Inspired by CodeSight's import graph detector.

set -euo pipefail

SEARCH_DIR="${1:-.}"
TOP_N=20

if [ "${2:-}" = "--top" ] && [ -n "${3:-}" ]; then
  TOP_N="$3"
fi

echo "=== IMPORT GRAPH: $SEARCH_DIR ==="
echo ""

# Find all source files
SRC_FILES=$(find "$SEARCH_DIR" -type f \( \
  -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
  -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.vue" \
  -o -name "*.svelte" \
  \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" \
  -not -path "*/build/*" -not -path "*/__pycache__/*" \
  2>/dev/null)

[ -z "$SRC_FILES" ] && echo "No source files found in $SEARCH_DIR" && exit 0

TOTAL_FILES=$(echo "$SRC_FILES" | wc -l | tr -d ' ')
echo "Scanning $TOTAL_FILES source files..."
echo ""

# Extract all import targets and count occurrences
# Handles: import from 'x', require('x'), from x import y
echo "$SRC_FILES" | xargs grep -hE \
  "from\s+['\"]|import\s+['\"]|require\s*\(['\"]" \
  2>/dev/null | \
  sed -E "s/.*from\s+['\"]([^'\"]+)['\"].*/\1/; s/.*import\s+['\"]([^'\"]+)['\"].*/\1/; s/.*require\s*\(['\"]([^'\"]+)['\"].*/\1/" | \
  # Filter to local imports only (starts with . or /)
  grep -E "^\.\.?/" | \
  # Normalize: remove extensions, index
  sed -E 's/\.(ts|tsx|js|jsx|vue|svelte|py)$//; s/\/index$//' | \
  sort | uniq -c | sort -rn | head -"$TOP_N" > /tmp/import-graph-results.tmp 2>/dev/null || true

if [ ! -s /tmp/import-graph-results.tmp ]; then
  echo "No local imports found."
  rm -f /tmp/import-graph-results.tmp
  exit 0
fi

echo "TOP $TOP_N MOST IMPORTED FILES (hot files):"
echo "─────────────────────────────────────────────"
printf "%-6s  %s\n" "REFS" "MODULE"
echo "─────────────────────────────────────────────"

while read -r count module; do
  # Classify risk
  if [ "$count" -ge 20 ]; then
    RISK="CRITICAL"
  elif [ "$count" -ge 10 ]; then
    RISK="HIGH"
  elif [ "$count" -ge 5 ]; then
    RISK="MEDIUM"
  else
    RISK="LOW"
  fi
  printf "%-6s  %-50s  [%s]\n" "$count" "$module" "$RISK"
done < /tmp/import-graph-results.tmp

rm -f /tmp/import-graph-results.tmp

# Also find orphan files (imported by nobody)
echo ""
echo "─────────────────────────────────────────────"

# Count files with no importers
ORPHAN_COUNT=0
echo "$SRC_FILES" | while read -r f; do
  BASENAME=$(basename "$f" | sed 's/\.[^.]*$//')
  # Skip test files, configs, entry points
  case "$f" in
    *.test.*|*.spec.*|*config*|*main.*|*index.*|*App.*) continue ;;
  esac
  REFS=$(echo "$SRC_FILES" | xargs grep -l "$BASENAME" 2>/dev/null | grep -v "$f" | wc -l | tr -d ' ')
  if [ "$REFS" -eq 0 ]; then
    ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
  fi
done 2>/dev/null

echo ""
echo "Use 'bash scripts/blast-radius.sh <file>' to analyze a specific hot file."
