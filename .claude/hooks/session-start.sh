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

# PROJECT_SPEC.md freshness check
if [ -f "PROJECT_SPEC.md" ]; then
  # Cross-platform: use python for date math (works on Windows Git Bash, Linux, macOS)
  spec_date=$(grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' PROJECT_SPEC.md 2>/dev/null | tail -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  if [ -n "$spec_date" ]; then
    days_old=$(python3 -c "
from datetime import datetime
try:
    d = datetime.strptime('$spec_date', '%Y-%m-%d')
    print((datetime.now() - d).days)
except:
    print(-1)
" 2>/dev/null || echo -1)
    if [ "$days_old" -gt 7 ] 2>/dev/null; then
      echo "WARNING: PROJECT_SPEC.md is ${days_old} days old. Regenerate it (see .claude/rules/context-first.md)."
    fi
  fi
else
  echo "ACTION: PROJECT_SPEC.md not found. Generate it now (see .claude/rules/context-first.md)."
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

# MCP health check: verify Engram is reachable
if [ -f ".mcp.json" ]; then
  HAS_ENGRAM=$(python3 -c "import json; d=json.load(open('.mcp.json')); print('yes' if 'engram' in d.get('mcpServers',{}) and not d['mcpServers']['engram'].get('disabled') else 'no')" 2>/dev/null || echo "no")
  if [ "$HAS_ENGRAM" = "yes" ]; then
    ENGRAM_CMD=$(python3 -c "import json; print(json.load(open('.mcp.json'))['mcpServers']['engram']['command'])" 2>/dev/null || echo "")
    if [ -n "$ENGRAM_CMD" ] && ! command -v "$ENGRAM_CMD" &>/dev/null 2>&1; then
      echo "WARNING: Engram configured but binary not found ($ENGRAM_CMD). Memory will use file fallback."
      echo "  Fix: bash scripts/bootstrap-mcp.sh --install"
    fi
  fi
else
  echo "INFO: No .mcp.json found. Run: bash scripts/bootstrap-mcp.sh --install"
fi

# Memory fallback file — import reminder
if [ -f tasks/.memory-fallback.md ] && [ -s tasks/.memory-fallback.md ]; then
  FALLBACK_COUNT=$(grep -c "^## " tasks/.memory-fallback.md 2>/dev/null || echo 0)
  if [ "$FALLBACK_COUNT" -gt 0 ]; then
    echo "RECOVERY: $FALLBACK_COUNT entries in tasks/.memory-fallback.md — import to Engram when available"
  fi
fi

exit 0
