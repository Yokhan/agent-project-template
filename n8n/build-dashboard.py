"""
Build Agent Command Center v3 dashboard.
Assembles HTML + inline JS (office.js) + CSS into dashboard.json workflow.
Usage: python n8n/build-dashboard.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
OFFICE_JS = ROOT / 'n8n' / 'dashboard' / 'office.js'
OUTPUT = ROOT / 'n8n' / 'workflows' / 'dashboard.json'

# Read office.js
office_code = OFFICE_JS.read_text(encoding='utf-8')

# Escape for embedding in JS string (will be inside n8n Code node)
# office.js will be injected directly into <script> tag in HTML

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a15;color:#d0d0e0;font-family:-apple-system,system-ui,sans-serif}
.app{display:grid;grid-template-columns:1fr 380px;grid-template-rows:auto 1fr auto;height:100vh;gap:0}
.top-bar{grid-column:1/-1;padding:12px 20px;background:#0f0f1a;border-bottom:1px solid #1a1a30;display:flex;justify-content:space-between;align-items:center}
.top-bar h1{font-size:1.3em;color:#fff}
.top-bar .meta{color:#555;font-size:.8em}
.office-panel{padding:10px;overflow:hidden;border-right:1px solid #1a1a30;display:flex;flex-direction:column;gap:10px}
.office-panel canvas{border-radius:8px;background:#1a1a2e;width:100%;cursor:default}
.stats{display:flex;gap:8px;flex-wrap:wrap}
.stat{background:#12122a;border:1px solid #1e1e3a;padding:6px 12px;border-radius:6px;text-align:center;flex:1;min-width:60px}
.stat-n{font-size:1.4em;font-weight:700;line-height:1.2}
.stat-l{color:#555;font-size:.7em}
.project-grid{display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;max-height:200px;padding:2px}
.project-card{background:#12122a;border:1px solid #1e1e3a;padding:6px 10px;border-radius:6px;font-size:.75em;cursor:pointer;transition:border-color .2s;min-width:100px}
.project-card:hover{border-color:#3a3a6a}
.project-card .name{font-weight:600;color:#fff}
.project-card .meta{color:#555;margin-top:2px}
.chat-panel{display:flex;flex-direction:column;background:#0d0d1a;border-left:1px solid #1a1a30}
.chat-header{padding:10px 15px;border-bottom:1px solid #1a1a30;display:flex;align-items:center;gap:8px}
.chat-header select{background:#12122a;color:#d0d0e0;border:1px solid #2a2a4a;padding:4px 8px;border-radius:4px;font-size:.85em;flex:1}
.chat-messages{flex:1;overflow-y:auto;padding:10px 15px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:85%;padding:8px 12px;border-radius:10px;font-size:.85em;line-height:1.4;word-wrap:break-word}
.msg.user{align-self:flex-end;background:#1e3a5f;color:#d0e0ff;border-bottom-right-radius:2px}
.msg.bot{align-self:flex-start;background:#1a1a30;color:#c0c0d0;border-bottom-left-radius:2px}
.msg.bot pre{white-space:pre-wrap;font-size:.8em;margin-top:4px;color:#8899aa}
.chat-input{display:flex;gap:6px;padding:10px 15px;border-top:1px solid #1a1a30}
.chat-input input{flex:1;background:#12122a;color:#d0d0e0;border:1px solid #2a2a4a;padding:8px 12px;border-radius:6px;font-size:.85em;outline:none}
.chat-input input:focus{border-color:#3a5a8a}
.chat-input button{background:#1e3a5f;color:#d0e0ff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:.85em}
.chat-input button:hover{background:#2a4a7f}
.chat-input button:disabled{opacity:.5;cursor:wait}
.feed-panel{grid-column:1/-1;border-top:1px solid #1a1a30;padding:8px 15px;max-height:150px;overflow-y:auto;font-size:.75em;color:#666}
.feed-panel .entry{padding:3px 0;border-bottom:1px solid #111}
.feed-panel .time{color:#444;margin-right:8px}
.feed-panel .type{color:#3a6a9a;margin-right:6px}
"""

