#!/usr/bin/env bash
# sync-template.sh — Sync project with newer template version
# Usage: ./scripts/sync-template.sh /path/to/agent-project-template [--dry-run] [--force]
#
# Template files (in manifest) are ALWAYS updated from the new template.
# Project files (project-* prefix, not in manifest) are NEVER touched.
# See .template-manifest.json for the file registry.

set -euo pipefail

# --- Platform helpers ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/lib/platform.sh" ] && source "$SCRIPT_DIR/lib/platform.sh"
# Fallback python detection if platform.sh not available
if [ -z "${PYTHON:-}" ]; then
  if command -v "$PYTHON" &>/dev/null; then PYTHON="python3"
  elif command -v python &>/dev/null; then PYTHON="python"
  else PYTHON=""; fi
fi

# --- Config ---
TEMPLATE_PATH=""
DRY_RUN=false
FORCE=false
FROM_GIT=false
BOOTSTRAP=false

# --- Parse args ---
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force) FORCE=true ;;
    --from-git) FROM_GIT=true ;;
    --bootstrap) BOOTSTRAP=true ;;
    --help|-h)
      echo "Usage: $0 [/path/to/template] [--dry-run] [--force] [--from-git] [--bootstrap]"
      echo ""
      echo "Syncs this project with a newer version of agent-project-template."
      echo "Template files (tracked in .template-manifest.json) are updated."
      echo "Project files (project-* prefix) are preserved."
      echo ""
      echo "Options:"
      echo "  --dry-run    Show what would change without modifying files"
      echo "  --force      Skip backup step"
      echo "  --from-git   Fetch template from the 'template' git remote instead of a local path"
      echo "  --bootstrap  Generate .template-manifest.json for a project created before sync support"
      exit 0
      ;;
    *) TEMPLATE_PATH="$arg" ;;
  esac
done

# --- Git-based update mode ---
if [ "$FROM_GIT" = true ]; then
    # Check if 'template' remote exists
    TEMPLATE_REMOTE=$(git remote get-url template 2>/dev/null || true)
    if [ -z "$TEMPLATE_REMOTE" ]; then
        # Try reading from manifest
        MANIFEST_PATH=".template-manifest.json"
        TEMPLATE_REMOTE=$(MANIFEST_PATH="$MANIFEST_PATH" $PYTHON -c "import json,os; print(json.load(open(os.environ['MANIFEST_PATH'])).get('template_remote',''))" 2>/dev/null || true)
        if [ -n "$TEMPLATE_REMOTE" ]; then
            git remote add template "$TEMPLATE_REMOTE" 2>/dev/null || true
        fi
    fi

    if [ -z "$TEMPLATE_REMOTE" ]; then
        echo "Error: No template remote configured. Add with: git remote add template <URL>"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "Would fetch from: $TEMPLATE_REMOTE"
        echo "Run without --dry-run to actually fetch and sync."
        exit 0
    fi

    # actual fetch only happens when not dry-run
    echo "Fetching template updates from $TEMPLATE_REMOTE..."
    git fetch template --depth 1 2>/dev/null || { echo "Error: Cannot reach template remote: $TEMPLATE_REMOTE"; exit 1; }

    # Create temp directory with latest template
    TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'template-sync')
    if [ ! -d "$TEMP_DIR" ]; then
        TEMP_DIR="${TMPDIR:-/tmp}/template-sync-$$"
        mkdir -p "$TEMP_DIR"
    fi

    # Detect which branch exists on the remote
    TEMPLATE_BRANCH=""
    for branch in main master; do
        if git rev-parse --verify "template/$branch" &>/dev/null; then
            TEMPLATE_BRANCH="$branch"
            break
        fi
    done

    if [ -z "$TEMPLATE_BRANCH" ]; then
        echo "Error: No main or master branch found on template remote."
        echo "Available branches: $(git branch -r | grep template/ | tr '\n' ' ')"
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    git archive "template/$TEMPLATE_BRANCH" | tar -x -C "$TEMP_DIR" 2>/dev/null || \
    { echo "Error: Cannot extract template branch."; rm -rf "$TEMP_DIR"; exit 1; }

    # Now use TEMP_DIR as TEMPLATE_PATH and continue with normal sync
    TEMPLATE_PATH="$TEMP_DIR"
    cleanup_dir="$TEMP_DIR"
    trap 'rm -rf -- "$cleanup_dir"' EXIT
    echo "Template fetched to temp directory. Proceeding with sync..."
fi

# --- L1: Dependency check ---
if [ -z "$PYTHON" ]; then
    echo "Error: Python is required for sync. Neither python3 nor python found."
    exit 1
