#!/bin/bash
# validate-template.sh — Pre-release validation for agent-project-template
# Checks: version consistency, file existence, syntax, portability, trust hardening
# Usage: bash scripts/validate-template.sh

set -euo pipefail

ERRORS=0
WARNINGS=0

echo "=== Template Validation ==="
echo ""

# 1. Version consistency
echo "[1/11] Checking version consistency..."
CLAUDE_VER=$(sed -n 's/.*Template Version: \([0-9.]*\).*/\1/p' CLAUDE.md 2>/dev/null || echo "MISSING")
DRIFT_VER=$(sed -n 's/.*TEMPLATE_VERSION="\([^"]*\)".*/\1/p' scripts/check-drift.sh 2>/dev/null || echo "MISSING")
README_VER=$(sed -n 's/.*template-v\([0-9.]*\).*/\1/p' README.md 2>/dev/null || echo "MISSING")

if [ "$CLAUDE_VER" = "$DRIFT_VER" ]; then
  echo "  OK: CLAUDE.md ($CLAUDE_VER) = check-drift.sh ($DRIFT_VER)"
else
  echo "  ERROR: CLAUDE.md ($CLAUDE_VER) != check-drift.sh ($DRIFT_VER)"
  ERRORS=$((ERRORS + 1))
fi

if [ "$CLAUDE_VER" = "$README_VER" ]; then
  echo "  OK: CLAUDE.md ($CLAUDE_VER) = README.md ($README_VER)"
else
  echo "  WARNING: CLAUDE.md ($CLAUDE_VER) != README.md ($README_VER)"
  WARNINGS=$((WARNINGS + 1))
fi

# 2. Agent frontmatter
echo ""
echo "[2/11] Checking agent frontmatter..."
for agent in .claude/agents/*.md; do
  [ -f "$agent" ] || continue
  if [ "$(basename "$agent")" = "PROTOCOL.md" ]; then
    continue
  fi
  first=$(head -1 "$agent")
  if [ "$first" != "---" ]; then
    echo "  ERROR: $agent missing frontmatter"
    ERRORS=$((ERRORS + 1))
    continue
  fi
  has_name=$(head -10 "$agent" | grep -c "^name:" 2>/dev/null) || has_name=0
  has_model=$(head -10 "$agent" | grep -c "^model:" 2>/dev/null) || has_model=0
  if [ "$has_name" -eq 0 ]; then
    echo "  ERROR: $agent missing name field"
    ERRORS=$((ERRORS + 1))
  fi
  if [ "$has_model" -eq 0 ]; then
    echo "  ERROR: $agent missing model field"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  Checked $(ls .claude/agents/*.md 2>/dev/null | wc -l | tr -d ' ') agents"

# 3. Skill files exist
echo ""
echo "[3/11] Checking skills..."
SKILL_COUNT=0
for skill_dir in .claude/skills/*/; do
  [ -d "$skill_dir" ] || continue
  if [ ! -f "${skill_dir}SKILL.md" ]; then
    echo "  ERROR: $skill_dir missing SKILL.md"
    ERRORS=$((ERRORS + 1))
  fi
  SKILL_COUNT=$((SKILL_COUNT + 1))
done
echo "  Found $SKILL_COUNT skills"

