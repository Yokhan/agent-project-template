#!/bin/bash
# Session Stop Hook — logs session end and stats

if [ "$TEST_MODE" = "1" ]; then
  echo "test-mode: would log session end"
  exit 0
fi

if [ -d "brain/01-daily" ]; then
  d=$(date +%Y-%m-%d)
  f="brain/01-daily/${d}.md"
  if [ ! -f "$f" ]; then
    echo "# Session Log: ${d}" > "$f"
  fi
  echo "" >> "$f"
  echo "## Session ended: $(date +%H:%M)" >> "$f"
  echo "" >> "$f"
  commits=$(git log --oneline --since="${d} 00:00" 2>/dev/null | wc -l | tr -d ' ')
  echo "## Session stats: $commits commits today" >> "$f"
fi

# Collect session metrics
if [ -f scripts/session-metrics.sh ]; then
  bash scripts/session-metrics.sh 2>/dev/null || true
fi

exit 0
