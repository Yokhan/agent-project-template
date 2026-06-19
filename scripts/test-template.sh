#!/usr/bin/env bash
# test-template.sh — Smoke test for agent-project-template
# Verifies all required files exist and JSON is valid

set -euo pipefail

normalize_drive_path() {
  local path="$1"
  case "$path" in
    /[A-Z]/*)
      printf '/%s%s\n' "$(printf '%s' "${path:1:1}" | tr 'A-Z' 'a-z')" "${path:2}"
      ;;
    *)
      printf '%s\n' "$path"
      ;;
  esac
}

ERRORS=0
CHECKS=0
TEMPLATE_DIR="$(normalize_drive_path "$(cd "$(dirname "$0")/.." && pwd)")"
cd "$TEMPLATE_DIR"

[ -f "$TEMPLATE_DIR/scripts/lib/platform.sh" ] && source "$TEMPLATE_DIR/scripts/lib/platform.sh"

pass() { echo "  PASS: $1"; CHECKS=$((CHECKS+1)); }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS+1)); CHECKS=$((CHECKS+1)); }
skip() { echo "  SKIP: $1"; CHECKS=$((CHECKS+1)); }
check() { local d="$1"; shift; if "$@" &>/dev/null; then pass "$d"; else fail "$d"; fi; }
is_template_source_repo() { grep -Eq '^- Name: agent-project-template$' PROJECT_SPEC.md 2>/dev/null; }
source_only_check() {
  local description="$1"
  shift
  if is_template_source_repo; then
    check "$description" "$@"
  else
    skip "$description (template source repo only)"
  fi
}
validate_text_policy_rejects_mojibake() {
  local fixture
  fixture="$(_temp_file text-policy-fixture)"
  node -e "require('fs').writeFileSync(process.argv[1], 'Broken: \\u0432\\u0402\\u201D\\n', 'utf8')" "$fixture"
  if node scripts/validate-text-policy.js --path "$fixture" >/dev/null 2>&1; then
    rm -f "$fixture"
    return 1
  fi
  rm -f "$fixture"
  return 0
}
github_workflows_use_node24_actions() {
  ! grep -R -E 'actions/(checkout|setup-node)@v4' .github &&
    ! grep -R -E "node-version:[[:space:]]*['\"]?20" .github
}

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
check "docs/TEMPLATE_RELEASES.md" test -f docs/TEMPLATE_RELEASES.md
check ".claude/library/product/production-product-standard.md" test -f .claude/library/product/production-product-standard.md
check ".claude/library/process/product-goal-loop.md" test -f .claude/library/process/product-goal-loop.md
check ".claude/library/domain/domain-design-system.md" test -f .claude/library/domain/domain-design-system.md
check "docs/AGENT_PIPELINES.md" test -f docs/AGENT_PIPELINES.md
check "docs/AGENT_CONTEXT_SOT.md" test -f docs/AGENT_CONTEXT_SOT.md
check "docs/CODEX_FANOUT_PATTERNS.md" test -f docs/CODEX_FANOUT_PATTERNS.md
check "docs/CODEX_SKILLS_AUDIT.md" test -f docs/CODEX_SKILLS_AUDIT.md
check "docs/CODEX_SUBAGENTS_AUDIT.md" test -f docs/CODEX_SUBAGENTS_AUDIT.md
check "docs/OPENAI_MODEL_GUIDANCE.md" test -f docs/OPENAI_MODEL_GUIDANCE.md
check "integrations/spec-kit/README.md" test -f integrations/spec-kit/README.md
source_only_check "setup.sh" test -f setup.sh
source_only_check "setup.bat" test -f setup.bat
check ".codex/config.toml" test -f .codex/config.toml
check ".codex/hooks.json" test -f .codex/hooks.json
check ".codex/hooks.json valid JSON" node -e "const h=JSON.parse(require('fs').readFileSync('.codex/hooks.json','utf8')); if(!h.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command) process.exit(1)"
check ".gitignore" test -f .gitignore
check ".gitattributes" test -f .gitattributes
check ".env.example" test -f .env.example
source_only_check ".github/workflows/release-template.yml" test -f .github/workflows/release-template.yml
check "tasks/lessons.md" test -f tasks/lessons.md
check "tasks/current.md" test -f tasks/current.md
check "tasks/goal.md" test -f tasks/goal.md
source_only_check "starter tasks/current.md" test -f templates/project-starter/tasks/current.md
source_only_check "starter tasks/goal.md" test -f templates/project-starter/tasks/goal.md
source_only_check "starter DESIGN.md" test -f templates/project-starter/DESIGN.md
source_only_check "starter design-policy.ignore" test -f templates/project-starter/design-policy.ignore
source_only_check "starter .research-cache.md" test -f templates/project-starter/tasks/.research-cache.md
source_only_check "starter lessons.md" test -f templates/project-starter/tasks/lessons.md
source_only_check "starter tasks/audit/.gitkeep" test -f templates/project-starter/tasks/audit/.gitkeep
source_only_check "starter brain/01-daily/.gitkeep" test -f templates/project-starter/brain/01-daily/.gitkeep
check "scripts/check-drift.sh" test -f scripts/check-drift.sh
check "scripts/downstream-census.sh" test -f scripts/downstream-census.sh
check "scripts/generate-project-spec.sh" test -f scripts/generate-project-spec.sh
check "scripts/task-brief.sh" test -f scripts/task-brief.sh
check "scripts/validate-codex-agents.js" test -f scripts/validate-codex-agents.js
check "scripts/validate-codex-skills.js" test -f scripts/validate-codex-skills.js
check "scripts/validate-agent-sot.js" test -f scripts/validate-agent-sot.js
check "scripts/validate-production-standard.js" test -f scripts/validate-production-standard.js
check "scripts/validate-design-policy.js" test -f scripts/validate-design-policy.js
check "scripts/test-design-policy.js" test -f scripts/test-design-policy.js
check "scripts/validate-spec-kit.js" test -f scripts/validate-spec-kit.js
check "scripts/validate-text-policy.js" test -f scripts/validate-text-policy.js
check "scripts/sync-spec-kit.sh" test -f scripts/sync-spec-kit.sh
check "scripts/init-spec-kit.sh" test -f scripts/init-spec-kit.sh
check "scripts/codex-route-task.js" test -f scripts/codex-route-task.js
check "scripts/test-codex-routing.js" test -f scripts/test-codex-routing.js
check "scripts/test-codex-subagents-live.sh" test -f scripts/test-codex-subagents-live.sh

echo ""
echo "Codex skills:"
check ">=41 Codex skill dirs" bash -c '[ $(ls -d .agents/skills/*/ 2>/dev/null | wc -l) -ge 41 ]'
check "core Codex design skill" test -f .agents/skills/codex-design-workflow/SKILL.md
check "core Codex design review skill" test -f .agents/skills/codex-domain-design-review/SKILL.md
check "core Codex Figma skill" test -f .agents/skills/codex-figma-workflow/SKILL.md
check "core Codex pipeline skill" test -f .agents/skills/codex-pipeline-workflow/SKILL.md
check "core Codex Mermaid board skill" test -f .agents/skills/codex-mermaid-board-workflow/SKILL.md
check "core Codex model guidance skill" test -f .agents/skills/codex-openai-model-guidance/SKILL.md
check "validate-codex-skills" node scripts/validate-codex-skills.js
check "test-codex-routing" node scripts/test-codex-routing.js
check "validate-production-standard" node scripts/validate-production-standard.js
check "test-design-policy" node scripts/test-design-policy.js
check "validate-agent-sot" node scripts/validate-agent-sot.js
check "validate-spec-kit" node scripts/validate-spec-kit.js
check "validate-text-policy" node scripts/validate-text-policy.js
check "validate-text-policy rejects mojibake" validate_text_policy_rejects_mojibake

