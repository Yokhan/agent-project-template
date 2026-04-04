#!/bin/bash
# route-task.sh — Dynamic keyword router (zero AI tokens)
# Routes task to relevant rules, agent, pipeline. ~10ms, pure grep.
# Usage: bash scripts/route-task.sh "implement OAuth for auth module"
# Output: rule files to Read + suggested agent → saved to tasks/.active-rules
# Called: on EVERY new task, on task switch, on mode change

TASK="${1:-}"
LIB=".claude/library"
ACTIVE="tasks/.active-rules"

if [ -z "$TASK" ]; then
  echo "Usage: bash scripts/route-task.sh \"<task description>\""
  echo "Example: bash scripts/route-task.sh \"implement OAuth for auth module\""
  exit 1
fi

# Always needed
FILES="$LIB/process/context-first.md"
MODES=""

# CODE
if echo "$TASK" | grep -qiE "implement|build|create|add|fix|bug|refactor|feature|module|function|class|api|endpoint|service|migrate"; then
  FILES="$FILES $LIB/process/research-first.md $LIB/process/plan-first.md $LIB/process/self-verification.md $LIB/technical/architecture.md $LIB/technical/code-style.md $LIB/technical/error-handling.md $LIB/technical/atomic-reuse.md"
  MODES="$MODES code"
fi

# TEST
if echo "$TASK" | grep -qiE "test|coverage|tdd|spec|assert|mock|jest|pytest|vitest"; then
  FILES="$FILES $LIB/technical/testing.md $LIB/process/self-verification.md"
  MODES="$MODES test"
fi

# DESIGN
if echo "$TASK" | grep -qiE "design|figma|ui|ux|css|style|layout|component|token|color|font|responsive|tailwind|screen"; then
  FILES="$FILES $LIB/domain/domain-design-pipeline.md $LIB/meta/analysis.md $LIB/technical/atomic-reuse.md"
  MODES="$MODES design"
fi

# REVIEW
if echo "$TASK" | grep -qiE "review|audit|check|analyze|report|status|health|inspect|evaluate"; then
  FILES="$FILES $LIB/meta/analysis.md $LIB/meta/critical-thinking.md $LIB/process/self-verification.md"
  MODES="$MODES review"
fi

# WRITING
if echo "$TASK" | grep -qiE "write|article|post|copy|text|content|landing|marketing|email|newsletter|документ|текст|статья"; then
  FILES="$FILES $LIB/technical/writing.md $LIB/domain/domain-guards.md"
  MODES="$MODES write"
fi

# GIT
if echo "$TASK" | grep -qiE "commit|push|pr|pull.request|merge|branch|release|deploy|tag|cherry"; then
  FILES="$FILES $LIB/technical/git-workflow.md"
  MODES="$MODES git"
fi

# PLAN
if echo "$TASK" | grep -qiE "plan|strategy|architect|roadmap|estimate|decompose|breakdown"; then
  FILES="$FILES $LIB/meta/strategic-thinking.md $LIB/process/plan-first.md $LIB/conflict/conflict-resolution.md"
  MODES="$MODES plan"
fi

# SAFETY-CRITICAL
if echo "$TASK" | grep -qiE "health|fitness|medical|nutrition|exercise|science|evidence|study|research paper"; then
  FILES="$FILES $LIB/domain/domain-guards.md $LIB/meta/critical-thinking.md"
  MODES="$MODES safety"
fi

# REFACTOR
if echo "$TASK" | grep -qiE "refactor|simplif|clean.up|extract|split|reorganize"; then
  FILES="$FILES $LIB/technical/architecture.md $LIB/technical/code-style.md $LIB/process/self-verification.md $LIB/technical/testing.md"
  MODES="$MODES refactor"
fi

# If nothing matched, load minimal code set
if [ -z "$MODES" ]; then
  FILES="$FILES $LIB/process/research-first.md $LIB/process/self-verification.md $LIB/technical/architecture.md"
  MODES="general"
fi

# Deduplicate
UNIQUE_FILES=$(echo "$FILES" | tr ' ' '\n' | sort -u)
FILE_COUNT=0
LINE_COUNT=0
VALID_FILES=""
for f in $UNIQUE_FILES; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f" | tr -d ' ')
    LINE_COUNT=$((LINE_COUNT + lines))
    FILE_COUNT=$((FILE_COUNT + 1))
    VALID_FILES="$VALID_FILES $f"
  fi
done

# Determine agent
if echo "$TASK" | grep -qiE "review|audit"; then AGENT="reviewer"
elif echo "$TASK" | grep -qiE "test|tdd|coverage"; then AGENT="test-engineer"
elif echo "$TASK" | grep -qiE "write|article|copy|текст|статья"; then AGENT="writer"
elif echo "$TASK" | grep -qiE "security|vulnerability|owasp"; then AGENT="security-auditor"
elif echo "$TASK" | grep -qiE "performance|slow|optimize|profile|benchmark"; then AGENT="profiler"
elif echo "$TASK" | grep -qiE "document|readme|changelog|api.doc"; then AGENT="documenter"
elif echo "$TASK" | grep -qiE "simplif|reduce|clean"; then AGENT="simplifier"
else AGENT="implementer"; fi

# Save active rules
mkdir -p tasks
{
  echo "TASK=$TASK"
  echo "MODES=$MODES"
  echo "AGENT=$AGENT"
  echo "COUNT=$FILE_COUNT files, $LINE_COUNT lines"
  echo "ROUTED_AT=$(date -u +%Y-%m-%dT%H:%M 2>/dev/null || date +%Y-%m-%dT%H:%M)"
  echo "---"
  for f in $VALID_FILES; do echo "$f"; done
} > "$ACTIVE"

# Output
echo "=== ROUTE ==="
echo "TASK: $TASK"
echo "MODES:$MODES"
echo "AGENT: $AGENT"
echo "RULES: $FILE_COUNT files, ~$LINE_COUNT lines"
echo "---"
echo "READ these files:"
for f in $VALID_FILES; do echo "  $f"; done
