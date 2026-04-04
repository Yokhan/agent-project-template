# n8n Pipeline Automation

Visual workflow automation for agent template. Claude triggers pipelines via MCP, n8n triggers Claude via `claude -p`.

## Quick Start

```bash
bash n8n/setup.sh    # install n8n, create config, import workflows
bash n8n/start.sh    # start n8n (separate terminal)
```

First time: open http://localhost:5678, create account, get API key, add to `.env`.

## Pipelines

| Pipeline | Webhook | Trigger | Uses Claude? |
|----------|---------|---------|-------------|
| Health Check | `/webhook/health` | MCP / manual | no |
| Project Scanner | `/webhook/scan` | MCP / manual | no |
| Template Sync | `/webhook/sync` | MCP | no |
| Drift Alert | `/webhook/drift-alert` | Cron 9AM / manual | no |
| Daily Briefing | `/webhook/briefing` | Cron 9AM / manual | **yes** (`claude -p`) |

## Two-Way Communication

```
Claude Code ──MCP──→ run_pipeline("health") ──→ n8n webhook ──→ result
n8n ──cron──→ claude -p "daily briefing" ──→ Claude CLI ──→ result
```

## ToS Note

`claude -p` is the official Claude Code CLI. Calling it from n8n is equivalent to typing in terminal — NOT third-party API access. Keep automated calls **moderate** (1-3/day for briefings, not mass automation). Heavy work should use bash scripts that don't invoke Claude.

## Config

`n8n/config.json` (created by setup.sh):
```json
{
  "project_root": "/path/to/this/project",
  "documents_dir": "/path/to/Documents"
}
```

Workflows read paths from this file — no hardcoded paths.

## Adding Custom Pipelines

1. Create workflow in n8n UI (http://localhost:5678)
2. Export: workflow menu → Export
3. Save to `n8n/workflows/your-pipeline.json`
4. Claude calls: `run_pipeline(name="your-webhook-path")`

## Requirements

- Node.js 18+
- `npm install -g n8n`
- `NODE_FUNCTION_ALLOW_BUILTIN=child_process` (set by start.sh / .n8n/.env)