echo ""
echo "Codex subagents:"
check ">=7 Codex agent files" bash -c '[ $(ls .codex/agents/*.toml 2>/dev/null | wc -l) -ge 7 ]'
check "Codex pr_explorer agent" test -f .codex/agents/pr-explorer.toml
check "Codex reviewer agent" test -f .codex/agents/reviewer.toml
check "Codex implementer agent" test -f .codex/agents/implementer.toml
check "validate-codex-agents" node scripts/validate-codex-agents.js

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
echo "Agent SOT:"
check "_reference/agent-sot/README.md" test -f _reference/agent-sot/README.md
check "_reference/agent-sot/sources.json" test -f _reference/agent-sot/sources.json
check "_reference/agent-sot/top-works.md" test -f _reference/agent-sot/top-works.md
check "local ai-agent spec original" test -f _reference/agent-sot/originals/ai-agent-spec-v3-final.md
check "Agent SOT has >=20 top works" bash -c '[ $(grep -c "^## TW-" _reference/agent-sot/top-works.md) -ge 20 ]'
check "AGENTS links Agent SOT" bash -c "grep -q 'docs/AGENT_CONTEXT_SOT.md' AGENTS.md"
check "CLAUDE links Agent SOT" bash -c "grep -q 'docs/AGENT_CONTEXT_SOT.md' CLAUDE.md"

