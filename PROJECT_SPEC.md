# Project Spec — Agent OS

> Agent-project-template: AI agent framework + Command Center desktop app.

## What Is This

Desktop command center (Tauri + Preact) for managing 21 AI-agent projects.
Orchestrator (PA) delegates tasks to project agents, tracks progress, enforces quality through template rules.

## Stack

- **Language**: Rust (backend), JavaScript/Preact (frontend)
- **Framework**: Tauri 2.x (desktop), Preact + HTM + Signals (UI)
- **Database**: JSON files (tasks/chats/*.jsonl, .strategies.json, .delegations.json)
- **Key deps**: tokio, reqwest, serde_json, regex, chrono, dirs

## File Structure

```
desktop/
  src-tauri/src/
    commands/
      agents.rs      — project scanning, segments
      chat.rs        — orchestrator + project chat, streaming, delegation parsing
      config.rs      — permissions, settings, modules, health, actions
      delegation.rs  — approve/reject/execute delegated tasks
      feed.rs        — activity feed, digest, project plans
      ops.rs         — deploy, health check, queue, attachments, telegram
      proxy.rs       — n8n webhook proxy
      strategy.rs    — goals → strategies → plans → step execution
    state.rs         — AppState, ScanCache, Delegation
    scanner.rs       — git-based project scanner
    lib.rs           — Tauri setup, 40 registered commands
  src-ui/
    index.html       — single-file Preact SPA (~1000 lines)
.claude/
  library/           — rules loaded on-demand by MCP context-router
  agents/            — 10 agent definitions (implementer, reviewer, etc.)
  hooks/             — session-start, session-stop, pre-compact
  commands/          — 23 slash commands
  skills/            — 15+ skills (setup-project, sprint, debug, etc.)
  pipelines/         — feature, bugfix, security-patch
scripts/             — bash automation (sync, scan, check, audit, metrics)
mcp-servers/         — context-router TypeScript MCP server
n8n/                 — config, dashboard assets, workflow JSONs, permissions
tasks/               — current.md, lessons.md, queue.md, goals.md, chats/
```

## Provides

- Desktop app (Tauri binary) with project tiles, chat, delegation, strategy
- Template sync system (sync-template.sh) for deploying rules to projects
- MCP context-router for on-demand rule loading
- 40 Tauri commands for all project operations
- n8n workflow integration (cron, Telegram)

## Depends On

- Claude Code CLI (`claude -p` for headless execution)
- Node.js (MCP servers, n8n)
- Python (scan-projects-fast.py, serve.py fallback)
- Git (project scanning, health checks)
- n8n (optional: cron, Telegram, visual pipelines)

## Module Dependency Map

```
[strategy.rs] → [chat.rs]       (uses run_claude_pub, unique_tmp_pub, get_permission_path_pub)
[strategy.rs] → [scanner.rs]    (reads project list)
[delegation.rs] → [chat.rs]     (uses get_permission_path_pub)
[chat.rs] → [scanner.rs]        (builds orchestrator context from scan cache)
[chat.rs] → [delegation.rs]     (queues delegations from PA response)
[chat.rs] → [ops.rs]            (execute_deploy_inline, execute_health_inline)
[config.rs] → [agents.rs]       (get_agents for settings page)
[all commands] → [state.rs]     (AppState: shared state, caches, config)
[index.html] → [all commands]   (Tauri invoke bridge)
[external: Claude Code] ← [chat.rs, delegation.rs, strategy.rs]
[external: n8n] ← [proxy.rs]
[external: Telegram API] ← [ops.rs send_telegram]
```

## Current State

- **Phase**: MVP / active development
- **Template version**: 3.2.1
- **Desktop version**: 0.2.0
- **Flows**: 21/21 implemented (16 working, 5 need testing)
- **Active work**: Strategy Engine, code review, stabilization

## Last Scan

2026-04-06
