"""
Build Agent Command Center dashboard — data-first, lightweight.
Usage: python n8n/build-dashboard.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / 'n8n' / 'workflows' / 'dashboard.json'

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a15;color:#d0d0e0;font-family:-apple-system,system-ui,sans-serif;overflow-x:hidden}
.app{display:grid;grid-template-columns:1fr 340px;grid-template-rows:auto 1fr auto;height:100vh}
.hdr{grid-column:1/-1;padding:10px 20px;background:#0f0f1a;border-bottom:1px solid #1a1a30;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:1.2em;color:#fff}
.hdr .t{color:#555;font-size:.8em}
.main{padding:15px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.st{background:#12122a;border:1px solid #1e1e3a;padding:10px;border-radius:8px;text-align:center}
.st .n{font-size:1.6em;font-weight:700;line-height:1.1}
.st .l{color:#555;font-size:.7em;margin-top:2px}
h2{font-size:.9em;color:#888;margin:5px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.card{background:#12122a;border:1px solid #1e1e3a;border-radius:8px;padding:10px 12px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.card:hover{border-color:#3a3a6a;transform:translateY(-1px)}
.card .top{display:flex;justify-content:space-between;align-items:center}
.card .name{font-weight:600;font-size:.85em;color:#fff;display:flex;align-items:center;gap:6px}
.card .dot{width:8px;height:8px;border-radius:50%;display:inline-block;animation:pulse 2s infinite}
.card .dot.working{background:#22c55e}
.card .dot.idle{background:#eab308;animation:none}
.card .dot.sleeping{background:#555;animation:none}
.card .dot.error{background:#ef4444}
.card .branch{font-size:.7em;color:#666;font-family:monospace}
.card .meta{display:flex;gap:12px;margin-top:6px;font-size:.7em;color:#555}
.card .meta span{display:flex;align-items:center;gap:3px}
.card .bar{position:absolute;bottom:0;left:0;height:2px;background:#22c55e;transition:width .5s}
.card .modules{display:none;margin-top:8px;border-top:1px solid #1e1e3a;padding-top:6px}
.card.expanded .modules{display:block}
.mod{display:flex;justify-content:space-between;font-size:.7em;padding:2px 0;color:#888}
.mod .ok{color:#22c55e}
.mod .warn{color:#eab308}
.mod .err{color:#ef4444}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.chat{display:flex;flex-direction:column;background:#0d0d1a;border-left:1px solid #1a1a30}
.chat .hd{padding:8px 12px;border-bottom:1px solid #1a1a30;display:flex;align-items:center;gap:6px;font-size:.85em}
.chat select{background:#12122a;color:#d0d0e0;border:1px solid #2a2a4a;padding:4px 8px;border-radius:4px;font-size:.8em;flex:1}
.msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:6px}
.m{max-width:90%;padding:7px 10px;border-radius:8px;font-size:.8em;line-height:1.3;word-wrap:break-word}
.m.u{align-self:flex-end;background:#1e3a5f;color:#d0e0ff}
.m.b{align-self:flex-start;background:#1a1a30;color:#c0c0d0}
.m pre{white-space:pre-wrap;font-size:.75em;margin-top:3px;color:#8899aa}
.inp{display:flex;gap:5px;padding:8px 10px;border-top:1px solid #1a1a30}
.inp input{flex:1;background:#12122a;color:#d0d0e0;border:1px solid #2a2a4a;padding:7px 10px;border-radius:5px;font-size:.8em;outline:none}
.inp input:focus{border-color:#3a5a8a}
.inp button{background:#1e3a5f;color:#d0e0ff;border:none;padding:7px 14px;border-radius:5px;cursor:pointer;font-size:.8em}
.inp button:hover{background:#2a4a7f}
.inp button:disabled{opacity:.4}
.feed{grid-column:1/-1;border-top:1px solid #1a1a30;padding:6px 15px;max-height:120px;overflow-y:auto;font-size:.7em;color:#555}
.feed .e{padding:2px 0;border-bottom:1px solid #0f0f1a}
.feed .tm{color:#444;margin-right:6px}
.feed .tp{color:#3a6a9a;margin-right:4px}
.btns{display:flex;gap:6px;flex-wrap:wrap}
.btns button{background:#161630;color:#8888aa;border:1px solid #252545;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:.75em}
.btns button:hover{background:#1e1e40;color:#aaa}
"""

HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Agent Command Center</title>
<style>STYLES</style></head>
<body>
<div class="app">
  <div class="hdr">
    <h1>Agent Command Center</h1>
    <span class="t" id="ts">loading...</span>
  </div>
  <div class="main">
    <div class="stats" id="stats"></div>
    <div class="btns">
      <button onclick="act('health')">Health Check</button>
      <button onclick="act('scan')">Rescan</button>
      <button onclick="act('dep-check')">Dependencies</button>
      <button onclick="act('weekly')">Weekly</button>
      <button onclick="location.reload()">Refresh</button>
    </div>
    <h2>Projects</h2>
    <div class="grid" id="grid"></div>
  </div>
  <div class="chat">
    <div class="hd">Chat <select id="cp"><option value="">PA</option></select></div>
    <div class="msgs" id="msgs"></div>
    <div class="inp">
      <input id="ci" placeholder="Task..." onkeydown="if(event.key==='Enter')send()">
      <button id="cb" onclick="send()">Send</button>
    </div>
  </div>
  <div class="feed" id="feed">No activity yet</div>
</div>
<script>
const API=''; // proxy handles routing to n8n
let projects=[];
const C={working:'#22c55e',idle:'#eab308',sleeping:'#555',error:'#ef4444'};

