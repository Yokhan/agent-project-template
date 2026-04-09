# CodeSight Integration (Optional)

Generates compact codebase knowledge indexes from AST analysis. ~200 tokens instead of ~47K tokens of exploration.

## Setup

1. **Generate index**: `npx codesight` (creates `CODESIGHT.md`)
2. **Knowledge mode** (for Obsidian/ADRs): `npx codesight --mode knowledge` (creates `KNOWLEDGE.md`)
3. **Wiki mode**: `npx codesight --wiki` (creates `.codesight/wiki/` with domain articles)
4. **Auto-regen on commit**: `npx codesight --hook`

## MCP Server (live queries)

Enable in `.mcp.json` by setting `"disabled": false` for the `codesight` entry.

Available tools when running as MCP server (`npx codesight --mcp`):
- `codesight_get_summary` — project overview (~500 tokens)
- `codesight_get_routes` — all API routes with methods, params, middleware
- `codesight_get_schema` — database models with fields, relations, constraints
- `codesight_get_blast_radius` — impact analysis for a given file
- `codesight_get_hot_files` — most-imported modules (high blast radius)
- `codesight_get_graph` — dependency graph
- `codesight_get_wiki_index` — wiki article catalog (~200 tokens)
- `codesight_get_wiki_article` — specific domain article (auth, database, etc.)
- `codesight_lint_wiki` — check wiki freshness
- `codesight_scan` — full live scan
- `codesight_refresh` — force re-scan

## Integration with Template

- **context-first.md**: at session start, `codesight_get_summary` can replace manual PROJECT_SPEC.md scanning
- **research-first.md**: `codesight_get_blast_radius` and `codesight_get_hot_files` provide impact analysis without manual Grep
- **brain/ indexing**: `--mode knowledge` scans Obsidian vaults and generates structured knowledge index

## When to Use

- Web app projects with routes, schemas, UI components — full value
- Libraries without routes/schemas — limited to import graph and hot files
- Non-code projects — use `--mode knowledge` for markdown/ADR indexing
- Large monorepos (150K+ lines) — may produce noisy output, use with caution

## Source
- GitHub: https://github.com/Houseofmvps/codesight (MIT, 726 stars)
- Zero runtime dependencies, uses TypeScript compiler API for AST
