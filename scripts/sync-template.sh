#!/usr/bin/env bash
# sync-template.sh — Sync project with newer template version
# Usage: ./scripts/sync-template.sh /path/to/agent-project-template [--dry-run] [--force]
#
# Manifest entries marked template or hybrid are updated from the new template.
# Entries explicitly marked project are preserved, including legacy AGENTS.md.
# See .template-manifest.json for the file registry.

set -euo pipefail

# --- Platform helpers ---
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

SCRIPT_DIR="$(normalize_drive_path "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
[ -f "$SCRIPT_DIR/lib/platform.sh" ] && source "$SCRIPT_DIR/lib/platform.sh"
# Fallback node detection if platform.sh not available
if [ -z "${NODE:-}" ]; then
  command -v node &>/dev/null && NODE="node" || NODE=""
fi

# --- Config ---
TEMPLATE_PATH=""
PROJECT_PATH="."
DRY_RUN=false
FORCE=false
FROM_GIT=false
BOOTSTRAP=false
CANARY=false
TEMPLATE_REF=""
EMPTY_TRACKABLE_MANIFEST=false

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --force) FORCE=true ;;
    --from-git) FROM_GIT=true ;;
    --bootstrap) BOOTSTRAP=true ;;
    --canary) CANARY=true ;;
    --ref|--template-ref)
      shift
      if [ $# -eq 0 ]; then
        echo "Error: --ref requires a git ref or tag"
        exit 1
      fi
      TEMPLATE_REF="$1"
      ;;
    --project-dir)
      shift
      if [ $# -eq 0 ]; then
        echo "Error: --project-dir requires a path"
        exit 1
      fi
      PROJECT_PATH="$1"
      ;;
    --help|-h)
      echo "Usage: $0 [/path/to/template] [project-dir] [--project-dir PATH] [--dry-run] [--force] [--from-git] [--ref REF] [--canary] [--bootstrap]"
      echo ""
      echo "Syncs this project with a newer version of agent-project-template."
      echo "Template files (tracked in .template-manifest.json) are updated."
      echo "Project files (project-* prefix) are preserved."
      echo ""
      echo "Options:"
      echo "  --dry-run    Show what would change without modifying files"
      echo "  --force      Skip backup step"
      echo "  --from-git   Fetch template from the 'template' git remote instead of a local path"
      echo "  --ref REF    With --from-git, fetch an exact vX.Y.Z release tag"
      echo "  --canary     Explicitly allow a branch/commit ref or remote default branch"
      echo "  --bootstrap  Generate .template-manifest.json for a project created before sync support"
      echo "  --project-dir PATH  Target project directory (defaults to current directory)"
      exit 0
      ;;
    *)
      if [ -z "$TEMPLATE_PATH" ]; then
        TEMPLATE_PATH="$1"
      elif [ "$PROJECT_PATH" = "." ]; then
        PROJECT_PATH="$1"
      else
        echo "Error: Unexpected argument '$1'"
        exit 1
      fi
      ;;
  esac
  shift
done

if [ ! -d "$PROJECT_PATH" ]; then
  echo "Error: Project directory not found: $PROJECT_PATH"
  exit 1
fi

PROJECT_PATH="$(normalize_drive_path "$(cd "$PROJECT_PATH" && pwd)")"
cd "$PROJECT_PATH"