echo ""
echo "Spec Kit snapshot:"
check "_reference/spec-kit/README.md" test -f _reference/spec-kit/README.md
check "_reference/spec-kit/manifest.json" test -f _reference/spec-kit/manifest.json
check "Spec Kit command templates" test -f _reference/spec-kit/upstream/templates/commands/specify.md
check "Spec Kit plan template" test -f _reference/spec-kit/upstream/templates/plan-template.md
check "Spec Kit bash helper" test -f _reference/spec-kit/upstream/scripts/bash/check-prerequisites.sh
check "Spec Kit PowerShell helper" test -f _reference/spec-kit/upstream/scripts/powershell/check-prerequisites.ps1

echo ""
echo "Brain vault:"
check "brain/00-inbox" test -d brain/00-inbox
check "brain/01-daily" test -d brain/01-daily
check "brain/02-projects" test -d brain/02-projects
check "brain/03-knowledge" test -d brain/03-knowledge
check "brain/04-decisions" test -d brain/04-decisions
source_only_check "starter research/.gitkeep" test -f templates/project-starter/brain/03-knowledge/research/.gitkeep
source_only_check "starter audits/.gitkeep" test -f templates/project-starter/brain/03-knowledge/audits/.gitkeep
check ">=3 brain templates" bash -c '[ $(ls brain/templates/*.md 2>/dev/null | wc -l) -ge 3 ]'

echo ""
echo "File sizes:"
check "CLAUDE.md <=300 lines" bash -c '[ $(wc -l < CLAUDE.md) -le 300 ]'
check "AGENTS.md <=32KB" bash -c '[ $(wc -c < AGENTS.md) -le 32768 ]'

echo ""
echo "Entry points:"
check "README has no start.sh references" bash -c "! grep -q 'start\\.sh' README.md"
check "README has no start.bat references" bash -c "! grep -q 'start\\.bat' README.md"
check "README has no localhost:3333 references" bash -c "! grep -q 'localhost:3333' README.md"
check "README has no Command Center section" bash -c "! grep -q '## Command Center' README.md"
check "SETUP_GUIDE has no legacy --from sync syntax" bash -c "! grep -q 'sync-template\\.sh --from ' SETUP_GUIDE.md"
check "SETUP_GUIDE has no Python 3 bootstrap prerequisite" bash -c "! grep -q 'Python 3' SETUP_GUIDE.md"
check "GitHub workflows use Node24-compatible actions" github_workflows_use_node24_actions
check "No tracked local Claude settings" bash -c '! git ls-files --error-unmatch .claude/settings.local.json >/dev/null 2>&1'
check "Codex config has no user-owned defaults" bash -c "! grep -Eq '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\\s*=' .codex/config.toml"
check "downstream-census --json" bash -c 'bash scripts/downstream-census.sh --no-sync --json "$PWD" 2>/dev/null | node -e "const text=require(\"fs\").readFileSync(0,\"utf8\").trim(); JSON.parse(text || \"[]\")"'
check "generate-project-spec" bash -c 'bash scripts/generate-project-spec.sh | grep -q "^## Identity"'
check "scan-project --report" bash -c 'bash scripts/scan-project.sh --report >/dev/null'
check "task-brief --brief" bash scripts/task-brief.sh --brief
check "task-brief --json" bash -c 'bash scripts/task-brief.sh --json | node -e "JSON.parse(require(\"fs\").readFileSync(0, \"utf8\"))"'
check "codex-route-task template route" bash -c 'node scripts/codex-route-task.js "обнови агентский шаблон и release tag" | node -e "const r=JSON.parse(require(\"fs\").readFileSync(0,\"utf8\")); if(!r.skills.includes(\"codex-template-sync\") || !r.skills.includes(\"codex-health-check\")) process.exit(1)"'
check "route-task fallback includes strategic review" bash -c 'bash scripts/route-task.sh "template release" | grep -q "codex-strategic-review"'