# Dashboard HTML template (JS will fetch sprites + agent state dynamically)
HTML_TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Agent Command Center</title>
<style>STYLES_PLACEHOLDER</style></head>
<body>
<div class="app">
  <div class="top-bar">
    <h1>Agent Command Center</h1>
    <span class="meta" id="timestamp">loading...</span>
  </div>

  <div class="office-panel">
    <canvas id="office"></canvas>
    <div class="stats" id="stats"></div>
    <div class="project-grid" id="projects"></div>
  </div>

  <div class="chat-panel">
    <div class="chat-header">
      <span>Chat:</span>
      <select id="chat-project"><option value="">PA Orchestrator</option></select>
    </div>
    <div class="chat-messages" id="messages"></div>
    <div class="chat-input">
      <input id="chat-input" placeholder="Type a task..." onkeydown="if(event.key==='Enter')sendChat()">
      <button id="chat-send" onclick="sendChat()">Send</button>
    </div>
  </div>

  <div class="feed-panel" id="feed">Activity feed loading...</div>
</div>

<script>
OFFICE_JS_PLACEHOLDER

// --- Dashboard Controller ---
let office = null;
let projects = [];

function loadSprites() {
  // Sprites inlined at build time — no network request
  return window.__SPRITES__ || {characters:[], floors:[], furniture:{}};
}

