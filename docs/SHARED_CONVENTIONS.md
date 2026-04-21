# Shared Conventions (Agent-Agnostic)

> These conventions apply to ALL agents (Claude Code, Codex, future agents).
> Referenced by both `CLAUDE.md` and `AGENTS.md`.

## Functions-in-Modules Pattern

All business logic lives in importable modules. Entry points only import and call.

### Rules

1. **Entry points** (`main.py`, `index.ts`, `cli.go`, `app.ts`, `run.sh`) contain ONLY:
   - Argument/config parsing
   - Imports from modules
   - Function calls
   - Process exit handling

2. **Modules** contain all business logic:
   - Pure functions preferred (same input → same output)
   - Side effects isolated at module boundaries
   - Each module is independently testable via import

3. **Threshold**: If an entry point exceeds **30 lines** of non-import code → extract logic to a module.

### Why

- **Testability**: Test business logic by importing — no need to spawn a process
- **Reusability**: Same logic callable from CLI, API, script, or test
- **Readability**: Entry point reads like a table of contents
- **Agent-agnostic**: Both Claude and Codex produce consistent structure

### Examples

**Bad** — logic in entry point:
```python
# main.py
import sys
import json

data = json.load(open(sys.argv[1]))
results = []
for item in data:
    if item["status"] == "active":
        score = item["value"] * 0.85 + item["bonus"]
        if score > 100:
            results.append({"id": item["id"], "score": score})
# ... 50 more lines of business logic
print(json.dumps(results))
```

**Good** — logic in module, entry point calls:
```python
# main.py
import sys
from scoring import process_items, format_output

def main():
    data = json.load(open(sys.argv[1]))
    results = process_items(data)
    print(format_output(results))

if __name__ == "__main__":
    main()
```

### Enforcement

Both agents check before presenting implementation:
- Does the entry point contain business logic beyond imports + calls?
- If yes → refactor before proceeding.

## File Encoding

**ALL text files MUST be UTF-8 without BOM.** This is non-negotiable.

### Rules

1. **Never write files in Windows-1251, latin1, CP1252, or any non-UTF-8 encoding**
2. **No UTF-8 BOM** (`EF BB BF`) — causes parser issues in many tools
3. **Russian text is expected** — this is a bilingual project (EN/RU). Кириллица must stay intact
4. **Line endings**: LF (`\n`) preferred. CRLF tolerated on Windows but never mixed within a file

### Enforcement

Post-write hook validates encoding. If a file is written in wrong encoding, the hook warns immediately.
Both agents: before writing a file with non-ASCII content, ensure your output is UTF-8.

## Entry Point Naming Convention

| Language | Entry point | Convention |
|----------|------------|------------|
| Python | `main.py`, `cli.py`, `app.py` | `if __name__ == "__main__": main()` |
| TypeScript/JS | `index.ts`, `main.ts`, `cli.ts` | Named exports + top-level call |
| Go | `main.go`, `cmd/*.go` | `func main()` calls into `internal/` |
| Rust | `main.rs`, `bin/*.rs` | `fn main()` calls lib functions |
| Bash | `run.sh`, `cli.sh` | Source lib functions, call them |
