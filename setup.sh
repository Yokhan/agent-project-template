#!/usr/bin/env bash
# setup.sh — Create a new agent-ready project from this template
# Usage: ./setup.sh [--orchestrator] [project-name]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_VERSION=$(sed -n 's/.*Template Version: \([0-9.]*\).*/\1/p' "$SCRIPT_DIR/AGENTS.md" 2>/dev/null | head -n 1)
[ -n "$TEMPLATE_VERSION" ] || TEMPLATE_VERSION="4.0.1"

# Validate the required runtime before prompting or creating any project files.
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 24+ with working node:sqlite is required. Install Node.js 24 LTS from https://nodejs.org/ and ensure it is on PATH." >&2
  exit 1
fi
if ! node "$SCRIPT_DIR/scripts/lib/codex-runtime.js"; then
  exit 1
fi

copy_entry() {
  local rel_path="$1"
  local source_path="$SCRIPT_DIR/$rel_path"
  local target_path="$PROJECT_DIR/$rel_path"

  if [ ! -e "$source_path" ]; then
    echo "WARNING: Missing template entry: $rel_path"
    return
  fi

  mkdir -p "$(dirname "$target_path")"
  if [ -d "$source_path" ]; then
    cp -R "$source_path" "$target_path"
    return
  fi

  cp "$source_path" "$target_path"
}