async function loadAgentState() {
  try {
    const r = await fetch('/webhook/agent-state', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d = await r.json();
    if (d.agents) {
      projects = d.agents;
      if (office) office.setAgents(d.agents);
      renderStats(d.agents);
      renderProjects(d.agents);
      renderProjectDropdown(d.agents);
      document.getElementById('timestamp').textContent = new Date().toLocaleString();
    }
  } catch(e) { console.error('agent-state:', e); }
}

async function loadFeed() {
  try {
    const r = await fetch('/webhook/feed', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d = await r.json();
    const el = document.getElementById('feed');
    if (d.feed && d.feed.length) {
      el.innerHTML = d.feed.map(e =>
        '<div class="entry"><span class="time">' + new Date(e.time).toLocaleTimeString() + '</span>' +
        '<span class="type">[' + e.type + ']</span>' +
        '<strong>' + (e.project||'') + '</strong> ' + (e.message||'').substring(0,60) + '</div>'
      ).join('');
    } else {
      el.innerHTML = '<div class="entry">No activity yet</div>';
    }
  } catch(e) { console.error('feed:', e); }
}

function renderStats(agents) {
  const hot = agents.filter(a => a.status === 'working').length;
  const idle = agents.filter(a => a.status === 'idle').length;
  const sleep = agents.filter(a => a.status === 'sleeping').length;
  const dirty = agents.reduce((s,a) => s + (a.uncommitted||0), 0);
  document.getElementById('stats').innerHTML =
    '<div class="stat"><div class="stat-n" style="color:#22c55e">' + hot + '</div><div class="stat-l">Working</div></div>' +
    '<div class="stat"><div class="stat-n" style="color:#eab308">' + idle + '</div><div class="stat-l">Idle</div></div>' +
    '<div class="stat"><div class="stat-n" style="color:#666">' + sleep + '</div><div class="stat-l">Sleeping</div></div>' +
    '<div class="stat"><div class="stat-n">' + agents.length + '</div><div class="stat-l">Agents</div></div>' +
    '<div class="stat"><div class="stat-n" style="color:' + (dirty > 50 ? '#ef4444' : '#eab308') + '">' + dirty + '</div><div class="stat-l">Uncommitted</div></div>';
}

function renderProjects(agents) {
  const colors = {working:'#22c55e',idle:'#eab308',sleeping:'#666',error:'#ef4444'};
  document.getElementById('projects').innerHTML = agents.map(a =>
    '<div class="project-card" onclick="selectProject(\\'' + a.name + '\\')">' +
    '<div class="name"><span style="color:' + (colors[a.status]||'#666') + '">\\u25CF</span> ' + a.name + '</div>' +
    '<div class="meta">' + a.branch + ' \\u2022 ' + (a.uncommitted||0) + ' dirty</div></div>'
  ).join('');
}

function renderProjectDropdown(agents) {
  const sel = document.getElementById('chat-project');
  const current = sel.value;
  sel.innerHTML = '<option value="">PA Orchestrator</option>' +
    agents.map(a => '<option value="' + a.name + '">' + a.name + '</option>').join('');
  sel.value = current;
}

function selectProject(name) {
  document.getElementById('chat-project').value = name;
  document.getElementById('chat-input').focus();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  const project = document.getElementById('chat-project').value;
  const messages = document.getElementById('messages');

  // Add user message
  messages.innerHTML += '<div class="msg user">' + msg + (project ? ' <small>\\u2192 ' + project + '</small>' : '') + '</div>';
  input.value = '';
  document.getElementById('chat-send').disabled = true;
  messages.scrollTop = messages.scrollHeight;

  // Add loading
  messages.innerHTML += '<div class="msg bot" id="loading">Thinking...</div>';
  messages.scrollTop = messages.scrollHeight;

  try {
    const r = await fetch('/webhook/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: msg, project: project})
    });
    const d = await r.json();
    const loading = document.getElementById('loading');
    if (loading) loading.remove();

    if (d.status === 'complete') {
      messages.innerHTML += '<div class="msg bot"><pre>' + (d.response||'').substring(0, 3000) + '</pre></div>';
    } else {
      messages.innerHTML += '<div class="msg bot" style="color:#ef4444">Error: ' + (d.error||'unknown') + '</div>';
    }
  } catch(e) {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    messages.innerHTML += '<div class="msg bot" style="color:#ef4444">Failed: ' + e.message + '</div>';
  }

  document.getElementById('chat-send').disabled = false;
  messages.scrollTop = messages.scrollHeight;
  loadAgentState(); // refresh after action
  loadFeed();
}

// --- Init ---
async function init() {
  const sprites = loadSprites();
  const canvas = document.getElementById('office');
  office = new PixelOffice(canvas, sprites);
  office.start();

  await loadAgentState();
  await loadFeed();

  // Polling
  setInterval(loadAgentState, 30000);
  setInterval(loadFeed, 15000);
}

init();
</script>
</body></html>"""

# Load sprites and inline them
SPRITES_FILE = ROOT / 'n8n' / 'dashboard' / 'sprites.json'
sprites_json = ''
if SPRITES_FILE.exists():
    sprites_json = SPRITES_FILE.read_text(encoding='utf-8')
    print(f'Sprites: {len(sprites_json) // 1024} KB inlined')
else:
    print('WARNING: sprites.json not found — run: python scripts/decode-sprites.py')
    sprites_json = '{"characters":[],"floors":[],"furniture":{}}'

sprite_injection = f'<script>window.__SPRITES__={sprites_json};</script>'

# Assemble
html = HTML_TEMPLATE.replace('STYLES_PLACEHOLDER', CSS).replace('OFFICE_JS_PLACEHOLDER', office_code)
# Inject sprites before closing </body>
html = html.replace('</body>', sprite_injection + '</body>')

# Build n8n workflow that serves this HTML
# The Code node returns {html}, respondToWebhook sends it
wf = {
    "name": "Dashboard",
    "nodes": [
        {
            "parameters": {"httpMethod": "GET", "path": "dashboard", "responseMode": "responseNode", "options": {}},
            "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [250, 300], "name": "Webhook"
        },
        {
            "parameters": {
                "jsCode": "return [{json: {html: " + json.dumps(html) + "}}];"
            },
            "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [470, 300], "name": "Serve HTML"
        },
        {
            "parameters": {
                "respondWith": "text",
                "responseBody": "={{ $json.html }}",
                "options": {"responseHeaders": {"entries": [{"name": "Content-Type", "value": "text/html; charset=utf-8"}]}}
            },
            "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [690, 300], "name": "Respond"
        }
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Serve HTML", "type": "main", "index": 0}]]},
        "Serve HTML": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
}

with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

# Verify
json.loads(OUTPUT.read_text(encoding='utf-8'))
size_kb = OUTPUT.stat().st_size / 1024
print(f'Dashboard v3: OK ({size_kb:.0f} KB)')
print(f'office.js: {len(office_code)} chars inlined')
print(f'CSS: {len(CSS)} chars inlined')