async function load(){
  try{
    const r=await fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.agents){projects=d.agents;render(d.agents);document.getElementById('ts').textContent=new Date().toLocaleString();}
  }catch(e){console.error(e);}
}

function render(a){
  const hot=a.filter(x=>x.status==='working').length;
  const idle=a.filter(x=>x.status==='idle').length;
  const slp=a.filter(x=>x.status==='sleeping').length;
  const dirty=a.reduce((s,x)=>s+(x.uncommitted||0),0);
  document.getElementById('stats').innerHTML=
    `<div class="st"><div class="n" style="color:#22c55e">${hot}</div><div class="l">Working</div></div>`+
    `<div class="st"><div class="n" style="color:#eab308">${idle}</div><div class="l">Idle</div></div>`+
    `<div class="st"><div class="n" style="color:#555">${slp}</div><div class="l">Sleeping</div></div>`+
    `<div class="st"><div class="n">${a.length}</div><div class="l">Agents</div></div>`+
    `<div class="st"><div class="n" style="color:${dirty>50?'#ef4444':'#eab308'}">${dirty}</div><div class="l">Dirty</div></div>`;

  document.getElementById('grid').innerHTML=a.map(p=>{
    const pct=Math.min(100,Math.max(5,(7-p.days)/7*100));
    return `<div class="card" onclick="toggle(this,'${p.name}')">
      <div class="top"><span class="name"><span class="dot ${p.status}"></span>${p.name}</span><span class="branch">${(p.branch||'').substring(0,20)}</span></div>
      <div class="meta"><span>${p.uncommitted||0} dirty</span><span>${p.last_commit||''}</span><span>${p.days||0}d ago</span></div>
      <div class="bar" style="width:${pct}%;background:${C[p.status]||'#555'}"></div>
      <div class="modules" id="mod-${p.name}">Loading...</div>
    </div>`;
  }).join('');

  const sel=document.getElementById('cp');
  const cur=sel.value;
  sel.innerHTML='<option value="">PA</option>'+a.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  sel.value=cur;
}

async function toggle(el,name){
  el.classList.toggle('expanded');
  if(el.classList.contains('expanded')){
    const m=document.getElementById('mod-'+name);
    try{
      const r=await fetch(API+'/webhook/module-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:name})});
      const d=await r.json();
      if(d.modules&&d.modules.length){
        m.innerHTML=d.modules.map(x=>`<div class="mod"><span>${x.name}</span><span class="${x.status}">${x.status} (${x.files}f/${x.lines}L)</span></div>`).join('');
      }else{m.innerHTML='<div class="mod">No modules detected</div>';}
    }catch{m.innerHTML='<div class="mod err">Failed to load</div>';}
  }
}

async function loadFeed(){
  try{
    const r=await fetch('/api/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    const el=document.getElementById('feed');
    if(d.feed&&d.feed.length){
      el.innerHTML=d.feed.map(e=>`<div class="e"><span class="tm">${new Date(e.time).toLocaleTimeString()}</span><span class="tp">[${e.type}]</span><b>${e.project||''}</b> ${(e.message||'').substring(0,50)}</div>`).join('');
    }
  }catch{}
}

async function send(){
  const inp=document.getElementById('ci');
  const msg=inp.value.trim();if(!msg)return;
  const proj=document.getElementById('cp').value;
  const msgs=document.getElementById('msgs');
  msgs.innerHTML+=`<div class="m u">${msg}${proj?' <small>&rarr; '+proj+'</small>':''}</div>`;
  inp.value='';document.getElementById('cb').disabled=true;
  msgs.innerHTML+='<div class="m b" id="ld">Thinking...</div>';
  msgs.scrollTop=msgs.scrollHeight;
  try{
    const r=await fetch(API+'/webhook/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,project:proj})});
    const d=await r.json();
    const ld=document.getElementById('ld');if(ld)ld.remove();
    if(d.status==='complete'){msgs.innerHTML+=`<div class="m b"><pre>${(d.response||'').substring(0,2000)}</pre></div>`;}
    else{msgs.innerHTML+=`<div class="m b" style="color:#ef4444">Error: ${d.error||'unknown'}</div>`;}
  }catch(e){
    const ld=document.getElementById('ld');if(ld)ld.remove();
    msgs.innerHTML+=`<div class="m b" style="color:#ef4444">${e.message}</div>`;
  }
  document.getElementById('cb').disabled=false;
  msgs.scrollTop=msgs.scrollHeight;
  load();loadFeed();
}

async function act(name){
  try{
    const r=await fetch(API+'/webhook/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    alert(name+': '+(d.status==='complete'?'OK':(d.error||d.message||'done')));
    load();
  }catch(e){alert(name+' failed: '+e.message);}
}

load();loadFeed();
setInterval(load,30000);
setInterval(loadFeed,15000);
</script>
</body></html>"""

html = HTML.replace('STYLES', CSS)

wf = {
    "name": "Dashboard",
    "nodes": [
        {"parameters": {"httpMethod": "GET", "path": "dashboard", "responseMode": "responseNode", "options": {}},
         "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [250, 300], "name": "Webhook"},
        {"parameters": {"jsCode": "return [{json: {html: " + json.dumps(html) + "}}];"},
         "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [470, 300], "name": "Serve"},
        {"parameters": {"respondWith": "text", "responseBody": "={{ $json.html }}",
                         "options": {"responseHeaders": {"entries": [{"name": "Content-Type", "value": "text/html; charset=utf-8"}]}}},
         "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [690, 300], "name": "Respond"}
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Serve", "type": "main", "index": 0}]]},
        "Serve": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
}

with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

json.loads(OUTPUT.read_text(encoding='utf-8'))
size_kb = OUTPUT.stat().st_size / 1024
print(f'Dashboard v4: {size_kb:.0f} KB (data-first, no sprites)')