echo ""
echo "Bootstrap trust smoke:"
if is_template_source_repo; then
  SMOKE_SENTINEL="docs/.setup-leak-sentinel-$RANDOM-$$.txt"
  SMOKE_PROJECT="template-leak-smoke-$RANDOM-$$"
  SMOKE_INDEX=""
  cleanup_smoke() {
    rm -f "$SMOKE_SENTINEL"
    [ -n "$SMOKE_INDEX" ] && rm -f "$SMOKE_INDEX"
    rm -rf "$SMOKE_PROJECT" 2>/dev/null || powershell.exe -NoProfile -Command "if (Test-Path '$SMOKE_PROJECT') { Remove-Item -Recurse -Force '$SMOKE_PROJECT' }" >/dev/null 2>&1 || true
  }
  run_setup_payload_smoke() {
    local project="$1"
    local sentinel="$2"

    SMOKE_INDEX="$(_temp_file setup-smoke-index)"
    GIT_INDEX_FILE="$SMOKE_INDEX" git read-tree HEAD
    GIT_INDEX_FILE="$SMOKE_INDEX" git add -A .agents .codex/agents .github/workflows/validate-template.yml _reference/agent-sot _reference/spec-kit integrations/spec-kit docs/AGENT_CONTEXT_SOT.md docs/AGENT_PIPELINES.md docs/CODEX_FANOUT_PATTERNS.md docs/CODEX_SKILLS_AUDIT.md docs/CODEX_SUBAGENTS_AUDIT.md docs/OPENAI_MODEL_GUIDANCE.md docs/TEMPLATE_RELEASES.md .claude/library/product/production-product-standard.md .claude/library/process/product-goal-loop.md .claude/library/domain/domain-design-system.md templates/project-starter/DESIGN.md templates/project-starter/design-policy.ignore templates/project-starter/tasks/goal.md scripts/codex-route-task.js scripts/test-codex-routing.js scripts/test-codex-subagents-live.sh scripts/init-spec-kit.sh scripts/sync-spec-kit.sh scripts/validate-agent-sot.js scripts/validate-spec-kit.js scripts/validate-text-policy.js scripts/validate-codex-agents.js scripts/validate-codex-skills.js scripts/validate-production-standard.js scripts/validate-design-policy.js scripts/test-design-policy.js
    GIT_INDEX_FILE="$SMOKE_INDEX" bash setup.sh "$project" >/dev/null 2>&1

    [ ! -f "$project/$sentinel" ] &&
      [ -f "$project/.agents/skills/codex-design-workflow/SKILL.md" ] &&
      [ -f "$project/.codex/agents/pr-explorer.toml" ] &&
      [ -f "$project/docs/CODEX_FANOUT_PATTERNS.md" ] &&
      [ -f "$project/docs/AGENT_CONTEXT_SOT.md" ] &&
      [ -f "$project/.claude/library/product/production-product-standard.md" ] &&
      [ -f "$project/.claude/library/process/product-goal-loop.md" ] &&
      [ -f "$project/.claude/library/domain/domain-design-system.md" ] &&
      [ -f "$project/DESIGN.md" ] &&
      [ -f "$project/design-policy.ignore" ] &&
      [ -f "$project/tasks/goal.md" ] &&
      node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1]+'/.template-manifest.json','utf8')); if(m.files?.['DESIGN.md']?.category!=='project') process.exit(1)" "$project" &&
      node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1]+'/.template-manifest.json','utf8')); if(m.files?.['design-policy.ignore']?.category!=='project') process.exit(1)" "$project" &&
      [ -f "$project/_reference/agent-sot/sources.json" ] &&
      [ -f "$project/_reference/spec-kit/manifest.json" ] &&
      [ -f "$project/integrations/spec-kit/README.md" ] &&
      [ -f "$project/docs/TEMPLATE_RELEASES.md" ] &&
      [ -f "$project/scripts/codex-route-task.js" ] &&
      [ -f "$project/scripts/test-codex-routing.js" ] &&
      [ -f "$project/scripts/init-spec-kit.sh" ] &&
      [ -f "$project/scripts/sync-spec-kit.sh" ] &&
      [ -f "$project/scripts/validate-agent-sot.js" ] &&
      [ -f "$project/scripts/validate-spec-kit.js" ] &&
      [ -f "$project/scripts/validate-text-policy.js" ] &&
      [ -f "$project/.github/workflows/validate-template.yml" ] &&
      [ ! -f "$project/.github/workflows/release-template.yml" ] &&
      [ -f "$project/scripts/test-codex-subagents-live.sh" ] &&
      [ -f "$project/scripts/validate-codex-agents.js" ] &&
      [ -f "$project/scripts/validate-codex-skills.js" ] &&
      [ -f "$project/scripts/validate-production-standard.js" ]
  }
  trap cleanup_smoke EXIT
  printf 'sentinel\n' > "$SMOKE_SENTINEL"
  check "setup.sh excludes untracked payload sentinel and ships Codex skills" run_setup_payload_smoke "$SMOKE_PROJECT" "$SMOKE_SENTINEL"
  cleanup_smoke
  trap - EXIT
