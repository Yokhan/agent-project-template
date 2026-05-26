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
if echo "$TASK" | grep -qiE "implement|build|create|add|fix|bug|refactor|feature|module|function|class|api|endpoint|service|migrate|настрой|создай|добавь|исправь|починь|реализуй|напиши код|сделай|баг|не работает|падает|ошибка|сломал"; then
  FILES="$FILES $LIB/process/research-first.md $LIB/process/plan-first.md $LIB/process/self-verification.md $LIB/technical/architecture.md $LIB/technical/code-style.md $LIB/technical/error-handling.md $LIB/technical/atomic-reuse.md"
  MODES="$MODES code"
fi

# TEST
if echo "$TASK" | grep -qiE "test|coverage|tdd|spec|assert|mock|jest|pytest|vitest"; then
  FILES="$FILES $LIB/technical/testing.md $LIB/process/self-verification.md"
  MODES="$MODES test"
fi

# DESIGN
if echo "$TASK" | grep -qiE "design|figma|ui|ux|css|style|layout|component|token|color|font|responsive|tailwind|screen|дизайн|макет|фигма|экран|интерфейс|стиль"; then
  FILES="$FILES $LIB/domain/domain-design-pipeline.md $LIB/meta/analysis.md $LIB/technical/atomic-reuse.md"
  MODES="$MODES design"
fi

# REVIEW
if echo "$TASK" | grep -qiE "review|audit|check|analyze|report|status|health|inspect|evaluate|посмотри|проверь|оцени|разбери|покажи"; then
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

# TEMPLATE / CODEX ROUTING
if echo "$TASK" | grep -qiE "template|agents\.md|claude\.md|skill|subagent|router|route|sync-template|agent.project|шаблон|агент|скилл|роут|маршрут|синхрон"; then
  FILES="$FILES $LIB/meta/critical-thinking.md $LIB/technical/testing.md $LIB/technical/git-workflow.md"
  MODES="$MODES template"
fi

# RELEASE
if echo "$TASK" | grep -qiE "release|tag|version|changelog|publish|github release|deploy|релиз|верси|тег|опубликуй|выкат"; then
  FILES="$FILES $LIB/technical/git-workflow.md $LIB/technical/testing.md $LIB/meta/critical-thinking.md"
  MODES="$MODES release"
fi

# PLAN
if echo "$TASK" | grep -qiE "plan|strategy|architect|roadmap|estimate|decompose|breakdown|спланируй|декомпозируй|разбей|оцени сложность|архитектур"; then
  FILES="$FILES $LIB/meta/strategic-thinking.md $LIB/process/plan-first.md $LIB/conflict/conflict-resolution.md"
  MODES="$MODES plan"
fi

# SAFETY-CRITICAL
if echo "$TASK" | grep -qiE "health|fitness|medical|nutrition|exercise|science|evidence|study|research paper|здоровье|фитнес|тренировк|питание|наук"; then
  FILES="$FILES $LIB/domain/domain-guards.md $LIB/meta/critical-thinking.md"
  MODES="$MODES safety"
fi

# REFACTOR
if echo "$TASK" | grep -qiE "refactor|simplif|clean.up|extract|split|reorganize|рефактор|упрости|вынеси|раздели"; then
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

CODEX_SKILLS="codex-audit"
CODEX_SUBAGENTS="reviewer"
PIPELINE="review"
RISK="MEDIUM"
if echo "$MODES" | grep -q "template"; then
  CODEX_SKILLS="codex-template-sync codex-skill-maintenance codex-test-rules codex-agent-router codex-strategic-review"
  CODEX_SUBAGENTS="pr_explorer tester reviewer"
  PIPELINE="template maintenance"
  RISK="HIGH"
elif echo "$MODES" | grep -q "release"; then
  CODEX_SKILLS="codex-template-sync codex-health-check codex-test-rules codex-strategic-review"
  CODEX_SUBAGENTS="tester reviewer security_reviewer"
  PIPELINE="release"
  RISK="HIGH"
elif echo "$TASK" | grep -qiE "security|vulnerability|secret|auth|permission|injection|xss|csrf|ssrf|cve|owasp"; then
  CODEX_SKILLS="codex-security-audit codex-strategic-review"
  CODEX_SUBAGENTS="security_reviewer pr_explorer tester"
  PIPELINE="security patch"
  RISK="HIGH"
elif echo "$MODES" | grep -q "plan"; then
  CODEX_SKILLS="codex-strategic-review codex-decompose"
  CODEX_SUBAGENTS="pr_explorer reviewer"
  PIPELINE="planning"
elif echo "$MODES" | grep -q "design"; then
  CODEX_SKILLS="codex-design-workflow codex-domain-design-review"
  CODEX_SUBAGENTS="design_reviewer tester reviewer"
  PIPELINE="design"
elif echo "$MODES" | grep -q "test"; then
  CODEX_SKILLS="codex-coverage"
  CODEX_SUBAGENTS="tester reviewer"
  PIPELINE="quality gate"
elif echo "$MODES" | grep -q "code"; then
  CODEX_SKILLS="codex-feature-workflow codex-pipeline-workflow"
  CODEX_SUBAGENTS="pr_explorer tester reviewer"
  PIPELINE="feature"
fi

if { [ "$RISK" = "HIGH" ] || echo "$MODES" | grep -q "plan"; } &&
   ! echo "$CODEX_SKILLS" | grep -q "codex-strategic-review"; then
  CODEX_SKILLS="$CODEX_SKILLS codex-strategic-review"
fi

# Save active rules
mkdir -p tasks
{
  echo "TASK=$TASK"
  echo "MODES=$MODES"
  echo "AGENT=$AGENT"
  echo "CODEX_SKILLS=$CODEX_SKILLS"
  echo "CODEX_SUBAGENTS=$CODEX_SUBAGENTS"
  echo "PIPELINE=$PIPELINE"
  echo "RISK=$RISK"
  echo "STRATEGY_GATE=Goal -> Constraints -> Approach -> Verification -> Risk/Doubt"
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
echo "CODEX_SKILLS: $CODEX_SKILLS"
echo "CODEX_SUBAGENTS: $CODEX_SUBAGENTS"
echo "PIPELINE: $PIPELINE"
echo "RISK: $RISK"
echo "STRATEGY_GATE: Goal -> Constraints -> Approach -> Verification -> Risk/Doubt"
echo "RULES: $FILE_COUNT files, ~$LINE_COUNT lines"
echo "---"
echo "READ these files:"
for f in $VALID_FILES; do echo "  $f"; done