fi

# --- Cross-platform SHA-256 ---
get_hash() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    # Windows Git Bash fallback
    certutil -hashfile "$1" SHA256 2>/dev/null | sed -n '2p' | tr -d ' ' | tr 'A-F' 'a-f'
  fi
}

# --- Validation ---
if [ -z "$TEMPLATE_PATH" ]; then
  echo "Error: Template path required. Run with --help for usage."
  exit 1
fi

if [ ! -f "$TEMPLATE_PATH/CLAUDE.md" ]; then
  echo "Error: $TEMPLATE_PATH does not look like an agent-project-template (no CLAUDE.md)"
  exit 1
fi

# --- Read manifest ---
MANIFEST=".template-manifest.json"

# Fix Windows backslash paths in manifest
if grep -q '\\\\' .template-manifest.json 2>/dev/null; then
  echo "Fixing Windows backslash paths in manifest..."
  if command -v _sed_i &>/dev/null; then
    _sed_i 's/\\\\/\//g' .template-manifest.json
  else
    sed -i 's/\\\\/\//g' .template-manifest.json 2>/dev/null || sed -i '' 's/\\\\/\//g' .template-manifest.json
  fi
fi

# Warn if manifest version is unknown
manifest_ver=$($PYTHON -c "import json; print(json.load(open('.template-manifest.json')).get('template_version','unknown'))" 2>/dev/null || echo "unknown")
if [ "$manifest_ver" = "unknown" ] || [ -z "$manifest_ver" ]; then
  echo "WARNING: Manifest version is '$manifest_ver'. Will be updated after sync."
fi