else
  skip "setup.sh bootstrap smoke (template source repo only)"
fi

echo ""
echo "Sync regression smoke:"
if is_template_source_repo; then
  SYNC_TEMPLATE_FIXTURE="template-sync-fixture-$RANDOM-$$"
  SYNC_EMPTY_MANIFEST_PROJECT="template-empty-manifest-smoke-$RANDOM-$$"
  SYNC_EMPTY_MANIFEST_OUTPUT="$SYNC_EMPTY_MANIFEST_PROJECT.out"
  SYNC_SOURCE_ONLY_PROJECT="template-source-only-sync-smoke-$RANDOM-$$"
  SYNC_SOURCE_ONLY_OUTPUT="$SYNC_SOURCE_ONLY_PROJECT.out"
  cleanup_sync_smoke() {
    rm -rf \
      "$SYNC_TEMPLATE_FIXTURE" \
      "$SYNC_EMPTY_MANIFEST_PROJECT" "$SYNC_EMPTY_MANIFEST_OUTPUT" "$SYNC_EMPTY_MANIFEST_OUTPUT.apply" \
      "$SYNC_SOURCE_ONLY_PROJECT" "$SYNC_SOURCE_ONLY_OUTPUT" "$SYNC_SOURCE_ONLY_OUTPUT.apply"
  }
  create_sync_template_fixture() {
    local template="$1"

    mkdir -p \
      "$template/scripts" \
      "$template/docs" \
      "$template/_reference/spec-kit" \
      "$template/templates/project-starter/tasks"

    printf '%s\n' '# Fixture Claude' '<!-- Template Version: 9.9.9 -->' > "$template/CLAUDE.md"
    printf '%s\n' '*.log' > "$template/.gitignore"
    printf '%s\n' '# Agent SOT fixture' > "$template/docs/AGENT_CONTEXT_SOT.md"
    printf '%s\n' '{"ref":"fixture"}' > "$template/_reference/spec-kit/manifest.json"
    cp scripts/sync-template.sh "$template/scripts/sync-template.sh"

    printf '%s\n' '# source-only unix setup fixture' > "$template/setup.sh"
    printf '%s\r\n' '@echo off' 'rem source-only windows setup fixture' > "$template/setup.bat"
    printf '%s\n' '# source-only starter task fixture' > "$template/templates/project-starter/tasks/current.md"
  }
  write_empty_trackable_manifest() {
    local project="$1"
    mkdir -p "$project"
    printf '%s\n' \
      '{' \
      '  "template_version": "unknown",' \
      '  "created": "2000-01-01",' \
      '  "updated": "2000-01-01",' \
      '  "template_remote": "",' \
      '  "files": {' \
      '    "CLAUDE.md": {"category": "project", "hash": "fixture"}' \
      '  }' \
      '}' > "$project/.template-manifest.json"
  }
  write_trackable_manifest() {
    local project="$1"
    local hash

    mkdir -p "$project"
    printf '%s\n' '# Local Claude' '<!-- Template Version: 4.1.1 -->' > "$project/CLAUDE.md"
    hash="$(_get_hash "$project/CLAUDE.md")"
    printf '%s\n' \
      '{' \
      '  "template_version": "4.1.1",' \
      '  "created": "2000-01-01",' \
      '  "updated": "2000-01-01",' \
      '  "template_remote": "",' \
      '  "files": {' \
      "    \"CLAUDE.md\": {\"category\": \"template\", \"hash\": \"$hash\"}" \
      '  }' \
      '}' > "$project/.template-manifest.json"
  }
  run_empty_manifest_sync_smoke() {
    local project="$1"
    local output="$2"

    write_empty_trackable_manifest "$project"

    bash scripts/sync-template.sh "$SYNC_TEMPLATE_FIXTURE" --project-dir "$project" --dry-run > "$output" 2>&1
    grep -q "Manifest has no trackable files" "$output"
    grep -q "WOULD ADD: scripts/sync-template.sh" "$output"
    grep -q "WOULD ADD: CLAUDE.md" "$output"
    grep -q "WOULD ADD: .gitignore" "$output"
    grep -q "WOULD ADD: docs/AGENT_CONTEXT_SOT.md" "$output"
    grep -q "WOULD ADD: _reference/spec-kit/manifest.json" "$output"

    bash scripts/sync-template.sh "$SYNC_TEMPLATE_FIXTURE" --project-dir "$project" > "$output.apply" 2>&1
    grep -q '"CLAUDE.md"' "$project/.template-manifest.json"
    grep -q '"docs/AGENT_CONTEXT_SOT.md"' "$project/.template-manifest.json"
    grep -q '"_reference/spec-kit/manifest.json"' "$project/.template-manifest.json"
    ! grep -q '"templates/' "$project/.template-manifest.json"
    ! grep -q '"setup.sh"' "$project/.template-manifest.json"
    ! grep -q '"setup.bat"' "$project/.template-manifest.json"
  }
  run_source_only_sync_smoke() {
    local project="$1"
    local output="$2"

    write_trackable_manifest "$project"

    bash scripts/sync-template.sh "$SYNC_TEMPLATE_FIXTURE" --project-dir "$project" --dry-run > "$output" 2>&1
    ! grep -q "WOULD ADD: templates/" "$output"
    ! grep -q "WOULD ADD: setup.sh" "$output"
    ! grep -q "WOULD ADD: setup.bat" "$output"

    bash scripts/sync-template.sh "$SYNC_TEMPLATE_FIXTURE" --project-dir "$project" > "$output.apply" 2>&1
    [ ! -e "$project/templates" ] &&
      [ ! -f "$project/setup.sh" ] &&
      [ ! -f "$project/setup.bat" ] &&
      ! grep -q '"templates/' "$project/.template-manifest.json" &&
      ! grep -q '"setup.sh"' "$project/.template-manifest.json" &&
      ! grep -q '"setup.bat"' "$project/.template-manifest.json"
  }
  trap cleanup_sync_smoke EXIT
  create_sync_template_fixture "$SYNC_TEMPLATE_FIXTURE"
  check "sync-template dry-run handles empty trackable manifest" run_empty_manifest_sync_smoke "$SYNC_EMPTY_MANIFEST_PROJECT" "$SYNC_EMPTY_MANIFEST_OUTPUT"
  check "sync-template keeps source-only files out of generated projects" run_source_only_sync_smoke "$SYNC_SOURCE_ONLY_PROJECT" "$SYNC_SOURCE_ONLY_OUTPUT"
  cleanup_sync_smoke
  trap - EXIT
else
  skip "sync-template empty-manifest smoke (template source repo only)"
fi

echo ""
echo "Results: $((CHECKS-ERRORS))/$CHECKS passed"
if [ $ERRORS -eq 0 ]; then
    echo "Template is healthy!"
    exit 0
else
    echo "$ERRORS check(s) failed"
    exit 1
fi
