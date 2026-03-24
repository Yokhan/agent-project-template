#!/bin/bash
# Session Start Hook — creates session log, shows reminders, checks template

# TEST_MODE guard
if [ "$TEST_MODE" = "1" ]; then
  echo "test-mode: would create session log and show reminders"
  exit 0
fi

# Session log
if [ -d "brain/01-daily" ]; then
  d=$(date +%Y-%m-%d)
  f="brain/01-daily/${d}.md"
  if [ ! -f "$f" ]; then
    echo "# Session Log: ${d}" > "$f"
  fi
  echo "" >> "$f"
  echo "## Session started: $(date +%H:%M)" >> "$f"
  branch=$(git branch --show-current 2>/dev/null || true)
  if [ -n "$branch" ]; then
    echo "Branch: $branch" >> "$f"
  fi
  echo "" >> "$f"
fi

# Reminders
if [ -f "tasks/lessons.md" ]; then
  echo "REMINDER: Read tasks/lessons.md for past learnings"
fi
if [ -f "tasks/current.md" ]; then
  echo "REMINDER: Read tasks/current.md for handoff context"
  head -3 tasks/current.md 2>/dev/null || true
fi

# Uncommitted changes warning
unstaged=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$unstaged" -gt 0 ] 2>/dev/null; then
  echo "WARNING: $unstaged uncommitted changes from previous session"
fi

# Backup current.md
if [ -f "tasks/current.md" ]; then
  cp tasks/current.md tasks/.current.md.bak 2>/dev/null || true
fi

# Template version check
if [ -f ".template-manifest.json" ] && [ -f "scripts/check-drift.sh" ]; then
  proj_ver=$(python3 -c "import json; print(json.load(open('.template-manifest.json'))['template_version'])" 2>/dev/null || true)
  script_ver=$(grep -o 'TEMPLATE_VERSION="[^"]*"' scripts/check-drift.sh 2>/dev/null | head -1 | cut -d'"' -f2 || true)
  if [ -n "$proj_ver" ] && [ -n "$script_ver" ] && [ "$proj_ver" != "$script_ver" ]; then
    echo "WARNING: Template outdated ($proj_ver vs $script_ver). Run /update-template."
  fi
fi

# Template fetch check (lightweight, no network)
if git remote get-url template >/dev/null 2>&1; then
  last_fetch=$(git log -1 --format=%ct refs/remotes/template/main 2>/dev/null || git log -1 --format=%ct refs/remotes/template/master 2>/dev/null || echo 0)
  now=$(date +%s 2>/dev/null || echo 0)
  if [ "$now" -gt 0 ] && [ "$last_fetch" -gt 0 ]; then
    days_since=$(( (now - last_fetch) / 86400 ))
    if [ "$days_since" -gt 7 ]; then
      echo "INFO: Template not checked in ${days_since}d."
    fi
  fi
fi

# Task queue check
if [ -f tasks/queue.md ] && [ -s tasks/queue.md ]; then
  QUEUED=$(grep -c "^## Queued:" tasks/queue.md 2>/dev/null || echo 0)
  if [ "$QUEUED" -gt 0 ]; then
    echo "QUEUE: $QUEUED queued task(s) in tasks/queue.md — review before starting"
  fi
fi

# Compaction snapshot recovery hint
if [ -f tasks/.compaction-snapshot.md ]; then
  echo "RECOVERY: Compaction snapshot found. Read tasks/.compaction-snapshot.md if context was lost."
fi

# Lessons count (learning velocity indicator)
if [ -f tasks/lessons.md ]; then
  LESSON_COUNT=$(grep -c "^### " tasks/lessons.md 2>/dev/null || echo 0)
  if [ "$LESSON_COUNT" -gt 40 ]; then
    echo "INFO: $LESSON_COUNT lessons in lessons.md — consider running /weekly to promote patterns to rules"
  fi
fi

exit 0
