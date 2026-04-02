#!/bin/bash
# Scan Project — populate tool-registry.md from existing codebase
# shellcheck source=lib/platform.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$SCRIPT_DIR/lib/platform.sh" ] && source "$SCRIPT_DIR/lib/platform.sh"
# Usage:
#   bash scripts/scan-project.sh          # scan + populate registry
#   bash scripts/scan-project.sh --report # dry-run, no writes

MODE="full"
[ "$1" = "--report" ] && MODE="report"

REGISTRY="_reference/tool-registry.md"

echo "=== Project Scanner ==="

# --- 1. Detect stack ---
STACK="unknown"
STACK_FILE=""
if [ -f package.json ]; then
  STACK="js/ts"; STACK_FILE="package.json"
elif [ -f tsconfig.json ]; then
  STACK="js/ts"; STACK_FILE="tsconfig.json"
elif [ -f requirements.txt ]; then
  STACK="python"; STACK_FILE="requirements.txt"
elif [ -f pyproject.toml ]; then
  STACK="python"; STACK_FILE="pyproject.toml"
elif [ -f go.mod ]; then
  STACK="go"; STACK_FILE="go.mod"
elif [ -f Cargo.toml ]; then
  STACK="rust"; STACK_FILE="Cargo.toml"
fi
echo "Stack: $STACK (detected via $STACK_FILE)"

# --- 2. Find source directories ---
SRC_DIRS=""
for d in src lib app packages; do
  [ -d "$d" ] && SRC_DIRS="$SRC_DIRS $d"
done
echo "Source dirs: ${SRC_DIRS:-(none)}"

# --- 3. Find shared utilities ---
echo ""
echo "[1/5] Scanning shared utilities..."
SHARED_UTILS=()

for shared_name in shared utils helpers common lib core; do
  for root in $SRC_DIRS .; do
    dir="$root/$shared_name"
    [ -d "$dir" ] || continue
    while IFS= read -r f; do
      # Get exported function/class names
      basename_f=$(basename "$f")
      ext="${basename_f##*.}"

      case "$ext" in
        ts|tsx|js|jsx)
          exports=$(grep -E "^export (default )?(function|const|class|type|interface|enum) " "$f" 2>/dev/null | \
            sed -E 's/^export (default )?(function|const|let|class|type|interface|enum) ([a-zA-Z0-9_]+).*/\3/' | head -5)
          ;;
        py)
          exports=$(grep -E "^(def |class )" "$f" 2>/dev/null | \
            sed -E 's/^(def |class )([a-zA-Z0-9_]+).*/\2/' | head -5)
          ;;
        go)
          exports=$(grep -E "^func [A-Z]" "$f" 2>/dev/null | \
            sed -E 's/^func ([A-Za-z0-9_]+).*/\1/' | head -5)
          ;;
        rs)
          exports=$(grep -E "^pub (fn|struct|enum|trait) " "$f" 2>/dev/null | \
            sed -E 's/^pub (fn|struct|enum|trait) ([a-zA-Z0-9_]+).*/\2/' | head -5)
          ;;
      esac

      for exp in $exports; do
        # Count importers
        importers=0
        case "$ext" in
          ts|tsx|js|jsx)
            importers=$(grep -rl "$exp" $SRC_DIRS --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -cv "$f" || echo 0)
            ;;
          py)
            importers=$(grep -rl "import.*$exp" $SRC_DIRS --include="*.py" 2>/dev/null | grep -cv "$f" || echo 0)
            ;;
        esac
        echo "  $f: $exp (used by $importers files)"
        SHARED_UTILS+=("$exp|$f|$importers")
      done
    done < <(find "$dir" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \) -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null)
  done
done

# --- 4. Find scripts ---
echo ""
echo "[2/5] Scanning scripts..."
SCRIPTS=()

for script_dir in scripts bin tools; do
  [ -d "$script_dir" ] || continue
  for f in "$script_dir"/*.sh "$script_dir"/*.py "$script_dir"/*.js; do
    [ -f "$f" ] || continue
    # Get first comment line as purpose
    purpose=$(head -5 "$f" | grep -E "^#|^//|^\"\"\"" | head -1 | sed 's/^[# \/"]*//' | head -c 60)
    echo "  $f: $purpose"
    SCRIPTS+=("$(basename "$f" | sed 's/\.[^.]*$//')|$f|$purpose")
  done
done

# --- 5. Find components (React/Vue/Svelte) ---
echo ""
echo "[3/5] Scanning components..."
COMPONENTS=()

for comp_dir in components ui widgets; do
  for root in $SRC_DIRS; do
    dir="$root/$comp_dir"
    [ -d "$dir" ] || continue
    find "$dir" -maxdepth 2 -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" \) -not -name "*.test.*" -not -name "*.spec.*" -not -name "*.stories.*" 2>/dev/null | while read -r f; do
      name=$(basename "$f" | sed 's/\.[^.]*$//')
      echo "  $f: $name"
      COMPONENTS+=("$name|$f")
    done
  done
done

# --- 6. Find design tokens ---
echo ""
echo "[4/5] Scanning design tokens..."
HAS_DESIGN=false

for token_dir in design-tokens tokens styles theme; do
  if [ -d "$token_dir" ]; then
    HAS_DESIGN=true
    echo "  Found: $token_dir/"
    find "$token_dir" -type f 2>/dev/null | head -10 | while read -r f; do
      echo "    $f"
    done
  fi
done

# Check for Figma config
for figma_file in .figma figma.config.js figma.config.ts; do
  if [ -f "$figma_file" ]; then
    HAS_DESIGN=true
    echo "  Found: $figma_file"
  fi
done

# --- 7. Count entry points ---
echo ""
echo "[5/5] Scanning module entry points..."
MODULES=0
for root in $SRC_DIRS; do
  if [ -d "$root/features" ]; then
    find "$root/features" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | while read -r m; do
      name=$(basename "$m")
      has_entry=false
      for entry in "$m"/index.* "$m"/__init__.py "$m"/mod.rs; do
        [ -f "$entry" ] && has_entry=true && break
      done
      echo "  $name ($m) — entry: $has_entry"
      MODULES=$((MODULES + 1))
    done
  fi
done

# --- Summary ---
echo ""
echo "=== Scan Summary ==="
echo "Stack: $STACK"
echo "Shared utils: ${#SHARED_UTILS[@]} functions found"
echo "Scripts: ${#SCRIPTS[@]} found"
echo "Design tokens: $HAS_DESIGN"

if [ "$MODE" = "report" ]; then
  echo ""
  echo "(report mode — no changes written)"
  echo "Run without --report to update _reference/tool-registry.md"
  exit 0
fi

# --- Update registry ---
if [ ! -f "$REGISTRY" ]; then
  echo "WARNING: $REGISTRY not found. Run setup-project first."
  exit 1
fi

# Update last scan date
if grep -q "^_Last scan:" "$REGISTRY" 2>/dev/null; then
  if command -v _sed_i &>/dev/null; then
    _sed_i "s/^_Last scan:.*/_Last scan: $(date +%Y-%m-%d)_/" "$REGISTRY"
  else
    sed -i "s/^_Last scan:.*/_Last scan: $(date +%Y-%m-%d)_/" "$REGISTRY" 2>/dev/null || true
  fi
fi

echo ""
echo "Registry timestamp updated. Review scan output and add entries to $REGISTRY."
echo "For automated duplicate detection, run: bash scripts/audit-reuse.sh"
