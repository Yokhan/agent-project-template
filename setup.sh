#!/usr/bin/env bash
# setup.sh — Create a new agent-ready project from this template
# Usage: ./setup.sh [--orchestrator] [project-name]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_VERSION=$(sed -n 's/.*Template Version: \([0-9.]*\).*/\1/p' "$SCRIPT_DIR/AGENTS.md" 2>/dev/null | head -n 1)
[ -n "$TEMPLATE_VERSION" ] || TEMPLATE_VERSION="3.6.0"

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
    .claude/*|.codex/*|.github/*|.vscode/*|_reference/*|brain/*|docs/*|integrations/*|mcp-servers/*|scripts/*|tasks/*|tests/*) return 0 ;;
    .editorconfig|.env.example|.gitattributes|.gitignore|.mcp.json|AGENTS.md|CLAUDE.md|CONTRIBUTING.md|ecosystem.md|Makefile|PROJECT_SPEC.md|README.md|SECURITY.md|SETUP_GUIDE.md|upgrade-project.sh) return 0 ;;
    *) return 1 ;;
  esac
}

is_excluded_payload_path() {
  case "$1" in
    .claude/settings.local.json|brain/.obsidian/*|brain/01-daily/*|brain/03-knowledge/research/*|brain/03-knowledge/audits/*|tasks/.current.md.bak|tasks/audit/*|tasks/debug-recovery-log.md|tasks/template-production-ready-plan.md|mcp-servers/context-router/node_modules/*|mcp-servers/context-router/dist/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_starter_override_path() {
  case "$1" in
    tasks/current.md|tasks/.research-cache.md|tasks/lessons.md) return 0 ;;
    *) return 1 ;;
  esac
}

copy_starter_overrides() {
  local starter_root="$SCRIPT_DIR/templates/project-starter"
  [ -d "$starter_root" ] || return

  while IFS= read -r -d '' starter_file; do
    local rel_path="${starter_file#$starter_root/}"
    local target_path="$PROJECT_DIR/$rel_path"
    mkdir -p "$(dirname "$target_path")"
    cp "$starter_file" "$target_path"
  done < <(find "$starter_root" -type f -print0)
}

copy_template_payload() {
  mkdir -p "$PROJECT_DIR"

  local rel_path=""
  declare -A payload_files=()

  # Ship only tracked files so maintainer-local artifacts cannot leak into child projects.
  while IFS= read -r rel_path; do
    [ -n "$rel_path" ] || continue
    payload_files["$rel_path"]=1
  done < <(cd "$SCRIPT_DIR" && git ls-files)

  for rel_path in "${!payload_files[@]}"; do
    if is_payload_path "$rel_path" &&
      ! is_excluded_payload_path "$rel_path" &&
      ! is_starter_override_path "$rel_path"; then
      copy_entry "$rel_path"
    fi
  done

  copy_starter_overrides
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

cd "$PROJECT_DIR"

# Create project-local settings (never touched by template sync)
if [ ! -f .claude/settings.local.json ]; then
  cp .claude/settings.local.json.example .claude/settings.local.json 2>/dev/null || true
fi

# Remove template git history
rm -rf .git

# Generate template manifest
generate_manifest() {
  local manifest=".template-manifest.json"
  local today
  today=$(date +%Y-%m-%d)

  # Determine hash command
  local hash_cmd
  if command -v sha256sum >/dev/null 2>&1; then
    hash_cmd="sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    hash_cmd="shasum -a 256"
  else
    echo "WARNING: No SHA-256 tool found. Skipping manifest generation."
    return
  fi

  get_hash() {
    $hash_cmd "$1" | awk '{print $1}'
  }

  get_category() {
    local fpath="$1"
    case "$fpath" in
      .codex/*) echo "template" ;;
      .claude/settings.json) echo "template" ;;
      .claude/settings.local.json.example) echo "template" ;;
      .claude/rules/*.md) echo "template" ;;
      .claude/docs/*.md) echo "template" ;;
      .claude/docs/domain-full/*.md) echo "template" ;;
      .claude/library/process/*.md) echo "template" ;;
      .claude/library/technical/*.md) echo "template" ;;
      .claude/library/meta/*.md) echo "template" ;;
      .claude/library/domain/*.md) echo "template" ;;
      .claude/library/conflict/*.md) echo "template" ;;
      .claude/agents/*.md) echo "template" ;;
      .claude/skills/*/SKILL.md) echo "template" ;;
      .claude/commands/*.md) echo "template" ;;
      .claude/hooks/*.sh) echo "template" ;;
      .claude/pipelines/*.md) echo "template" ;;
      scripts/*.sh) echo "template" ;;
      scripts/lib/*.sh) echo "template" ;;
      mcp-servers/context-router/package-lock.json) echo "template" ;;
      mcp-servers/context-router/src/*.ts) echo "template" ;;
      mcp-servers/context-router/package.json) echo "template" ;;
      mcp-servers/context-router/tsconfig.json) echo "template" ;;
      tests/rules/*.test.md) echo "template" ;;
      _reference/*.md) echo "template" ;;
      .github/*) echo "template" ;;
      .github/workflows/*.yml) echo "template" ;;
      .editorconfig) echo "template" ;;
      .env.example) echo "template" ;;
      .gitattributes) echo "template" ;;
      Makefile) echo "template" ;;
      SECURITY.md) echo "template" ;;
      CONTRIBUTING.md) echo "template" ;;
      README.md) echo "template" ;;
      SETUP_GUIDE.md) echo "template" ;;
      upgrade-project.sh) echo "template" ;;
      AGENTS.md) echo "template" ;;
      CLAUDE.md) echo "project" ;;
      PROJECT_SPEC.md) echo "project" ;;
      ecosystem.md) echo "project" ;;
      tasks/*) echo "project" ;;
      brain/*) echo "project" ;;
      .gitignore) echo "hybrid" ;;
      .mcp.json) echo "hybrid" ;;
      .vscode/extensions.json) echo "hybrid" ;;
      *) echo "" ;;
    esac
  }

  # Collect all files that belong in the manifest
  local files=()
  local patterns=(
    ".codex/config.toml"
    ".codex/hooks.json"
    ".claude/settings.json"
    ".claude/settings.local.json.example"
    ".claude/rules/"*.md
    ".claude/docs/"*.md
    ".claude/docs/domain-full/"*.md
    ".claude/library/process/"*.md
    ".claude/library/technical/"*.md
    ".claude/library/meta/"*.md
    ".claude/library/domain/"*.md
    ".claude/library/conflict/"*.md
    ".claude/agents/"*.md
    ".claude/skills/"*/SKILL.md
    ".claude/commands/"*.md
    ".claude/hooks/"*.sh
    ".claude/pipelines/"*.md
    "scripts/"*.sh
    "scripts/lib/"*.sh
    "mcp-servers/context-router/package-lock.json"
    "mcp-servers/context-router/src/"*.ts
    "mcp-servers/context-router/package.json"
    "mcp-servers/context-router/tsconfig.json"
    "tests/rules/"*.test.md
    "_reference/"*.md
    ".github/"*.template
    ".github/workflows/"*.yml
    ".editorconfig"
    ".env.example"
    ".gitattributes"
    "Makefile"
    "SECURITY.md"
    "CONTRIBUTING.md"
    "README.md"
    "SETUP_GUIDE.md"
    "upgrade-project.sh"
    "AGENTS.md"
    "CLAUDE.md"
    "PROJECT_SPEC.md"
    "ecosystem.md"
    ".mcp.json"
    ".gitignore"
    ".vscode/extensions.json"
  )

  # Add pattern-matched files
  for pattern in "${patterns[@]}"; do
    for f in $pattern; do
      [ -f "$f" ] && files+=("$f")
    done
  done

  # Add tasks/* and brain/* recursively
  if [ -d "tasks" ]; then
    while IFS= read -r -d '' f; do
      files+=("$f")
    done < <(find tasks -type f -print0 2>/dev/null)
  fi
  if [ -d "brain" ]; then
    while IFS= read -r -d '' f; do
      files+=("$f")
    done < <(find brain -type f -print0 2>/dev/null)
  fi

  # Build JSON
  {
    printf '{\n'
    printf '  "template_version": "%s",\n' "$TEMPLATE_VERSION"
    printf '  "template_remote": "%s",\n' "$TEMPLATE_REMOTE"
    printf '  "created": "%s",\n' "$today"
    printf '  "updated": "%s",\n' "$today"
    printf '  "files": {\n'

    local first=true
    for f in "${files[@]}"; do
      local cat
      cat=$(get_category "$f")
      [ -z "$cat" ] && continue
      local hash
      hash=$(get_hash "$f")
      if [ "$first" = true ]; then
        first=false
      else
        printf ',\n'
      fi
      printf '    "%s": { "category": "%s", "hash": "%s" }' "$f" "$cat" "$hash"
    done

    printf '\n  }\n'
    printf '}\n'
  } > "$manifest"

  echo "Generated $manifest"
}

