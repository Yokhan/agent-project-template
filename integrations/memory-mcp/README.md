# Memory MCP Integration

Persistent memory across Claude Code sessions. Required for full template functionality.

## Engram (REQUIRED — Default Memory Backend)

Zero-dependency Go binary. Single file, SQLite + FTS5. All template features depend on this.

### Auto-Install (recommended)

```bash
bash scripts/bootstrap-mcp.sh --install
```

This detects your OS/architecture, downloads the binary, and configures `.mcp.json`.

### Manual Install

1. Download binary from [GitHub Releases](https://github.com/Gentleman-Programming/engram/releases)
2. Place in PATH (`~/.local/bin/` or project root)
3. Add to Claude Code:
   ```
   claude mcp add engram -- engram mcp
   ```

### For Zed AI Chat Panel

Zed uses `context_servers` in its own settings.json, NOT `.mcp.json`.

```bash
bash scripts/bootstrap-mcp.sh --install --zed
```

Or manually add to Zed settings.json (`~/.config/zed/settings.json` on Linux/Mac, `%APPDATA%/Zed/settings.json` on Windows):

```json
{
  "context_servers": {
    "engram": {
      "command": {
        "path": "engram",
        "args": ["mcp"]
      }
    }
  }
}
```

### Tools Available
- `mem_save(topic_key, content)` — save structured memory
- `mem_search(query)` — full-text search
- `mem_session_start/end` — session lifecycle
- `mem_update/delete` — manage observations

### Storage
- `~/.engram/engram.db` (SQLite)
- Git sync: `engram sync` for cross-machine transfer

### Verify

```bash
bash scripts/bootstrap-mcp.sh --check
```

### Fallback (when Engram is unavailable)

Template degrades gracefully: memory operations write to `tasks/.memory-fallback.md` instead. When Engram becomes available, entries are imported. See `.claude/skills/memory-router/SKILL.md`.

---

## Deprecated Options

The following were previously supported but are now deprecated. The bootstrap script auto-disables them if found.

| Server | Status | Reason |
|--------|--------|--------|
| claude-memory-mcp | DEPRECATED | Engram covers all use cases with simpler setup |
| MemCP | DEPRECATED | Complex, Node.js dependency, Engram preferred |
| Anima | DEPRECATED | Not actively maintained |

If you have these configured, `bootstrap-mcp.sh` will set `"disabled": true` on them (never removes, preserves config).

---

## After Installing

Run health check:
```bash
bash scripts/bootstrap-mcp.sh --check
```

The session-start hook will warn if Engram is configured but not responding.