# --- Git-based update mode ---
if [ "$FROM_GIT" = true ]; then
    CONFIGURED_REMOTE=$(git remote get-url template 2>/dev/null || true)
    MANIFEST_PATH=".template-manifest.json"
    MANIFEST_REMOTE=$(_node -e "const fs=require('fs'); const p=process.argv[1]; console.log(JSON.parse(fs.readFileSync(p,'utf8')).template_remote||'')" "$MANIFEST_PATH" 2>/dev/null || true)

    if [ -n "$CONFIGURED_REMOTE" ] && [ -n "$MANIFEST_REMOTE" ] && [ "$CONFIGURED_REMOTE" != "$MANIFEST_REMOTE" ]; then
        echo "Error: Template source conflict. Git remote is '$CONFIGURED_REMOTE' but manifest records '$MANIFEST_REMOTE'."
        exit 1
    fi

    TEMPLATE_REMOTE="${CONFIGURED_REMOTE:-$MANIFEST_REMOTE}"
    if [ -z "$CONFIGURED_REMOTE" ] && [ -n "$TEMPLATE_REMOTE" ] && [ "$DRY_RUN" = false ]; then
        git remote add template "$TEMPLATE_REMOTE" 2>/dev/null || { echo "Error: Could not add the manifest template remote."; exit 1; }
    fi

    if [ -z "$TEMPLATE_REMOTE" ]; then
        echo "Error: No template remote configured. Add with: git remote add template <URL>"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "Fetching template preview from $TEMPLATE_REMOTE..."
    else
        echo "Fetching template updates from $TEMPLATE_REMOTE..."
    fi
    if [ -z "$TEMPLATE_REF" ] && [ "$CANARY" = false ]; then
        echo "Error: Normal updates require --ref vX.Y.Z. Use --canary only for an explicit branch/commit rollout."
        exit 1
    fi
    if [ -n "$TEMPLATE_REF" ] &&
       [[ ! "$TEMPLATE_REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] &&
       [ "$CANARY" = false ]; then
        echo "Error: Non-release ref '$TEMPLATE_REF' requires --canary."
        exit 1
    fi

    # Fetch outside the target repository so dry-run does not mutate project git state.
    FETCH_DIR="$(_temp_dir template-fetch)"
    git -C "$FETCH_DIR" init -q
    if [ -n "$TEMPLATE_REF" ]; then
        FETCH_REF="$TEMPLATE_REF"
        if [[ "$TEMPLATE_REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            FETCH_REF="refs/tags/$TEMPLATE_REF"
        fi
        git -C "$FETCH_DIR" fetch "$TEMPLATE_REMOTE" --depth 1 "$FETCH_REF" 2>/dev/null || { echo "Error: Cannot fetch template ref: $TEMPLATE_REF"; rm -rf "$FETCH_DIR"; exit 1; }
    else
        git -C "$FETCH_DIR" fetch "$TEMPLATE_REMOTE" --depth 1 2>/dev/null || { echo "Error: Cannot reach template remote: $TEMPLATE_REMOTE"; rm -rf "$FETCH_DIR"; exit 1; }
    fi

    TEMP_DIR="$(_temp_dir template-sync)"
    git -C "$FETCH_DIR" archive FETCH_HEAD | tar -x -C "$TEMP_DIR" 2>/dev/null || \
    { echo "Error: Cannot extract template ref: ${TEMPLATE_REF:-remote default}"; rm -rf "$FETCH_DIR" "$TEMP_DIR"; exit 1; }
    rm -rf "$FETCH_DIR"

    # Now use TEMP_DIR as TEMPLATE_PATH and continue with normal sync
    TEMPLATE_PATH="$TEMP_DIR"
    cleanup_dir="$TEMP_DIR"
    trap 'rm -rf -- "$cleanup_dir"' EXIT
    echo "Template fetched to temp directory. Proceeding with sync..."
fi

# --- L1: Dependency check ---
if ! command -v node &>/dev/null; then
    echo "Error: Node.js is required for sync. Install: https://nodejs.org/"
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

is_source_only_path() {
  case "$1" in
    templates/*|setup.sh|setup.bat|.github/workflows/release-template.yml) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Validation ---
if [ -z "$TEMPLATE_PATH" ]; then
  echo "Error: Template path required. Run with --help for usage."
  exit 1
fi

TEMPLATE_PATH="$(normalize_drive_path "$(cd "$TEMPLATE_PATH" && pwd)")"

if [ ! -f "$TEMPLATE_PATH/CLAUDE.md" ]; then
  echo "Error: $TEMPLATE_PATH does not look like an agent-project-template (no CLAUDE.md)"
  exit 1
fi

SAFE_COPY_HELPER="$TEMPLATE_PATH/scripts/lib/sync-safe-copy.js"
if [ ! -f "$SAFE_COPY_HELPER" ]; then
  echo "ERROR: Target release is missing scripts/lib/sync-safe-copy.js"
  exit 1
fi

# The managed MCP merger always touches this hybrid path, even when a legacy
# manifest still calls it project-owned. Enforce the same symlink/reparse
# boundary before reading or mutating backup/bootstrap/manifest state.
node "$SAFE_COPY_HELPER" --project-root "$PROJECT_PATH" --path ".codex/config.toml" --check-only true || {
  echo "ERROR: Unsafe .codex/config.toml path"
  exit 1
}

# --- Read manifest ---
MANIFEST=".template-manifest.json"

# Fix Windows backslash paths in manifest
if grep -q '\\\\' .template-manifest.json 2>/dev/null; then
  if [ "$DRY_RUN" = true ]; then
    echo "WOULD NORMALIZE: Windows backslash paths in manifest"
  else
    echo "Windows backslash paths will be normalized during safe manifest reconciliation."
  fi
fi

manifest_entry_count() {
  _node -e "
const fs=require('fs');
const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
console.log(Object.keys(m.files||{}).length);
" "$MANIFEST" 2>/dev/null
}

if [ -f "$MANIFEST" ]; then
  entry_count="$(manifest_entry_count || echo parse_error)"
  if [ "$entry_count" = "parse_error" ]; then
    echo "ERROR: Failed to parse $MANIFEST"
    exit 1
  fi

  # Explicit project-owned entries are valid registry state. Only a literally
  # empty files object may enter the legacy manifest rebuild path.
  if [ "$entry_count" = "0" ]; then
    if [ "$DRY_RUN" = true ]; then
      EMPTY_TRACKABLE_MANIFEST=true
      echo "WARNING: Manifest has no trackable files. Dry-run will report template additions without changing files."
      echo "Run bootstrap to rebuild the manifest before applying sync:"
      echo "  $0 $TEMPLATE_PATH --project-dir $PROJECT_PATH --bootstrap"
      echo ""
    else
      backup_manifest="$MANIFEST.empty-$(date +%Y%m%d-%H%M%S).bak"
      mv "$MANIFEST" "$backup_manifest"
      echo "WARNING: Manifest has no trackable files. Backed up to $backup_manifest."
      echo "Rebuilding manifest from current project state before sync..."
      "${BASH:-bash}" "$SCRIPT_DIR/sync-template.sh" "$TEMPLATE_PATH" --project-dir "$PROJECT_PATH" --bootstrap
    fi
  fi
fi

# Warn if manifest version is unknown
manifest_ver=$(_node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).template_version||'unknown')" "$MANIFEST" 2>/dev/null || echo "unknown")
if [ "$manifest_ver" = "unknown" ] || [ -z "$manifest_ver" ]; then
  echo "WARNING: Manifest version is '$manifest_ver'. Will be updated after sync."
fi

if [ ! -f "$MANIFEST" ]; then
  if [ "$BOOTSTRAP" = true ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "WOULD BOOTSTRAP: Generate $MANIFEST from the current project without modifying files."
      exit 0
    fi

    echo "=== Bootstrap: Generating $MANIFEST for existing project ==="
    echo "Scanning project files and computing hashes..."

    # Determine category for a file path
    get_category() {
      case "$1" in
        CLAUDE.md|DESIGN.md|design-policy.ignore|PROJECT_SPEC.md|ecosystem.md|tasks/*|brain/*) echo "project" ;;
        .gitignore|.codex/config.toml|.mcp.json|.vscode/*) echo "hybrid" ;;
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
      ".codex/config.toml" ".codex/hooks.json" \
      ".codex/agents/*.toml" \
      ".agents/skills/*/SKILL.md" \
      ".agents/skills/*/agents/openai.yaml" \
      ".agents/skills/*/references/*.md" \
      ".claude/settings.json" ".claude/settings.local.json.example" \
      ".claude/docs/*.md" \
      ".claude/docs/domain-full/*.md" \
      ".claude/rules/*.md" \
      ".claude/library/process/*.md" \
      ".claude/library/technical/*.md" ".claude/library/technical/*.json" \
      ".claude/library/meta/*.md" \
      ".claude/library/domain/*.md" \
      ".claude/library/product/*.md" \
      ".claude/library/conflict/*.md" \
      ".claude/agents/*.md" \
      ".claude/skills/*/SKILL.md" \
      ".claude/commands/*.md" \
      ".claude/hooks/*.sh" \
      ".claude/pipelines/*.md" \
      "scripts/*.sh" "scripts/*.js" "scripts/lib/*.sh" "scripts/lib/*.js" \
      "mcp-servers/context-router/package-lock.json" \
      "mcp-servers/context-router/src/*.ts" \
      "mcp-servers/context-router/package.json" \
      "mcp-servers/context-router/tsconfig.json" \
      "tests/rules/*.test.md" \
      "brain/03-knowledge/communication/*.md" \
      "docs/AGENT_CONTEXT_SOT.md" \
      "integrations/spec-kit/*.md" \
      "_reference/agent-sot/*.md" "_reference/agent-sot/*.json" "_reference/agent-sot/originals/*.md" \
      "_reference/spec-kit/*.md" "_reference/spec-kit/*.json" \
      "_reference/spec-kit/upstream/*.md" "_reference/spec-kit/upstream/LICENSE" \
      "_reference/spec-kit/upstream/docs/*.md" "_reference/spec-kit/upstream/docs/reference/*.md" \
      "_reference/spec-kit/upstream/integrations/*.json" \
      "_reference/spec-kit/upstream/scripts/bash/*.sh" "_reference/spec-kit/upstream/scripts/powershell/*.ps1" \
      "_reference/spec-kit/upstream/templates/*.md" "_reference/spec-kit/upstream/templates/*.json" \
      "_reference/spec-kit/upstream/templates/commands/*.md" \
      "DESIGN.md" \
      "design-policy.ignore" \
      "docs/AGENT_PIPELINES.md" \
      "docs/CODEX_FANOUT_PATTERNS.md" \
      "docs/CODEX_SKILLS_AUDIT.md" \
      "docs/CODEX_SUBAGENTS_AUDIT.md" \
      "docs/CODE_INTELLIGENCE_TOOLCHAIN.md" \
      "docs/MIGRATION_MATRIX.md" \
      "docs/OPENAI_MODEL_GUIDANCE.md" \
      "docs/WRITING_REFERENCE_PROVENANCE.md" \
      "docs/WRITING_WORKFLOW.md" \
      "docs/PRODUCT_BOUNDARY.md" \
      "docs/RELEASE_CHECKLIST.md" \
      "docs/TEMPLATE_RELEASES.md" \
      "docs/SAFE_DEFAULTS.md" \
      "docs/SHARED_CONVENTIONS.md" \
      "docs/SUPPORTED_ENVIRONMENTS.md" \
      "docs/*.md.template" \
      "templates/project-starter/tasks/*" \
      "templates/project-starter/tasks/.research-cache.md" \
      "templates/project-starter/tasks/audit/.gitkeep" \
      "templates/project-starter/brain/01-daily/.gitkeep" \
      "templates/project-starter/brain/03-knowledge/research/.gitkeep" \
      "templates/project-starter/brain/03-knowledge/audits/.gitkeep" \
      "tests/fixtures/design-policy/pass/*.css" \
      "tests/fixtures/design-policy/fail/*.css" \
      "tests/fixtures/writing-tools/*.js" \
      "tests/fixtures/change-strategy/*.json" \
      ".editorconfig" ".env.example" ".gitattributes" "Makefile" "SECURITY.md" "CONTRIBUTING.md" \
      ".github/ci.yml.template" ".github/workflows/validate-template.yml" \
      "_reference/tool-registry.md" "_reference/README.md" "_reference/code-intelligence-tools.json" "_reference/codex-mcp-config.toml" \
      ".mcp.json" "AGENTS.md" "CLAUDE.md" "PROJECT_SPEC.md" "ecosystem.md" "README.md" "SETUP_GUIDE.md" "setup.sh" "setup.bat" "upgrade-project.sh" ".gitignore" ".vscode/extensions.json"; do
      for f in $pattern; do
        [ -f "$f" ] || continue
        # Skip project-* files (agent-created)
        basename_f=$(basename "$f")
        case "$basename_f" in project-*) continue ;; esac
        case "$f" in .claude/skills/project-*/*|.agents/skills/project-*/*) continue ;; esac
        is_source_only_path "$f" && continue

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
    echo "  $0 $TEMPLATE_PATH --project-dir $PROJECT_PATH"
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
    echo "  2. bash scripts/sync-template.sh --from-git --ref <tag> --bootstrap"
    echo "  3. bash scripts/sync-template.sh --from-git --ref <tag>"
    exit 1
  fi
fi

# Get current and new template versions
CURRENT_VER=$(_node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).template_version||'unknown')" "$MANIFEST" 2>/dev/null || echo "unknown")
NEW_VER=$(sed -n 's/.*Template Version: \([0-9.]*\).*/\1/p' "$TEMPLATE_PATH/CLAUDE.md" 2>/dev/null || echo "unknown")

echo "=== Template Sync ==="
echo "Current: $CURRENT_VER → New: $NEW_VER"
echo ""

# --- Counters ---
UPDATED=0; SKIPPED=0; NEW_FILES=0; PRESERVED=0; DEPRECATED=0; SOURCE_ONLY_MANIFEST=0; CONFLICTS=0

# --- Phase A: Update template files in manifest ---
echo "--- Phase A: Updating template files ---"

# Read manifest files using node (portable JSON parsing)
if ! manifest_files=$(_node -e "
const fs=require('fs'),path=require('path');
const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const projectRoot=fs.realpathSync.native(process.cwd());
function assertSafeExisting(relativePath){
  let current=projectRoot;
  const parts=relativePath.split('/');
  for(let index=0;index<parts.length;index+=1){
    current=path.join(current,parts[index]);
    let stat;
    try{stat=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT')return;throw error;}
    if(stat.isSymbolicLink())throw new Error('Symlink/reparse manifest path is not allowed: '+relativePath);
    if(index<parts.length-1&&!stat.isDirectory())throw new Error('Non-directory manifest path component: '+relativePath);
    if(index===parts.length-1&&!stat.isFile())throw new Error('Manifest target is not a regular file: '+relativePath);
    const real=fs.realpathSync.native(current),relation=path.relative(projectRoot,real);
    if(real!==projectRoot&&(relation.startsWith('..')||path.isAbsolute(relation)))throw new Error('Manifest path resolves outside project: '+relativePath);
  }
}
for(const[p,i]of Object.entries(m.files||{})){
  const normalized=p.replaceAll('\\\\','/');
  const clean=path.posix.normalize(normalized);
  const category=String(i.category||'template');
  const hash=String(i.hash||'');
  if(!normalized || clean==='.' || clean!==normalized || clean.startsWith('../') ||
     path.posix.isAbsolute(clean) || /^[A-Za-z]:/.test(clean) || /[\r\n|]/.test(clean)) {
    throw new Error('Unsafe manifest path: '+p);
  }
  if(!['template','hybrid','project'].includes(category)||/[\r\n|]/.test(hash))throw new Error('Invalid manifest entry: '+p);
  assertSafeExisting(clean);
  if(category!=='project'||clean==='.codex/config.toml'){
    console.log(clean+'|'+hash+'|'+category);
  }
}" "$MANIFEST" 2>&1); then
    echo "ERROR: Failed to parse $MANIFEST: $manifest_files"
    exit 1
fi

# L2: Validate manifest structure
if [ -z "$manifest_files" ]; then
    if [ "$entry_count" = "0" ]; then
        echo "WARNING: Manifest has no trackable files. Is .template-manifest.json valid?"
    else
        echo "INFO: Manifest has no template/hybrid entries; project-owned entries remain preserved."
    fi
fi

# Create rollback metadata only after the manifest and every managed path have
# passed the read-only safety preflight.
if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "$GIT_ROOT" ] && [ "$(cd "$GIT_ROOT" && pwd)" = "$PROJECT_PATH" ]; then
      if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        echo "Dirty worktree detected; preserving changes in place (no automatic stash)."
        echo "The backup tag records the committed baseline; review the accepted dry-run before continuing."
      fi
      git tag "backup/pre-sync-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
      echo "Backup tag created."
    else
      echo "Skipping git backup: project directory is not a git repository root."
    fi
  fi
fi

while IFS='|' read -r filepath old_hash category; do
  [ -z "$filepath" ] && continue

  # Skip project-local files
  case "$filepath" in
    .claude/settings.local.json|core/*)
      SKIPPED=$((SKIPPED + 1))
      continue
      ;;
    .codex/config.toml)
      # Codex config contains project-owned settings. Its managed MCP block is
      # merged separately after template payload discovery.
      SKIPPED=$((SKIPPED + 1))
      continue
      ;;
  esac
  if is_source_only_path "$filepath"; then
    SOURCE_ONLY_MANIFEST=$((SOURCE_ONLY_MANIFEST + 1))
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  template_file="$TEMPLATE_PATH/$filepath"

  if [ ! -f "$template_file" ]; then
    # File removed from template
    echo "  DEPRECATED: $filepath (removed from template, kept locally)"
    DEPRECATED=$((DEPRECATED + 1))
    continue
  fi
  if [ -L "$template_file" ]; then
    echo "ERROR: Template source must be a regular non-symlink file: $filepath"
    exit 1
  fi

  new_hash=$(get_hash "$template_file")

  # Check if local file was modified (conflict detection)
  local_hash=""
  if [ -f "$filepath" ]; then
    local_hash=$(get_hash "$filepath")
  fi

  # Restore deleted template files even when the release hash is unchanged.
  if [ "$new_hash" = "$old_hash" ] && [ -n "$local_hash" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [ -n "$local_hash" ] && [ "$local_hash" != "$old_hash" ] &&
     [ "$local_hash" != "$new_hash" ] && [ "$FORCE" = false ]; then
    # File modified BOTH locally AND in template = CONFLICT
    if [ "$DRY_RUN" = true ]; then
      diff_info=$(diff --stat "$filepath" "$template_file" 2>/dev/null | tail -1 || echo "cannot diff")
      echo "  CONFLICT: $filepath (modified locally AND in template) — $diff_info; apply would save ${filepath}.template-new"
    else
      # Save template version alongside, don't overwrite
      node "$SAFE_COPY_HELPER" --source-root "$TEMPLATE_PATH" --project-root "$PROJECT_PATH" --path "$filepath" --suffix ".template-new"
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
    if [ "$local_hash" = "$new_hash" ]; then
      echo "  WOULD ADOPT: $filepath (already matches target release)$diff_info"
    else
      echo "  WOULD UPDATE: $filepath$diff_info"
    fi
  else
    if [ "$local_hash" = "$new_hash" ]; then
      echo "  ADOPTED: $filepath (already matches target release)"
    else
      node "$SAFE_COPY_HELPER" --source-root "$TEMPLATE_PATH" --project-root "$PROJECT_PATH" --path "$filepath"
      echo "  UPDATED: $filepath"
    fi
  fi
  UPDATED=$((UPDATED + 1))
done < <(echo "$manifest_files")

# --- Phase B: Detect new files in template ---
echo "--- Phase B: Checking for new template files ---"

TEMPLATE_IS_GIT_ROOT=false
TEMPLATE_GIT_ROOT=$(git -C "$TEMPLATE_PATH" rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$TEMPLATE_GIT_ROOT" ] && [ "$(normalize_drive_path "$(cd "$TEMPLATE_GIT_ROOT" && pwd)")" = "$TEMPLATE_PATH" ]; then
  TEMPLATE_IS_GIT_ROOT=true
fi

# Phase B can inspect hundreds of files. Load the two membership sets once;
# invoking Node and Git for every candidate makes a Windows sync take minutes.
declare -A MANIFEST_FILE_SET=()
while IFS= read -r manifest_path; do
  [ -n "$manifest_path" ] && MANIFEST_FILE_SET["$manifest_path"]=1
done < <(_node -e '
const fs=require("fs");
const manifest=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
for(const file of Object.keys(manifest.files||{})) console.log(file.replaceAll("\\","/"));
' "$MANIFEST")

declare -A TEMPLATE_TRACKED_SET=()
if [ "$TEMPLATE_IS_GIT_ROOT" = true ]; then
  while IFS= read -r tracked_path; do
    [ -n "$tracked_path" ] && TEMPLATE_TRACKED_SET["$tracked_path"]=1
  done < <(git -C "$TEMPLATE_PATH" ls-files)
fi

PHASE_B_COPY_FILES=()
PHASE_B_COPY_LABELS=()
PHASE_B_MANIFEST_FILES=()
PHASE_B_PROJECT_MANIFEST_FILES=()

# Define template file patterns to check
for pattern in ".codex/config.toml" ".codex/hooks.json" ".codex/agents/*.toml" ".agents/skills/*/SKILL.md" ".agents/skills/*/agents/openai.yaml" ".agents/skills/*/references/*.md" ".claude/settings.json" ".claude/settings.local.json.example" ".claude/docs/*.md" ".claude/docs/domain-full/*.md" ".claude/rules/*.md" ".claude/library/process/*.md" ".claude/library/technical/*.md" ".claude/library/technical/*.json" ".claude/library/meta/*.md" ".claude/library/domain/*.md" ".claude/library/product/*.md" ".claude/library/conflict/*.md" ".claude/agents/*.md" ".claude/skills/*/SKILL.md" ".claude/commands/*.md" ".claude/hooks/*.sh" ".claude/pipelines/*.md" "scripts/*.sh" "scripts/*.js" "scripts/lib/*.sh" "scripts/lib/*.js" "mcp-servers/context-router/package-lock.json" "mcp-servers/context-router/src/*.ts" "mcp-servers/context-router/package.json" "mcp-servers/context-router/tsconfig.json" "tests/rules/*.test.md" "tests/fixtures/design-policy/pass/*.css" "tests/fixtures/design-policy/fail/*.css" "tests/fixtures/writing-tools/*.js" "tests/fixtures/change-strategy/*.json" "brain/03-knowledge/communication/*.md" "docs/AGENT_CONTEXT_SOT.md" "integrations/spec-kit/*.md" "_reference/agent-sot/*.md" "_reference/agent-sot/*.json" "_reference/agent-sot/originals/*.md" "_reference/spec-kit/*.md" "_reference/spec-kit/*.json" "_reference/spec-kit/upstream/*.md" "_reference/spec-kit/upstream/LICENSE" "_reference/spec-kit/upstream/docs/*.md" "_reference/spec-kit/upstream/docs/reference/*.md" "_reference/spec-kit/upstream/integrations/*.json" "_reference/spec-kit/upstream/scripts/bash/*.sh" "_reference/spec-kit/upstream/scripts/powershell/*.ps1" "_reference/spec-kit/upstream/templates/*.md" "_reference/spec-kit/upstream/templates/*.json" "_reference/spec-kit/upstream/templates/commands/*.md" "docs/AGENT_PIPELINES.md" "docs/CODEX_FANOUT_PATTERNS.md" "docs/CODEX_SKILLS_AUDIT.md" "docs/CODEX_SUBAGENTS_AUDIT.md" "docs/CODE_INTELLIGENCE_TOOLCHAIN.md" "docs/MIGRATION_MATRIX.md" "docs/OPENAI_MODEL_GUIDANCE.md" "docs/WRITING_REFERENCE_PROVENANCE.md" "docs/WRITING_WORKFLOW.md" "docs/PRODUCT_BOUNDARY.md" "docs/RELEASE_CHECKLIST.md" "docs/TEMPLATE_RELEASES.md" "docs/SAFE_DEFAULTS.md" "docs/SHARED_CONVENTIONS.md" "docs/SUPPORTED_ENVIRONMENTS.md" "docs/*.md.template" "templates/project-starter/tasks/*" "templates/project-starter/tasks/.research-cache.md" "templates/project-starter/tasks/audit/.gitkeep" "templates/project-starter/brain/01-daily/.gitkeep" "templates/project-starter/brain/03-knowledge/research/.gitkeep" "templates/project-starter/brain/03-knowledge/audits/.gitkeep" "_reference/*.md" "_reference/*.json" "_reference/*.toml" ".github/*.template" ".github/workflows/validate-template.yml" ".mcp.json" ".editorconfig" ".env.example" ".gitattributes" ".gitignore" "Makefile" "SECURITY.md" "CONTRIBUTING.md" "AGENTS.md" "CLAUDE.md" "README.md" "SETUP_GUIDE.md" "setup.sh" "setup.bat" "upgrade-project.sh" "PROJECT_SPEC.md" "ecosystem.md"; do
  # H1: Quote the template path in glob expansion
  for template_file in "$TEMPLATE_PATH"/$pattern; do
    [ -f "$template_file" ] || continue
    if [ -L "$template_file" ]; then
      echo "ERROR: Template source must be a regular non-symlink file: $template_file"
      exit 1
    fi
    # Get relative path
    rel_path="${template_file#$TEMPLATE_PATH/}"

    # A real template repository ships only its Git payload. Ignored or
    # maintainer-local files under managed-looking directories must never leak
    # into downstream projects. Synthetic non-Git fixtures remain supported.
    if [ "$TEMPLATE_IS_GIT_ROOT" = true ] &&
       [ -z "${TEMPLATE_TRACKED_SET[$rel_path]+present}" ]; then
      continue
    fi

    # Skip project-local files
    case "$rel_path" in
      .claude/settings.local.json|.codex/agents/project-*|core/*)
        continue
        ;;
    esac
    is_source_only_path "$rel_path" && continue

    if [ -n "${MANIFEST_FILE_SET[$rel_path]+present}" ]; then
      in_manifest="yes"
    else
      in_manifest="no"
    fi

    if [ "$EMPTY_TRACKABLE_MANIFEST" = true ]; then
      in_manifest="no"
    fi

    if [ "$in_manifest" = "no" ] && { [ -e "$rel_path" ] || [ -L "$rel_path" ]; }; then
      node "$SAFE_COPY_HELPER" --project-root "$PROJECT_PATH" --path "$rel_path" --check-only true || exit 1
      case "$rel_path" in
        CLAUDE.md|DESIGN.md|design-policy.ignore|PROJECT_SPEC.md|ecosystem.md|tasks/*|brain/*)
          if [ "$DRY_RUN" = true ]; then
            echo "  WOULD PRESERVE: $rel_path (project-owned path missing from legacy manifest)"
          else
            PHASE_B_PROJECT_MANIFEST_FILES+=("$rel_path")
            echo "  PRESERVED: $rel_path (project-owned path restored to manifest)"
          fi
          NEW_FILES=$((NEW_FILES + 1))
          continue
          ;;
      esac
      local_new_hash=$(get_hash "$rel_path")
      source_new_hash=$(get_hash "$template_file")
      if [ "$local_new_hash" = "$source_new_hash" ]; then
        if [ "$DRY_RUN" = true ]; then
          echo "  WOULD ADOPT: $rel_path (local file already matches new release path)"
        else
          PHASE_B_MANIFEST_FILES+=("$rel_path")
          echo "  ADOPTED: $rel_path (local file already matches new release path)"
        fi
        NEW_FILES=$((NEW_FILES + 1))
      else
        if [ "$DRY_RUN" = true ]; then
          echo "  CONFLICT: $rel_path (new release path already exists locally with different content)"
        else
          node "$SAFE_COPY_HELPER" --source-root "$TEMPLATE_PATH" --project-root "$PROJECT_PATH" --path "$rel_path" --suffix ".template-new"
          echo "  CONFLICT: $rel_path - local file preserved. Template version saved as ${rel_path}.template-new"
        fi
        CONFLICTS=$((CONFLICTS + 1))
      fi
    elif [ "$in_manifest" = "no" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "  WOULD ADD: $rel_path (new in template)"
      else
        PHASE_B_COPY_FILES+=("$rel_path")
        PHASE_B_COPY_LABELS+=("NEW: $rel_path")
        PHASE_B_MANIFEST_FILES+=("$rel_path")
      fi
      NEW_FILES=$((NEW_FILES + 1))
    fi
  done
done

if [ "$DRY_RUN" = false ] && [ "${#PHASE_B_COPY_FILES[@]}" -gt 0 ]; then
  PHASE_B_COPY_FILE="$(_temp_file template-sync-copy-paths)"
  chmod 600 "$PHASE_B_COPY_FILE" 2>/dev/null || true
  printf '%s\n' "${PHASE_B_COPY_FILES[@]}" > "$PHASE_B_COPY_FILE"
  node "$SAFE_COPY_HELPER" --source-root "$TEMPLATE_PATH" --project-root "$PROJECT_PATH" --paths-file "$PHASE_B_COPY_FILE" || {
    rm -f "$PHASE_B_COPY_FILE"
    exit 1
  }
  rm -f "$PHASE_B_COPY_FILE"
  for phase_b_label in "${PHASE_B_COPY_LABELS[@]}"; do
    echo "  $phase_b_label"
  done
fi

# Merge only the template-managed MCP block. The rest of `.codex/config.toml`
# remains project-owned even when the template changes its MCP defaults.
CODEX_MCP_MERGER="$TEMPLATE_PATH/scripts/configure-codex-mcp.js"
CODEX_MCP_REFERENCE="$TEMPLATE_PATH/_reference/codex-mcp-config.toml"
if [ -f "$CODEX_MCP_MERGER" ] && [ -f "$CODEX_MCP_REFERENCE" ]; then
  echo "--- Codex MCP managed block ---"
  if [ "$DRY_RUN" = true ]; then
    node "$CODEX_MCP_MERGER" --root "$PROJECT_PATH" --reference "$CODEX_MCP_REFERENCE" --dry-run
  else
    node "$CODEX_MCP_MERGER" --root "$PROJECT_PATH" --reference "$CODEX_MCP_REFERENCE"
  fi
fi

# Project-local Claude settings must never be tracked or carried in the manifest.
if git ls-files --error-unmatch .claude/settings.local.json >/dev/null 2>&1; then
  if [ "$DRY_RUN" = true ]; then
    echo "  WOULD UNTRACK: .claude/settings.local.json (local-only settings)"
  else
    git rm --cached --quiet -- .claude/settings.local.json || true
    echo "  UNTRACKED: .claude/settings.local.json (local-only settings)"
  fi
fi

# --- Phase C: Detect project files (preserved) ---
echo "--- Phase C: Project files (preserved) ---"
for dir in .codex/agents .agents/skills .claude/rules .claude/agents .claude/skills .claude/commands .claude/pipelines; do
  [ -d "$dir" ] || continue
  for f in "$dir"/project-*; do
    [ -e "$f" ] || continue
    echo "  PRESERVED: $f"
    PRESERVED=$((PRESERVED + 1))
  done
  # Also check for project- prefixed directories (skills)
  if [ "$dir" = ".claude/skills" ] || [ "$dir" = ".agents/skills" ]; then
    for d in "$dir"/project-*/; do
      [ -d "$d" ] || continue
      echo "  PRESERVED: $d"
      PRESERVED=$((PRESERVED + 1))
    done
  fi
done

# --- Update manifest ---
if [ "$DRY_RUN" = false ] && { [ $((UPDATED + NEW_FILES + DEPRECATED + SOURCE_ONLY_MANIFEST)) -gt 0 ] || [ "$CURRENT_VER" != "$NEW_VER" ]; }; then
  echo "--- Updating manifest ---"
  MANIFEST_ADDITIONS_FILE="$(_temp_file template-manifest-additions)"
  PROJECT_MANIFEST_ADDITIONS_FILE="$(_temp_file template-project-manifest-additions)"
  chmod 600 "$MANIFEST_ADDITIONS_FILE" 2>/dev/null || true
  chmod 600 "$PROJECT_MANIFEST_ADDITIONS_FILE" 2>/dev/null || true
  if [ "${#PHASE_B_MANIFEST_FILES[@]}" -gt 0 ]; then
    printf '%s\n' "${PHASE_B_MANIFEST_FILES[@]}" > "$MANIFEST_ADDITIONS_FILE"
  fi
  if [ "${#PHASE_B_PROJECT_MANIFEST_FILES[@]}" -gt 0 ]; then
    printf '%s\n' "${PHASE_B_PROJECT_MANIFEST_FILES[@]}" > "$PROJECT_MANIFEST_ADDITIONS_FILE"
  fi
  node "$TEMPLATE_PATH/scripts/lib/sync-manifest-reconcile.js" \
    --manifest "$PROJECT_PATH/$MANIFEST" \
    --template-root "$TEMPLATE_PATH" \
    --project-root "$PROJECT_PATH" \
    --new-version "$NEW_VER" \
    --conflicts "$CONFLICTS" \
    --additions-file "$MANIFEST_ADDITIONS_FILE" \
    --project-additions-file "$PROJECT_MANIFEST_ADDITIONS_FILE" || {
      rm -f "$MANIFEST_ADDITIONS_FILE" "$PROJECT_MANIFEST_ADDITIONS_FILE"
      echo "ERROR: Could not update manifest safely."
      exit 1
    }
  rm -f "$MANIFEST_ADDITIONS_FILE" "$PROJECT_MANIFEST_ADDITIONS_FILE"
  if [ "$CONFLICTS" -gt 0 ]; then
    echo "Manifest version remains $CURRENT_VER until all conflicts are resolved."
  fi
fi

# --- Validation ---
if [ "$DRY_RUN" = false ]; then
  echo "--- Validation ---"
  VALIDATION_ERRORS=0
  if [ -f .claude/settings.json ]; then
    if _json_valid .claude/settings.json; then
      echo "  settings.json: valid JSON"
    else
      echo "  settings.json: invalid JSON"
      VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
  else
    echo "  settings.json: not present (skipped)"
  fi
  for script in scripts/*.sh; do
    [ -f "$script" ] || continue
    if bash -n "$script" 2>/dev/null; then
      echo "  $script: valid bash"
    else
      echo "  $script: syntax error"
      VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
  done
  if [ "$VALIDATION_ERRORS" -gt 0 ]; then
    echo "ERROR: Post-sync validation failed with $VALIDATION_ERRORS error(s)."
    exit 1
  fi
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
  echo "(Dry run — no project files or project git metadata were modified)"
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
if [ "$CONFLICTS" -gt 0 ]; then
  echo "Sync incomplete: resolve conflicts before treating the target version as installed."
  exit 2
fi

echo "Done. Run 'bash scripts/check-drift.sh' to verify project health."
