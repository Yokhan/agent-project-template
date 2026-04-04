# n8n Pipeline Automation

Visual workflow automation for agent template. Claude triggers pipelines via MCP, you see them on n8n map.

## Quick Start

```bash
bash n8n/start.sh              # start n8n + auto-import workflows
# Open http://localhost:5678   # create account, get API key
# Add to .env: N8N_API_KEY=your_key
bash n8n/import.sh             # import all workflows
```

## Pipelines

| Pipeline | Webhook | Trigger | What it does |
|----------|---------|---------|-------------|
| Health Check | `/webhook/health` | MCP / manual | drift check + git status + services |
| Template Sync | `/webhook/sync` | MCP | sync template to target project |
| Project Scanner | `/webhook/scan` | MCP / manual | scan ~/Documents for all repos, classify activity |
| Drift Alert | `/webhook/drift-alert` | Cron 9AM daily | check all agent projects, alert on issues |

## MCP Tools (from Claude Code)

```
run_pipeline(name="health")                              → health check
run_pipeline(name="scan")                                → scan all projects
run_pipeline(name="sync", params={project: "/path/to"})  → sync template
run_pipeline(name="drift-alert")                         → manual drift check
list_pipelines()                                         → list active workflows
pipeline_status(execution_id="...")                       → check execution
```

## Requirements

- `npm install -g n8n` (done by bootstrap-mcp.sh)
- `NODE_FUNCTION_ALLOW_BUILTIN=child_process` (set by start.sh)
- API key in `.env` as `N8N_API_KEY`

## Adding Custom Pipelines

1. Create workflow in n8n UI (http://localhost:5678)
2. Export as JSON: Settings → Export
3. Save to `n8n/workflows/your-pipeline.json`
4. Claude calls: `run_pipeline(name="your-webhook-path")`