if [ ! -f "$MANIFEST" ]; then
  if [ "$BOOTSTRAP" = true ]; then
    echo "=== Bootstrap: Generating $MANIFEST for existing project ==="
    echo "Scanning project files and computing hashes..."

    # Determine category for a file path
    get_category() {
      case "$1" in
        CLAUDE.md|tasks/*|brain/*) echo "project" ;;
        .gitignore|.vscode/*) echo "hybrid" ;;
        *) echo "template" ;;
      esac
    }

    # Build manifest from current project state
    echo '{' > "$MANIFEST"
    echo '  "template_version": "unknown",' >> "$MANIFEST"
    echo "  \"created\": \"$(date +%Y-%m-%d)\"," >> "$MANIFEST"
    echo "  \"updated\": \"$(date +%Y-%m-%d)\"," >> "$MANIFEST"

    # Detect template remote if exists
    TMPL_REMOTE=$(git remote get-url template 2>/dev/null || echo "")
    echo "  \"template_remote\": \"$TMPL_REMOTE\"," >> "$MANIFEST"
    echo '  "files": {' >> "$MANIFEST"

    first=true
    for pattern in \
      ".claude/settings.json" \
      ".claude/rules/*.md" \
      ".claude/library/process/*.md" \
      ".claude/library/technical/*.md" \
      ".claude/library/meta/*.md" \
      ".claude/library/domain/*.md" \
      ".claude/library/conflict/*.md" \
      ".claude/agents/*.md" \
      ".claude/skills/*/SKILL.md" \
      ".claude/commands/*.md" \
      ".claude/hooks/*.sh" \
      ".claude/pipelines/*.md" \
      "scripts/*.sh" "scripts/lib/*.sh" \
      "mcp-servers/context-router/src/*.ts" \
      "mcp-servers/context-router/package.json" \
      "mcp-servers/context-router/tsconfig.json" \
      "tests/rules/*.test.md" \
      ".editorconfig" "Makefile" "SECURITY.md" "CONTRIBUTING.md" \
      "_reference/tool-registry.md" "_reference/README.md" \
      ".mcp.json" "CLAUDE.md" ".gitignore" ".vscode/extensions.json"; do
      for f in $pattern; do
        [ -f "$f" ] || continue
        # Skip project-* files (agent-created)
        basename_f=$(basename "$f")
        case "$basename_f" in project-*) continue ;; esac

        hash=$(get_hash "$f")
        cat=$(get_category "$f")
        $first || echo ',' >> "$MANIFEST"
        printf '    "%s": {"category": "%s", "hash": "%s"}' "$f" "$cat" "$hash" >> "$MANIFEST"
        first=false
      done
    done

    echo '' >> "$MANIFEST"
    echo '  }' >> "$MANIFEST"
    echo '}' >> "$MANIFEST"

    echo "Generated $MANIFEST with $(grep -c '"hash"' "$MANIFEST") files."
    echo ""
    echo "Now run again WITHOUT --bootstrap to sync:"
    echo "  $0 $TEMPLATE_PATH"
    exit 0
  else
    echo "ERROR: No $MANIFEST found. This project was created before sync support."
    echo ""
    echo "To bootstrap (one-time setup):"
    echo "  1. Copy this script to your project:  cp /path/to/template/scripts/sync-template.sh scripts/"
    echo "  2. Generate manifest:                  bash scripts/sync-template.sh /path/to/template --bootstrap"
    echo "  3. Sync:                               bash scripts/sync-template.sh /path/to/template"
    echo ""
    echo "Or with git remote:"
    echo "  1. git remote add template https://github.com/Yokhan/agent-project-template.git"
    echo "  2. bash scripts/sync-template.sh --from-git --bootstrap"
    echo "  3. bash scripts/sync-template.sh --from-git"
    exit 1
  fi
fi

# Get current and new template versions (C1: use env vars for Python)
CURRENT_VER=$(MANIFEST_PATH="$MANIFEST" $PYTHON -c "
import json, os
print(json.load(open(os.environ['MANIFEST_PATH']))['template_version'])
" 2>/dev/null || echo "unknown")
NEW_VER=$(sed -n 's/.*Template Version: \([0-9.]*\).*/\1/p' "$TEMPLATE_PATH/CLAUDE.md" 2>/dev/null || echo "unknown")

echo "=== Template Sync ==="
echo "Current: $CURRENT_VER → New: $NEW_VER"
echo ""

# --- Backup ---
if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    # Stash if dirty
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      echo "Stashing uncommitted changes..."
      git stash push -m "pre-sync backup $(date +%Y%m%d-%H%M%S)"
    fi
    # Tag for rollback (M3: add seconds)
    git tag "backup/pre-sync-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
    echo "Backup tag created."
  fi
fi

# --- Counters ---
UPDATED=0; SKIPPED=0; NEW_FILES=0; PRESERVED=0; DEPRECATED=0

# --- Phase A: Update template files in manifest ---
echo "--- Phase A: Updating template files ---"

# Read manifest files using python (portable JSON parsing)
# M1: Don't suppress manifest parsing errors
manifest_files=$(MANIFEST_PATH="$MANIFEST" $PYTHON -c "
import json, os
m = json.load(open(os.environ['MANIFEST_PATH']))
for path, info in m.get('files', {}).items():
    if info.get('category') != 'project':
        print(f\"{path}|{info.get('hash', '')}|{info.get('category', 'template')}\")
" 2>&1)
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to parse $MANIFEST: $manifest_files"
    exit 1
fi

# L2: Validate manifest structure
if [ -z "$manifest_files" ]; then
    echo "WARNING: Manifest has no trackable files. Is .template-manifest.json valid?"
fi

while IFS='|' read -r filepath old_hash category; do
  [ -z "$filepath" ] && continue

  # Skip project-local files
  case "$filepath" in
    .claude/settings.local.json|core/*)
      SKIPPED=$((SKIPPED + 1))
      continue
      ;;
  esac

  template_file="$TEMPLATE_PATH/$filepath"

  if [ ! -f "$template_file" ]; then
    # File removed from template
    echo "  DEPRECATED: $filepath (removed from template, kept locally)"
    DEPRECATED=$((DEPRECATED + 1))
    continue
  fi

  new_hash=$(get_hash "$template_file")

  if [ "$new_hash" = "$old_hash" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Check if local file was modified (conflict detection)
  local_hash=""
  CONFLICTS=${CONFLICTS:-0}
  if [ -f "$filepath" ]; then
    local_hash=$(get_hash "$filepath")
  fi

  if [ -n "$local_hash" ] && [ "$local_hash" != "$old_hash" ] && [ "$FORCE" = false ]; then
    # File modified BOTH locally AND in template = CONFLICT
    if [ "$DRY_RUN" = true ]; then
      diff_info=$(diff --stat "$filepath" "$template_file" 2>/dev/null | tail -1 || echo "cannot diff")
      echo "  CONFLICT: $filepath (modified locally AND in template) — $diff_info"
    else
      # Save template version alongside, don't overwrite
      cp "$template_file" "${filepath}.template-new"
      echo "  CONFLICT: $filepath — local changes detected. Template version saved as ${filepath}.template-new"
      echo "    Review: diff $filepath ${filepath}.template-new"
    fi
    CONFLICTS=$((CONFLICTS + 1))
    continue
  fi

  if [ "$DRY_RUN" = true ]; then
    diff_info=""
    if [ -f "$filepath" ]; then
      diff_info=$(diff --stat "$filepath" "$template_file" 2>/dev/null | tail -1 || echo "")
      [ -n "$diff_info" ] && diff_info=" — $diff_info"
    fi
    echo "  WOULD UPDATE: $filepath$diff_info"
  else
    # Ensure parent directory exists
    mkdir -p "$(dirname "$filepath")"
    cp "$template_file" "$filepath"
    echo "  UPDATED: $filepath"
  fi
  UPDATED=$((UPDATED + 1))
done < <(echo "$manifest_files")

# --- Phase B: Detect new files in template ---
echo "--- Phase B: Checking for new template files ---"

# Define template file patterns to check
for pattern in ".claude/settings.json" ".claude/rules/*.md" ".claude/library/process/*.md" ".claude/library/technical/*.md" ".claude/library/meta/*.md" ".claude/library/domain/*.md" ".claude/library/conflict/*.md" ".claude/agents/*.md" ".claude/skills/*/SKILL.md" ".claude/commands/*.md" ".claude/hooks/*.sh" ".claude/pipelines/*.md" "scripts/*.sh" "scripts/lib/*.sh" "mcp-servers/context-router/src/*.ts" "mcp-servers/context-router/package.json" "tests/rules/*.test.md" "_reference/*.md" ".mcp.json" ".editorconfig" "Makefile" "SECURITY.md" "CONTRIBUTING.md"; do
  # H1: Quote the template path in glob expansion
  for template_file in "$TEMPLATE_PATH"/$pattern; do
    [ -f "$template_file" ] || continue
    # Get relative path
    rel_path="${template_file#$TEMPLATE_PATH/}"

    # Skip project-local files
    case "$rel_path" in
      .claude/settings.local.json|core/*)
        continue
        ;;
    esac

    # Check if already in manifest (C1: use env vars for Python)
    in_manifest=$(MANIFEST_PATH="$MANIFEST" REL_PATH="$rel_path" $PYTHON -c "
import json, os
m = json.load(open(os.environ['MANIFEST_PATH']))
print('yes' if os.environ['REL_PATH'] in m.get('files', {}) else 'no')
" 2>/dev/null)

    if [ "$in_manifest" = "no" ] && [ ! -f "$rel_path" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "  WOULD ADD: $rel_path (new in template)"
      else
        mkdir -p "$(dirname "$rel_path")"
        cp "$template_file" "$rel_path"
        echo "  NEW: $rel_path"
      fi
      NEW_FILES=$((NEW_FILES + 1))
    fi
  done
done

# --- Phase C: Detect project files (preserved) ---
echo "--- Phase C: Project files (preserved) ---"
for dir in .claude/rules .claude/agents .claude/skills .claude/commands .claude/pipelines; do
  [ -d "$dir" ] || continue
  for f in "$dir"/project-*; do
    [ -e "$f" ] || continue
    echo "  PRESERVED: $f"
    PRESERVED=$((PRESERVED + 1))
  done
  # Also check for project- prefixed directories (skills)
  if [ "$dir" = ".claude/skills" ]; then
    for d in "$dir"/project-*/; do
      [ -d "$d" ] || continue
      echo "  PRESERVED: $d"
      PRESERVED=$((PRESERVED + 1))
    done
  fi
done

# --- Update manifest ---
if [ "$DRY_RUN" = false ] && [ $((UPDATED + NEW_FILES)) -gt 0 ]; then
  echo "--- Updating manifest ---"
  # C1: Pass all variables via environment; C2: certutil fallback; C3: skills scanning
  MANIFEST_PATH="$MANIFEST" TEMPLATE_DIR="$TEMPLATE_PATH" NEW_VERSION="$NEW_VER" SYNC_DATE="$(date +%Y-%m-%d)" $PYTHON -c "
import json, subprocess, os

manifest_path = os.environ['MANIFEST_PATH']
template_path = os.environ['TEMPLATE_DIR']
new_version = os.environ['NEW_VERSION']
sync_date = os.environ['SYNC_DATE']

with open(manifest_path) as f:
    manifest = json.load(f)

# Update version
manifest['template_version'] = new_version
manifest['updated'] = sync_date

def get_hash(filepath):
    \"\"\"Cross-platform hash: sha256sum -> shasum -> certutil\"\"\"
    result = subprocess.run(['sha256sum', filepath], capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout.split()[0]
    result = subprocess.run(['shasum', '-a', '256', filepath], capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout.split()[0]
    # C2: Windows certutil fallback
    result = subprocess.run(['certutil', '-hashfile', filepath, 'SHA256'], capture_output=True, text=True)
    if result.returncode == 0:
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 2:
            hash_val = lines[1].strip().replace(' ', '').lower()
            return hash_val
    return None

# Rehash all template files
for filepath, info in list(manifest['files'].items()):
    if info.get('category') == 'project':
        continue
    if os.path.isfile(filepath):
        h = get_hash(filepath)
        if h:
            info['hash'] = h

# Add new files from standard directories
for pattern_dir in ['.claude/rules', '.claude/library/process', '.claude/library/technical', '.claude/library/meta', '.claude/library/domain', '.claude/library/conflict', '.claude/agents', '.claude/commands', '.claude/hooks', '.claude/pipelines', 'scripts', 'scripts/lib', 'mcp-servers/context-router/src', 'tests/rules', '_reference']:
    if not os.path.isdir(pattern_dir):
        continue
    for fname in os.listdir(pattern_dir):
        fpath = os.path.join(pattern_dir, fname)
        if fpath not in manifest['files'] and not fname.startswith('project-') and os.path.isfile(fpath):
            h = get_hash(fpath)
            if h:
                manifest['files'][fpath] = {'category': 'template', 'hash': h}

# C3: Skills directory scanning (.claude/skills/[name]/SKILL.md)
skills_dir = '.claude/skills'
if os.path.isdir(skills_dir):
    for skill_name in os.listdir(skills_dir):
        skill_file = os.path.join(skills_dir, skill_name, 'SKILL.md')
        if os.path.isfile(skill_file) and not skill_name.startswith('project-'):
            if skill_file not in manifest['files']:
                h = get_hash(skill_file)
                if h:
                    manifest['files'][skill_file] = {'category': 'template', 'hash': h}
            else:
                # Rehash existing skill entries
                h = get_hash(skill_file)
                if h:
                    manifest['files'][skill_file]['hash'] = h

with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=2)

print('Manifest updated.')
" 2>/dev/null || echo "WARNING: Could not update manifest automatically. Update manually."
fi

# --- Validation (M2: already inside DRY_RUN=false check) ---
if [ "$DRY_RUN" = false ]; then
  echo "--- Validation ---"
  $PYTHON -m json.tool .claude/settings.json > /dev/null 2>&1 && echo "  settings.json: valid JSON" || echo "  settings.json: invalid JSON"
  for script in scripts/*.sh; do
    bash -n "$script" 2>/dev/null && echo "  $script: valid bash" || echo "  $script: syntax error"
  done
fi

# --- Report ---
echo ""
echo "=== Sync Report: $CURRENT_VER → $NEW_VER ==="
echo "UPDATED:    $UPDATED template files"
echo "NEW:        $NEW_FILES template files added"
echo "CONFLICTS:  ${CONFLICTS:-0} files with local modifications (review manually)"
echo "SKIPPED:    $SKIPPED template files (unchanged)"
echo "PRESERVED:  $PRESERVED project files (untouched)"
echo "DEPRECATED: $DEPRECATED template files (removed from template, kept locally)"

if [ "${CONFLICTS:-0}" -gt 0 ]; then
  echo ""
  echo "⚠️  CONFLICTS detected. Template versions saved as *.template-new files."
  echo "Review each conflict: diff <file> <file>.template-new"
  echo "After resolving: rm *.template-new and update manifest hashes."
  echo "To force-overwrite all conflicts: rerun with --force"
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "(Dry run — no files were modified)"
fi

# --- Post-sync reconciliation ---
if [ "$DRY_RUN" = false ] && [ $((UPDATED + NEW_FILES)) -gt 0 ]; then
  echo ""
  echo "--- Post-sync checks ---"

  # Auto-scan project if tool-registry is empty
  if [ -f "_reference/tool-registry.md" ] && [ -d src ]; then
    REGISTRY_ENTRIES=$(grep -cE "^\| [^_|]" _reference/tool-registry.md 2>/dev/null || echo 0)
    if [ "$REGISTRY_ENTRIES" -lt 8 ] && [ -f scripts/scan-project.sh ]; then
      echo "  Tool registry has few entries. Running scan-project.sh..."
      bash scripts/scan-project.sh 2>/dev/null || true
    fi
  fi

  # Version jump warning
  if [ "$CURRENT_VER" != "unknown" ] && [ "$NEW_VER" != "unknown" ]; then
    OLD_MAJOR="${CURRENT_VER%%.*}"
    NEW_MAJOR="${NEW_VER%%.*}"
    if [ "$OLD_MAJOR" != "$NEW_MAJOR" ]; then
      echo ""
      echo "⚠️  MAJOR VERSION UPGRADE ($CURRENT_VER → $NEW_VER). Review changes carefully."
      echo "  Run: bash scripts/check-drift.sh"
    fi
  fi
fi

echo ""
echo "Done. Run 'bash scripts/check-drift.sh' to verify project health."