# 4. Script syntax
echo ""
echo "[4/11] Checking script syntax..."
for script in scripts/*.sh scripts/lib/*.sh .claude/hooks/*.sh; do
  [ -f "$script" ] || continue
  if ! bash -n "$script" 2>/dev/null; then
    echo "  ERROR: $script has syntax errors"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  All scripts pass syntax check"

# 5. Required files exist
echo ""
echo "[5/11] Checking required files..."
REQUIRED_FILES=(
  "CLAUDE.md"
  "README.md"
  "PROJECT_SPEC.md"
  "ecosystem.md"
  "docs/MIGRATION_MATRIX.md"
  "docs/PRODUCT_BOUNDARY.md"
  "docs/RELEASE_CHECKLIST.md"
  "docs/SAFE_DEFAULTS.md"
  "docs/SUPPORTED_ENVIRONMENTS.md"
  "_reference/README.md"
  "_reference/tool-registry.md"
  ".claude/settings.json"
  "tasks/lessons.md"
  "tasks/current.md"
  "tasks/.research-cache.md"
  "tasks/post-mortems/TEMPLATE.md"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "  ERROR: Missing required file: $f"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  Checked ${#REQUIRED_FILES[@]} required files"

# 6. Cross-platform safety: no bare python3, no <<<
echo ""
echo "[6/11] Checking cross-platform safety..."
# Direct python/python3 calls (should use _node or node)
BARE_PY=$(grep -rn "python3\? -[cm]" scripts/*.sh .claude/hooks/*.sh 2>/dev/null | grep -v "command -v" | grep -v "^#" | grep -v "platform.sh" || true)
if [ -n "$BARE_PY" ]; then
  echo "  ERROR: Python calls found (should use node/_node instead):"
  echo "$BARE_PY" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No Python calls (using Node.js)"
fi
# grep -P (Perl regex, not portable)
GREP_P=$(grep -rn "grep -[a-zA-Z]*P" scripts/*.sh .claude/hooks/*.sh setup.sh 2>/dev/null | grep -v "^scripts/validate-template.sh:" || true)
if [ -n "$GREP_P" ]; then
  echo "  ERROR: grep -P (Perl regex) found (not portable, use sed):"
  echo "$GREP_P" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No grep -P"
fi
# Here-strings (don't work on all Windows bash)
HERESTR=$(grep -rn "<<<" scripts/*.sh .claude/hooks/*.sh 2>/dev/null | grep -v "^scripts/validate-template.sh:" || true)
if [ -n "$HERESTR" ]; then
  echo "  ERROR: Here-strings (<<<) found (use pipe or process substitution):"
  echo "$HERESTR" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No here-strings"
fi

# 7. Library structure + MCP server
echo ""
echo "[7/11] Checking library structure..."
if [ -d ".claude/library" ]; then
  LIB_COUNT=$(find .claude/library -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "  OK: .claude/library/ has $LIB_COUNT rule files"
  for subdir in process technical meta domain conflict; do
    if [ ! -d ".claude/library/$subdir" ]; then
      echo "  WARNING: .claude/library/$subdir/ missing"
      WARNINGS=$((WARNINGS + 1))
    fi
  done
else
  echo "  ERROR: .claude/library/ not found"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "[8/11] Checking MCP server..."
if [ -f "mcp-servers/context-router/package.json" ]; then
  echo "  OK: context-router package.json exists"
  if [ -f "mcp-servers/context-router/src/index.ts" ]; then
    echo "  OK: context-router src/index.ts exists"
  else
    echo "  ERROR: context-router src/index.ts missing"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  WARNING: No MCP context-router (fallback to bash scripts)"
  WARNINGS=$((WARNINGS + 1))
fi

# 9. Counts
echo ""
echo "[9/11] Checking counts..."
CMD_COUNT=$(ls .claude/commands/*.md 2>/dev/null | wc -l | tr -d ' ')
AGENT_COUNT=$(ls .claude/agents/*.md 2>/dev/null | wc -l | tr -d ' ')
RULE_COUNT=$(ls .claude/rules/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "  Commands: $CMD_COUNT"
echo "  Agents: $AGENT_COUNT"
echo "  Rules: $RULE_COUNT"
echo "  Skills: $SKILL_COUNT"

# 10. Platform lib
echo ""
echo "[10/11] Checking platform.sh..."
if [ -f "scripts/lib/platform.sh" ]; then
  bash -n scripts/lib/platform.sh 2>/dev/null && echo "  OK: platform.sh valid" || { echo "  ERROR: platform.sh syntax error"; ERRORS=$((ERRORS + 1)); }
else
  echo "  ERROR: scripts/lib/platform.sh missing"
  ERRORS=$((ERRORS + 1))
fi

# 11. Trust hardening
echo ""
echo "[11/11] Checking trust hardening..."

if git ls-files --error-unmatch .claude/settings.local.json >/dev/null 2>&1; then
  echo "  ERROR: .claude/settings.local.json is tracked but must stay local-only"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No tracked project-local Claude settings"
fi

if grep -Eq '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\s*=' .codex/config.toml 2>/dev/null; then
  echo "  ERROR: .codex/config.toml contains user/IDE-owned defaults"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: .codex/config.toml keeps only project-specific Codex settings"
fi

TRACKED_ARTIFACTS=$(git ls-files "mcp-servers/*/node_modules/*" "mcp-servers/*/dist/*" "docs/.ci-untracked-sentinel.txt" "docs/.setup-leak-sentinel*" 2>/dev/null || true)
if [ -n "$TRACKED_ARTIFACTS" ]; then
  echo "  ERROR: Generated or local-only artifacts are tracked:"
  echo "$TRACKED_ARTIFACTS" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No tracked dependency/cache artifacts in shipped roots"
fi

USER_NAME="$(basename "${HOME:-}")"
ABSOLUTE_PATH_MATCHES=""
for pattern in \
  "${HOME:-}" \
  "${PWD:-}" \
  "C:/Users/$USER_NAME" \
  "C:\\\\Users\\\\$USER_NAME" \
  "/Users/$USER_NAME" \
  "/home/$USER_NAME"
do
  [ -n "$pattern" ] || continue
  MATCHES=$(git grep -n -I -F "$pattern" -- . ':(exclude).git' 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    ABSOLUTE_PATH_MATCHES="${ABSOLUTE_PATH_MATCHES}${MATCHES}"$'\n'
  fi
done

if [ -n "$ABSOLUTE_PATH_MATCHES" ]; then
  echo "  ERROR: Personal machine paths leaked into tracked files:"
  printf '%s' "$ABSOLUTE_PATH_MATCHES" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No personal machine paths in tracked files"
fi

# Summary
echo ""
echo "=== Validation Summary ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: Fix $ERRORS error(s) before release."
  exit 1
else
  echo "PASS: Template is ready for release."
  exit 0
fi
