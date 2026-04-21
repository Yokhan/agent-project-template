#!/usr/bin/env bash
# test-template.sh — Smoke test for agent-project-template
# Verifies all required files exist and JSON is valid

set -euo pipefail

ERRORS=0
CHECKS=0
TEMPLATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TEMPLATE_DIR"

pass() { echo "  PASS: $1"; CHECKS=$((CHECKS+1)); }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS+1)); CHECKS=$((CHECKS+1)); }
check() { local d="$1"; shift; if "$@" &>/dev/null; then pass "$d"; else fail "$d"; fi; }

echo "=== Template Smoke Test: $TEMPLATE_DIR ==="
echo ""

echo "Required files:"
check "CLAUDE.md" test -f CLAUDE.md
check "AGENTS.md" test -f AGENTS.md
check "README.md" test -f README.md
check "SETUP_GUIDE.md" test -f SETUP_GUIDE.md
check "PROJECT_SPEC.md" test -f PROJECT_SPEC.md
check "ecosystem.md" test -f ecosystem.md
check "docs/PRODUCT_BOUNDARY.md" test -f docs/PRODUCT_BOUNDARY.md
check "docs/SAFE_DEFAULTS.md" test -f docs/SAFE_DEFAULTS.md
check "docs/SUPPORTED_ENVIRONMENTS.md" test -f docs/SUPPORTED_ENVIRONMENTS.md
check "setup.sh" test -f setup.sh
check "setup.bat" test -f setup.bat
check ".codex/config.toml" test -f .codex/config.toml
check ".codex/hooks.json" test -f .codex/hooks.json
check ".gitignore" test -f .gitignore
check ".gitattributes" test -f .gitattributes
check ".env.example" test -f .env.example
check "tasks/lessons.md" test -f tasks/lessons.md
check "tasks/current.md" test -f tasks/current.md
check "starter tasks/current.md" test -f templates/project-starter/tasks/current.md
check "starter .research-cache.md" test -f templates/project-starter/tasks/.research-cache.md
check "starter lessons.md" test -f templates/project-starter/tasks/lessons.md
check "starter tasks/audit/.gitkeep" test -f templates/project-starter/tasks/audit/.gitkeep
check "starter brain/01-daily/.gitkeep" test -f templates/project-starter/brain/01-daily/.gitkeep
check "scripts/check-drift.sh" test -f scripts/check-drift.sh
check "scripts/downstream-census.sh" test -f scripts/downstream-census.sh
check "scripts/generate-project-spec.sh" test -f scripts/generate-project-spec.sh
check "scripts/task-brief.sh" test -f scripts/task-brief.sh

echo ""
echo "Claude config:"
check ".claude/settings.json" test -f .claude/settings.json
check "settings.json valid JSON" node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"
check "router.md exists" bash -c '[ -f .claude/rules/router.md ]'
check ">=15 library rule files" bash -c '[ $(find .claude/library -name "*.md" 2>/dev/null | wc -l) -ge 15 ]'
check ">=7 agent files" bash -c '[ $(ls .claude/agents/*.md 2>/dev/null | wc -l) -ge 7 ]'
check ">=21 skill dirs" bash -c '[ $(ls -d .claude/skills/*/ 2>/dev/null | wc -l) -ge 21 ]'
check ">=6 domain skill dirs" bash -c '[ $(ls -d .claude/skills/domain-*/ 2>/dev/null | wc -l) -ge 6 ]'
check ">=12 command files" bash -c '[ $(ls .claude/commands/*.md 2>/dev/null | wc -l) -ge 12 ]'
check ">=7 hook files" bash -c '[ $(ls .claude/hooks/*.sh 2>/dev/null | wc -l) -ge 7 ]'
check "scripts/test-hooks.sh" test -f scripts/test-hooks.sh

echo ""
echo "Brain vault:"
check "brain/00-inbox" test -d brain/00-inbox
check "brain/01-daily" test -d brain/01-daily
check "brain/02-projects" test -d brain/02-projects
check "brain/03-knowledge" test -d brain/03-knowledge
check "brain/04-decisions" test -d brain/04-decisions
check "starter research/.gitkeep" test -f templates/project-starter/brain/03-knowledge/research/.gitkeep
check "starter audits/.gitkeep" test -f templates/project-starter/brain/03-knowledge/audits/.gitkeep
check ">=3 brain templates" bash -c '[ $(ls brain/templates/*.md 2>/dev/null | wc -l) -ge 3 ]'

echo ""
echo "File sizes:"
check "CLAUDE.md <=300 lines" bash -c '[ $(wc -l < CLAUDE.md) -le 300 ]'

echo ""
echo "Entry points:"
check "README has no start.sh references" bash -c "! grep -q 'start\\.sh' README.md"
check "README has no start.bat references" bash -c "! grep -q 'start\\.bat' README.md"
check "README has no localhost:3333 references" bash -c "! grep -q 'localhost:3333' README.md"
check "README has no Command Center section" bash -c "! grep -q '## Command Center' README.md"
check "SETUP_GUIDE has no legacy --from sync syntax" bash -c "! grep -q 'sync-template\\.sh --from ' SETUP_GUIDE.md"
check "SETUP_GUIDE has no Python 3 bootstrap prerequisite" bash -c "! grep -q 'Python 3' SETUP_GUIDE.md"
check "No tracked local Claude settings" bash -c '! git ls-files --error-unmatch .claude/settings.local.json >/dev/null 2>&1'
check "Codex config has no user-owned defaults" bash -c "! grep -Eq '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\\s*=' .codex/config.toml"
check "downstream-census --json" bash -c 'bash scripts/downstream-census.sh --no-sync --json "$PWD" 2>/dev/null | node -e "const text=require(\"fs\").readFileSync(0,\"utf8\").trim(); JSON.parse(text || \"[]\")"'
check "generate-project-spec" bash -c 'bash scripts/generate-project-spec.sh | grep -q "^## Identity"'
check "scan-project --report" bash -c 'bash scripts/scan-project.sh --report >/dev/null'
check "task-brief --brief" bash scripts/task-brief.sh --brief
check "task-brief --json" bash -c 'bash scripts/task-brief.sh --json | node -e "JSON.parse(require(\"fs\").readFileSync(0, \"utf8\"))"'

echo ""
echo "Bootstrap trust smoke:"
SMOKE_SENTINEL="docs/.setup-leak-sentinel-$RANDOM-$$.txt"
SMOKE_PROJECT="template-leak-smoke-$RANDOM-$$"
cleanup_smoke() {
  rm -f "$SMOKE_SENTINEL"
  rm -rf "$SMOKE_PROJECT" 2>/dev/null || powershell.exe -NoProfile -Command "if (Test-Path '$SMOKE_PROJECT') { Remove-Item -Recurse -Force '$SMOKE_PROJECT' }" >/dev/null 2>&1 || true
}
trap cleanup_smoke EXIT
printf 'sentinel\n' > "$SMOKE_SENTINEL"
check "setup.sh excludes untracked payload sentinel" bash -c 'bash setup.sh "'"$SMOKE_PROJECT"'" >/dev/null 2>&1 && [ ! -f "'"$SMOKE_PROJECT"'/'"$SMOKE_SENTINEL"'" ]'
cleanup_smoke
trap - EXIT

echo ""
echo "Results: $((CHECKS-ERRORS))/$CHECKS passed"
if [ $ERRORS -eq 0 ]; then
    echo "Template is healthy!"
    exit 0
else
    echo "$ERRORS check(s) failed"
    exit 1
fi