is_payload_path() {
  case "$1" in
    .agents/*|.claude/*|.codex/*|.github/*|.vscode/*|_reference/*|brain/*|docs/*|integrations/*|mcp-servers/*|scripts/*|tasks/*|tests/*) return 0 ;;
    .editorconfig|.env.example|.gitattributes|.gitignore|.mcp.json|AGENTS.md|CLAUDE.md|CONTRIBUTING.md|ecosystem.md|orca.yaml|Makefile|PROJECT_SPEC.md|README.md|SECURITY.md|SETUP_GUIDE.md|upgrade-project.sh) return 0 ;;
    *) return 1 ;;
  esac
}

is_excluded_payload_path() {
  case "$1" in
    .claude/settings.local.json|.github/workflows/release-template.yml|brain/.obsidian/*|brain/01-daily/*|brain/03-knowledge/research/*|brain/03-knowledge/audits/*|tasks/.current.md.bak|tasks/audit/*|tasks/debug-recovery-log.md|tasks/template-production-ready-plan.md|tasks/toolchain-discovery.json|tasks/toolchain-change-strategy.json|tasks/change-strategy.json|mcp-servers/context-router/node_modules/*|mcp-servers/context-router/dist/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_starter_override_path() {
  case "$1" in
    tasks/current.md|tasks/goal.md|tasks/.research-cache.md|tasks/lessons.md) return 0 ;;
    *) return 1 ;;
  esac
}

copy_starter_overrides() {
  local starter_root="$SCRIPT_DIR/templates/project-starter"
  [ -d "$starter_root" ] || return

  local source_rel
  while IFS= read -r source_rel; do
    [ -n "$source_rel" ] || continue
    [[ "$source_rel" == templates/project-starter/* ]] || continue
    local starter_file="$SCRIPT_DIR/$source_rel"
    [ -f "$starter_file" ] || continue
    local rel_path="${source_rel#templates/project-starter/}"
    local target_path="$PROJECT_DIR/$rel_path"
    mkdir -p "$(dirname "$target_path")"
    cp "$starter_file" "$target_path"
    COPIED_FILES+=("$rel_path")
  done < <(cd "$SCRIPT_DIR" && git ls-files -- templates/project-starter)
}

copy_template_payload() {
  mkdir -p "$PROJECT_DIR"

  local rel_path=""
  declare -A payload_files=()
  local copy_files=()
  COPIED_FILES=()

  # Ship only tracked files so maintainer-local artifacts cannot leak into child projects.
  while IFS= read -r rel_path; do
    [ -n "$rel_path" ] || continue
    payload_files["$rel_path"]=1
  done < <(cd "$SCRIPT_DIR" && git ls-files)

  for rel_path in "${!payload_files[@]}"; do
    if is_payload_path "$rel_path" &&
      ! is_excluded_payload_path "$rel_path" &&
      ! is_starter_override_path "$rel_path"; then
      copy_files+=("$rel_path")
    fi
  done

  # Copy the tracked payload in one process when Node.js is available. The
  # per-file mkdir/cp path is prohibitively slow under Windows/Git Bash.
  if command -v node >/dev/null 2>&1; then
    local node_source_root="$SCRIPT_DIR"
    local node_target_root
    node_target_root="$(cd "$PROJECT_DIR" && pwd)"
    if command -v cygpath >/dev/null 2>&1; then
      node_source_root="$(cygpath -w "$node_source_root")"
      node_target_root="$(cygpath -w "$node_target_root")"
    fi
    node -e '
      const fs = require("node:fs");
      const path = require("node:path");
      const [sourceRoot, targetRoot, ...files] = process.argv.slice(1);
      for (const file of files) {
        const source = path.join(sourceRoot, file);
        const target = path.join(targetRoot, file);
        if (!fs.existsSync(source)) {
          throw new Error(`Tracked template entry is missing: ${file}`);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
    ' -- "$node_source_root" "$node_target_root" "${copy_files[@]}"
    COPIED_FILES+=("${copy_files[@]}")
  else
    for rel_path in "${copy_files[@]}"; do
      copy_entry "$rel_path"
      COPIED_FILES+=("$rel_path")
    done
  fi

  copy_starter_overrides
  printf '%s\0' "${COPIED_FILES[@]}" > "$PROJECT_DIR/.setup-copy-receipt"
}

# Parse flags and project name
IS_ORCHESTRATOR=false
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --orchestrator) IS_ORCHESTRATOR=true; shift ;;
    *) POSITIONAL_ARGS+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL_ARGS[@]}"

# Check dependencies
if ! command -v git >/dev/null 2>&1; then
    echo "ERROR: git is not installed. Please install git first."
    exit 1
fi

# Get project name
if [ -n "${1:-}" ]; then
    PROJECT_NAME="$1"
else
    read -rp "Enter project name: " PROJECT_NAME
fi

if [ -z "$PROJECT_NAME" ]; then
    echo "ERROR: Project name cannot be empty."
    exit 1
fi

# Sanitize name
PROJECT_DIR="${PROJECT_NAME// /-}"
PROJECT_DIR="${PROJECT_DIR,,}"

if [ -d "$PROJECT_DIR" ]; then
    echo "ERROR: Directory '$PROJECT_DIR' already exists."
    exit 1
fi

echo "Creating project: $PROJECT_DIR"

# Capture template remote BEFORE changing to project directory
TEMPLATE_REMOTE=$(cd "$SCRIPT_DIR" && git remote get-url origin 2>/dev/null || echo "")

# Copy the project-facing payload explicitly so local fixtures and maintainer-only files never leak.
copy_template_payload

# A maintainer smoke test may provide a temporary source index so uncommitted
# candidate files are included. Never carry that source index into the new
# project's `git init` or manifest/commit operations.
unset GIT_INDEX_FILE

cd "$PROJECT_DIR"

# Create project-local settings (never touched by template sync)
if [ ! -f .claude/settings.local.json ]; then
  cp .claude/settings.local.json.example .claude/settings.local.json 2>/dev/null || true
fi

# Remove template git history
rm -rf .git

# Materialize orchestrator-owned project state before hashing or committing it.
# The generated manifest and initial commit must describe the actual checkout.
if [ "$IS_ORCHESTRATOR" = true ]; then
  echo "Setting up as ORCHESTRATOR project..."
  ORCH_TEMPLATE="$SCRIPT_DIR/templates/orchestrator/CLAUDE.md"
  if [ -f "$ORCH_TEMPLATE" ]; then
    cp "$SCRIPT_DIR/CLAUDE.md" CLAUDE.md
    printf '\n' >> CLAUDE.md
    cat "$ORCH_TEMPLATE" >> CLAUDE.md
    echo "Shared contract and orchestrator CLAUDE.md overlay installed"
  fi
  mkdir -p tasks/chats brain
  echo "Orchestrator directories created"
fi

# Generate template manifest from the exact successful copy receipt
node scripts/lib/setup-manifest.js --receipt .setup-copy-receipt --source "$SCRIPT_DIR"

# Initialize new git repo
git init

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true
git update-index --chmod=+x scripts/check-drift.sh 2>/dev/null || true

# Create initial commit
git add -A
git config user.name >/dev/null 2>&1 || git config user.name "Agent Project Template"
git config user.email >/dev/null 2>&1 || git config user.email "template@localhost.invalid"
git commit -m "chore: initialize project from agent-project-template v$TEMPLATE_VERSION"

# Test hooks compatibility
if [ -f scripts/test-hooks.sh ]; then
  echo "Testing hooks compatibility..."
  bash scripts/test-hooks.sh || echo "WARNING: Some hooks may need adjustment."
fi

# Store template origin for future updates
if [ -n "$TEMPLATE_REMOTE" ]; then
    git remote add template "$TEMPLATE_REMOTE" 2>/dev/null || true
    echo "Template remote added: $TEMPLATE_REMOTE"
    echo "Run the target release's native sync-template.js with an exact tag and external --plan-file."
    echo "Apply only by rerunning the same command with --apply after reviewing the plan."
  fi

echo ""
echo "Project '$PROJECT_DIR' created successfully."
echo "Shared writing library discovery (read-only; no books copied):"
node scripts/writing-library.js discover || echo "Writing source grounding is blocked until the shared machine library is available."
echo "Authorized private-library users: node scripts/writing-library.js provision (requires your gh account access)."
echo ""
if [ "$IS_ORCHESTRATOR" = true ]; then
  echo "Next steps:"
  echo "  1. cd $PROJECT_DIR"
  echo "  2. Run: bash scripts/bootstrap-mcp.sh --install --tool-profile=full"
  echo "  3. Open and trust the project in Codex; use it as the orchestrator workspace"
  echo "  4. Restart Codex, then verify the project MCPs with: codex mcp list"
else
  echo "Next steps:"
  echo "  1. cd $PROJECT_DIR"
  echo "  2. Run: bash scripts/bootstrap-mcp.sh --install --tool-profile=full"
  echo "  3. Open and trust the project in Codex, then run the project setup workflow"
  echo "  4. Restart Codex, then verify the project MCPs with: codex mcp list"
fi
echo ""
echo "Included: shared agent rules, hooks, MCP bootstrap, sync tooling, task memory, and docs scaffolding"