generate_manifest

# Initialize new git repo
git init

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true
git update-index --chmod=+x scripts/check-drift.sh 2>/dev/null || true

# Create initial commit
git add -A
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
    echo "Run 'bash scripts/sync-template.sh --from-git' to check for updates."
fi

# If orchestrator — replace CLAUDE.md with orchestrator template
if [ "$IS_ORCHESTRATOR" = true ]; then
  echo "Setting up as ORCHESTRATOR project..."
  ORCH_TEMPLATE="$SCRIPT_DIR/templates/orchestrator/CLAUDE.md"
  if [ -f "$ORCH_TEMPLATE" ]; then
    cp "$ORCH_TEMPLATE" CLAUDE.md
    echo "Orchestrator CLAUDE.md installed"
  fi
  mkdir -p tasks/chats brain
  echo "Orchestrator directories created"
fi

echo ""
echo "Project '$PROJECT_DIR' created successfully."
echo ""
if [ "$IS_ORCHESTRATOR" = true ]; then
  echo "Next steps:"
  echo "  1. cd $PROJECT_DIR"
  echo "  2. Run: bash scripts/bootstrap-mcp.sh --install"
  echo "  3. Open the project in Claude Code or Zed and use it as the orchestrator workspace"
else
  echo "Next steps:"
  echo "  1. cd $PROJECT_DIR"
  echo "  2. Run: bash scripts/bootstrap-mcp.sh --install"
  echo "  3. Open in Claude Code or Zed and run /setup-project"
fi
echo ""
echo "Included: shared agent rules, hooks, MCP bootstrap, sync tooling, task memory, and docs scaffolding"
