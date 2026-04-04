#!/bin/bash
# Drift Detection Script (v2)
# Run before major sessions or weekly to catch stale docs and violations
# Usage: bash scripts/check-drift.sh

# shellcheck source=lib/platform.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/lib/platform.sh" ] && source "$SCRIPT_DIR/lib/platform.sh"
if [ -z "${PYTHON:-}" ]; then
  if command -v python3 &>/dev/null; then PYTHON="python3"
  elif command -v python &>/dev/null; then PYTHON="python"
  else PYTHON=""; fi
fi

# Template version check
TEMPLATE_VERSION="3.1.0"
CLAUDE_VERSION=$(grep -oP '(?<=Template Version: )[\d.]+' CLAUDE.md 2>/dev/null || echo "unknown")
if [ "$CLAUDE_VERSION" = "unknown" ]; then
    echo "INFO: Template version not found in CLAUDE.md"
elif [ "$CLAUDE_VERSION" != "$TEMPLATE_VERSION" ]; then
    echo "WARNING: Template version mismatch. CLAUDE.md=$CLAUDE_VERSION, script expects=$TEMPLATE_VERSION"
fi

echo "=== Drift Detection ==="
echo ""
WARNINGS=0
ERRORS=0

# 1. Check if docs are stale (>30 days)
echo "[1/10] Checking document freshness..."
if [ -d docs ]; then
  for doc in docs/*.md; do
    [ -f "$doc" ] || continue
    if [ "$(uname)" = "Darwin" ]; then
      age=$(( ($(date +%s) - $(stat -f %m "$doc")) / 86400 ))
    else
      age=$(( ($(date +%s) - $(stat -c %Y "$doc" 2>/dev/null || echo $(date +%s))) / 86400 ))
    fi
    if [ "$age" -gt 30 ]; then
      echo "  ⚠️  $doc not updated in $age days"
      WARNINGS=$((WARNINGS + 1))
    fi
  done
fi

if [ -d src ] && [ -d docs ]; then
    echo "Checking src/ vs docs/ freshness..."
    # Check if src has files newer than docs (simplified check)
    newest_src=$(find src -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" 2>/dev/null | head -1)
    if [ -n "$newest_src" ] && [ -d docs ]; then
        echo "  INFO: Remember to update docs/ when src/ changes significantly"
    fi
fi

# 2. Check CLAUDE.md size
echo "[2/10] Checking CLAUDE.md size..."
if [ -f CLAUDE.md ]; then
  lines=$(wc -l < CLAUDE.md)
  if [ "$lines" -gt 300 ]; then
    echo "  ⚠️  CLAUDE.md: $lines lines (limit 300)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✅ CLAUDE.md: $lines lines (OK)"
  fi
fi

# 3. Check lessons.md size (>50 = time to promote)
echo "[3/10] Checking lessons.md..."
if [ -f tasks/lessons.md ]; then
  entries=$(grep -c "^### " tasks/lessons.md 2>/dev/null || echo 0)
  if [ "$entries" -gt 50 ]; then
    echo "  ⚠️  tasks/lessons.md has $entries entries — run /weekly to promote"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✅ tasks/lessons.md: $entries entries"
  fi
fi

# 4. Check for files > 375 lines in src/
echo "[4/10] Checking file sizes in src/..."
if [ -d src ]; then
  find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.rs" -o -name "*.go" -o -name "*.js" -o -name "*.jsx" \) | while read -r file; do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt 375 ]; then
      echo "  ⚠️  $file: $lines lines (limit 375)"
    fi
  done
fi

# 5. Check module entry points exist
echo "[5/10] Checking module entry points..."
if [ -d src/features ]; then
  find src/features -mindepth 1 -maxdepth 1 -type d | while read -r dir; do
    found=0
    for entry in "$dir"/index.* "$dir"/__init__.py "$dir"/mod.rs; do
      [ -f "$entry" ] && found=1 && break
    done
    if [ "$found" -eq 0 ]; then
      echo "  ❌ Missing entry point: $dir"
    fi
  done
fi

# 6. Check architecture boundaries
echo "[6/10] Checking architecture boundaries..."
if command -v npx &> /dev/null && [ -f .dependency-cruiser.js ]; then
  npx dependency-cruiser src --output-type err 2>/dev/null || echo "  ⚠️  Boundary violations detected"
else
  echo "  ℹ️  dependency-cruiser not configured (optional)"
fi

# 7. Check for secrets in tracked files
echo "[7/10] Scanning for potential secrets..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  secrets=$(grep -rlE '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|-----BEGIN.*(RSA|EC|DSA))' src/ 2>/dev/null || true)
  if [ -n "$secrets" ]; then
    echo "  ❌ Potential secrets found in: $secrets"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ No secrets detected"
  fi
fi

# 8. Check template manifest integrity
echo "[8/10] Checking template manifest..."
MANIFEST=".template-manifest.json"
if [ -f "$MANIFEST" ]; then
  # Validate JSON
  if $PYTHON -m json.tool "$MANIFEST" > /dev/null 2>&1; then
    echo "  ✅ $MANIFEST: valid JSON"
  else
    echo "  ❌ $MANIFEST: invalid JSON"
    ERRORS=$((ERRORS + 1))
  fi

  # Report template version
  tpl_ver=$($PYTHON -c "import json; print(json.load(open('$MANIFEST')).get('template_version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "  Template version (manifest): $tpl_ver"

  # Count drifted template files
  drift_count=0
  drift_total=0

  # Cross-platform SHA-256
  _get_hash() {
    if command -v sha256sum &>/dev/null; then
      sha256sum "$1" | cut -d' ' -f1
    elif command -v shasum &>/dev/null; then
      shasum -a 256 "$1" | cut -d' ' -f1
    else
      certutil -hashfile "$1" SHA256 2>/dev/null | sed -n '2p' | tr -d ' ' | tr 'A-F' 'a-f'
    fi
  }

  while IFS='|' read -r fpath expected_hash; do
    [ -z "$fpath" ] && continue
    drift_total=$((drift_total + 1))
    if [ -f "$fpath" ]; then
      actual_hash=$(_get_hash "$fpath")
      if [ "$actual_hash" != "$expected_hash" ]; then
        drift_count=$((drift_count + 1))
      fi
    else
      drift_count=$((drift_count + 1))
    fi
  done < <($PYTHON -c "
import json
m = json.load(open('$MANIFEST'))
for path, info in m.get('files', {}).items():
    if info.get('category') != 'project':
        print(f\"{path}|{info.get('hash', '')}\")
" 2>/dev/null)

  if [ "$drift_count" -gt 0 ]; then
    echo "  ⚠️  $drift_count/$drift_total template files have drifted from manifest hashes"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✅ All $drift_total template files match manifest hashes"
  fi
else
  echo "  ℹ️  No $MANIFEST found (sync not configured)"
fi

# 9. Check template rules not modified locally (read-only enforcement)
echo "[9/10] Checking template rules integrity..."
if [ -f "$MANIFEST" ]; then
  RULE_DRIFT=0
  for rule_file in .claude/rules/*.md .claude/library/*/*.md .claude/agents/*.md; do
    [ -f "$rule_file" ] || continue
    # Skip project-* files (those ARE meant to be local)
    basename_f=$(basename "$rule_file")
    case "$basename_f" in project-*) continue ;; esac
    # Check if file is in manifest and hash matches
    EXPECTED_HASH=$($PYTHON -c "
import json, os
m = json.load(open('$MANIFEST'))
info = m.get('files', {}).get('$rule_file', {})
print(info.get('hash', ''))
" 2>/dev/null || echo "")
    if [ -n "$EXPECTED_HASH" ]; then
      ACTUAL_HASH=$(_get_hash "$rule_file")
      if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
        echo "  ⚠️  $rule_file modified locally (template file — should be read-only)"
        RULE_DRIFT=$((RULE_DRIFT + 1))
      fi
    fi
  done
  if [ "$RULE_DRIFT" -gt 0 ]; then
    echo "  ⚠️  $RULE_DRIFT template rule(s) modified locally. Run /update-template to restore."
    WARNINGS=$((WARNINGS + RULE_DRIFT))
  else
    echo "  ✅ All template rules/agents match manifest"
  fi
else
  echo "  ℹ️  No manifest — cannot check rule integrity"
fi

# 10. Check tool registry health
echo "[10/10] Checking tool registry..."
REGISTRY="_reference/tool-registry.md"
if [ -f "$REGISTRY" ]; then
  # Check for stale entries (referenced paths that don't exist)
  STALE_TOOLS=0
  while IFS='|' read -r _ _ path _; do
    path=$(echo "$path" | xargs 2>/dev/null)
    [ -z "$path" ] && continue
    [ "$path" = "Path" ] && continue
    [ "$path" = "Signature" ] && continue
    [[ "$path" == _* ]] && continue
    if [ ! -e "$path" ]; then
      STALE_TOOLS=$((STALE_TOOLS + 1))
    fi
  done < <(grep "^|" "$REGISTRY" 2>/dev/null)

  if [ "$STALE_TOOLS" -gt 0 ]; then
    echo "  ⚠️  $STALE_TOOLS stale entries in tool registry (files deleted). Run: bash scripts/audit-reuse.sh"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✅ Tool registry: no stale entries"
  fi

  # Check if registry is too empty for a project with src/
  if [ -d src ]; then
    ENTRIES=$(grep -cE "^\| [^_|]" "$REGISTRY" 2>/dev/null || echo 0)
    if [ "$ENTRIES" -lt 8 ]; then
      echo "  ⚠️  Tool registry has only $ENTRIES entries. Run: bash scripts/scan-project.sh"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
else
  if [ -d src ]; then
    echo "  ⚠️  No tool registry found. Run: bash scripts/scan-project.sh"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ℹ️  No tool registry (no src/ directory)"
  fi
fi

echo ""
echo "=== Summary: $WARNINGS warnings, $ERRORS errors ==="
[ "$ERRORS" -gt 0 ] && echo "❌ Fix errors before proceeding" && exit 1
echo "✅ Done"
