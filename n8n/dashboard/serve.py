"""
Dashboard server — fast local API + n8n proxy for heavy tasks.
- /api/agents     → runs scan-projects-fast.py locally (1-2s)
- /api/feed       → reads chat history file directly (instant)
- /webhook/*      → proxies to n8n (for chat with claude -p, etc.)
- everything else → static files from this directory
Usage: python n8n/dashboard/serve.py [port]
"""
import http.server
import urllib.request
import subprocess
import sys
import os
import json
import time
import tempfile
import re
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3333
N8N = os.environ.get('N8N_URL', 'http://localhost:5678')
DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = str(Path(DIR).parent.parent)

# Load config
config_path = os.path.join(ROOT, 'n8n', 'config.json')
DOCS_DIR = str(Path.home() / 'Documents')
if os.path.exists(config_path):
    try:
        cfg = json.loads(open(config_path).read())
        DOCS_DIR = cfg.get('documents_dir', DOCS_DIR)
    except:
        pass

# Cache for scan results
_scan_cache = {'data': None, 'time': 0}
CACHE_TTL = 30  # seconds


def get_agents():
    """Run fast scan — cached for 30s."""
    now = time.time()
    if _scan_cache['data'] and (now - _scan_cache['time']) < CACHE_TTL:
        return _scan_cache['data']

    scanner = os.path.join(ROOT, 'scripts', 'scan-projects-fast.py')
    if not os.path.exists(scanner):
        scanner = os.path.join(ROOT, 'scripts', 'scan-projects.sh')
        cmd = ['bash', scanner, DOCS_DIR]
    else:
        cmd = [sys.executable, scanner, DOCS_DIR]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=ROOT)
        now_ts = int(time.time())
        agents = []
        for i, line in enumerate(result.stdout.strip().split('\n')):
            if '|' not in line:
                continue
            parts = line.split('|')
            if len(parts) < 7:
                continue
            name, branch, last, age, uncommitted, manifest, tpl = parts[:7]
            days = int((now_ts - int(age)) / 86400) if age.isdigit() and int(age) > 0 else 999
            status = 'working' if days <= 1 else 'idle' if days <= 7 else 'sleeping'
            if manifest == 'true':
                agents.append({
                    'id': i, 'name': name, 'status': status, 'branch': branch,
                    'last_commit': last, 'uncommitted': int(uncommitted) if uncommitted.isdigit() else 0,
                    'days': days, 'template_version': tpl
                })

        # Check chat history for recent activity
        history_file = os.path.join(ROOT, 'tasks', '.chat-history.jsonl')
        if os.path.exists(history_file):
            try:
                recent = set()
                for line in open(history_file).readlines()[-10:]:
                    entry = json.loads(line.strip())
                    minutes_ago = (time.time() - time.mktime(time.strptime(entry['ts'][:19], '%Y-%m-%dT%H:%M:%S'))) / 60
                    if minutes_ago < 30:
                        recent.add(entry.get('project', ''))
                for a in agents:
                    if a['name'] in recent:
                        a['status'] = 'working'
            except:
                pass

        data = {'agents': agents, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')}
        _scan_cache['data'] = data
        _scan_cache['time'] = now
        return data
    except Exception as e:
        return {'agents': [], 'error': str(e)}


def get_feed():
    """Read chat history — instant."""
    history_file = os.path.join(ROOT, 'tasks', '.chat-history.jsonl')
    feed = []
    if os.path.exists(history_file):
        try:
            for line in open(history_file).readlines()[-15:]:
                entry = json.loads(line.strip())
                feed.append({'type': 'chat', 'project': entry.get('project', ''), 'message': entry.get('message', ''), 'time': entry.get('ts', '')})
        except:
            pass
    feed.reverse()
    return {'feed': feed, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')}


CHATS_DIR = os.path.join(ROOT, 'tasks', 'chats')
os.makedirs(CHATS_DIR, exist_ok=True)


def get_chats():
    """List all project chats with last message."""
    chats = []
    if not os.path.exists(CHATS_DIR):
        return {'chats': []}
    for f in sorted(os.listdir(CHATS_DIR)):
        if not f.endswith('.jsonl'):
            continue
        project = f[:-6]  # strip .jsonl
        path = os.path.join(CHATS_DIR, f)
        try:
            lines = open(path, encoding='utf-8').readlines()
            last = json.loads(lines[-1]) if lines else {}
            chats.append({
                'project': project,
                'last_msg': last.get('msg', '')[:60],
                'last_ts': last.get('ts', ''),
                'msg_count': len(lines),
                'role': last.get('role', '')
            })
        except:
            chats.append({'project': project, 'last_msg': '', 'last_ts': '', 'msg_count': 0})
    # Sort by last_ts descending
    chats.sort(key=lambda c: c.get('last_ts', ''), reverse=True)
    return {'chats': chats}


def get_chat_history(project):
    """Get last 50 messages for a project."""
    path = os.path.join(CHATS_DIR, f'{project}.jsonl')
    messages = []
    if os.path.exists(path):
        try:
            for line in open(path, encoding='utf-8').readlines()[-50:]:
                messages.append(json.loads(line.strip()))
        except:
            pass
    return {'project': project, 'messages': messages}


def send_chat(project, message):
    """Send message to project via claude -p, save history."""
    if not message:
        return {'status': 'error', 'error': 'Empty message'}

    cwd = os.path.join(DOCS_DIR, project) if project else ROOT
    if project and not os.path.exists(cwd):
        return {'status': 'error', 'error': f'Project not found: {cwd}'}

    chat_file = os.path.join(CHATS_DIR, f'{project or "_orchestrator"}.jsonl')
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    # Save user message
    with open(chat_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts, 'role': 'user', 'msg': message}) + '\n')

    # Execute via claude -p (temp file for injection safety)
    tmp = os.path.join(tempfile.gettempdir(), f'chat-{int(time.time()*1000)}.txt')
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(message)
        result = subprocess.run(
            f'claude -p < "{tmp}"',
            shell=True, capture_output=True, text=True, timeout=300, cwd=cwd
        )
        response = result.stdout.strip() or result.stderr.strip() or 'No response'
    except subprocess.TimeoutExpired:
        response = 'Error: claude -p timed out (5 min)'
    except Exception as e:
        response = f'Error: {e}'
    finally:
        try:
            os.unlink(tmp)
        except:
            pass

    # Save assistant response
    ts2 = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(chat_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts2, 'role': 'assistant', 'msg': response}) + '\n')

    return {'status': 'complete', 'response': response, 'project': project or '_orchestrator', 'ts': ts2}


def get_modules(project):
    """Get module status for a project."""
    path = os.path.join(DOCS_DIR, project)
    if not os.path.exists(path):
        return {'status': 'error', 'error': 'Project not found'}

    script = os.path.join(ROOT, 'scripts', 'module-status.sh')
    if not os.path.exists(script):
        return {'status': 'error', 'error': 'module-status.sh not found'}

    try:
        result = subprocess.run(
            ['bash', script, path], capture_output=True, text=True, timeout=15, cwd=ROOT
        )
        modules = []
        for line in result.stdout.strip().split('\n'):
            if '|' not in line:
                continue
            parts = line.split('|')
            if len(parts) >= 5:
                modules.append({
                    'name': parts[0], 'status': parts[1],
                    'files': int(parts[2]) if parts[2].isdigit() else 0,
                    'lines': int(parts[3]) if parts[3].isdigit() else 0,
                    'issues': parts[4]
                })
        return {'status': 'complete', 'project': project, 'modules': modules}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}


def run_action(name, params=None):
    """Execute a named action locally."""
    if name == 'briefing':
        agents = get_agents()
        a = agents.get('agents', [])
        hot = [x['name'] for x in a if x['status'] == 'working']
        idle = [x['name'] for x in a if x['status'] == 'idle']
        sleeping = [x['name'] for x in a if x['status'] == 'sleeping']
        dirty = [(x['name'], x['uncommitted']) for x in a if x.get('uncommitted', 0) > 10]
        text = f"Briefing {time.strftime('%Y-%m-%d')}:\n"
        text += f"Hot: {', '.join(hot) or 'none'}\n"
        text += f"Idle: {len(idle)} projects\n"
        text += f"Sleeping: {', '.join(sleeping) or 'none'}\n"
        if dirty:
            text += f"Dirty: {', '.join(f'{n}({c})' for n,c in dirty)}\n"
        return {'status': 'complete', 'text': text}

    elif name == 'drift':
        # Run check-drift on hot/warm projects
        agents = get_agents().get('agents', [])
        active = [a for a in agents if a['status'] in ('working', 'idle')]
        alerts = []
        for a in active[:8]:  # limit to 8 to avoid timeout
            path = os.path.join(DOCS_DIR, a['name'])
            script = os.path.join(path, 'scripts', 'check-drift.sh')
            if not os.path.exists(script):
                continue
            try:
                r = subprocess.run(['bash', script], capture_output=True, text=True, timeout=15, cwd=path)
                wm = re.search(r'(\d+) warnings', r.stdout)
                em = re.search(r'(\d+) errors', r.stdout)
                w = int(wm.group(1)) if wm else 0
                e = int(em.group(1)) if em else 0
                if w > 0 or e > 0:
                    alerts.append({'project': a['name'], 'warnings': w, 'errors': e})
            except:
                pass
        return {'status': 'complete', 'alerts': alerts, 'checked': len(active)}

    elif name == 'weekly':
        agents = get_agents().get('agents', [])
        return {
            'status': 'complete',
            'total': len(agents),
            'active': len([a for a in agents if a['status'] != 'sleeping']),
            'dirty_total': sum(a.get('uncommitted', 0) for a in agents),
            'text': f"Weekly: {len(agents)} projects, {len([a for a in agents if a['status']!='sleeping'])} active"
        }

    return {'status': 'error', 'error': f'Unknown action: {name}'}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path == '/api/agents':
            self._json_response(get_agents())
        elif self.path == '/api/feed':
            self._json_response(get_feed())
        elif self.path == '/api/chats':
            self._json_response(get_chats())
        elif self.path.startswith('/api/chat/'):
            project = self.path.split('/api/chat/')[1]
            self._json_response(get_chat_history(project))
        elif self.path.startswith('/api/modules/'):
            project = self.path.split('/api/modules/')[1]
            self._json_response(get_modules(project))
        elif self.path.startswith('/webhook/'):
            self._proxy('GET')
        else:
            if self.path == '/':
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        body = self._read_body()
        data = {}
        try:
            data = json.loads(body)
        except:
            pass

        if self.path == '/api/agents':
            self._json_response(get_agents())
        elif self.path == '/api/feed':
            self._json_response(get_feed())
        elif self.path == '/api/chat':
            project = data.get('project', '')
            message = data.get('message', '')
            self._json_response(send_chat(project, message))
        elif self.path.startswith('/api/modules/'):
            project = self.path.split('/api/modules/')[1]
            self._json_response(get_modules(project))
        elif self.path.startswith('/api/action/'):
            action = self.path.split('/api/action/')[1]
            self._json_response(run_action(action, data))
        elif self.path.startswith('/webhook/'):
            self._proxy('POST', body)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b'{}'

    def _json_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method, body=None):
        url = N8N + self.path
        if body is None and method == 'POST':
            body = self._read_body()
        try:
            req = urllib.request.Request(url, data=body, method=method)
            req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, fmt, *args):
        path = str(args[0]) if args else ''
        if '/api/' in path or '/webhook/' in path:
            print(f'  {path}')


if __name__ == '__main__':
    print(f'Dashboard:  http://localhost:{PORT}')
    print(f'API:        /api/agents /api/chats /api/chat /api/modules /api/action')
    print(f'n8n proxy:  /webhook/* -> {N8N}')
    print(f'Projects:   {DOCS_DIR}')
    print(f'Chats:      {CHATS_DIR}')
    print()
    import threading
    class ThreadedServer(http.server.HTTPServer):
        """Handle each request in a separate thread."""
        allow_reuse_address = True
        def process_request(self, request, client_address):
            t = threading.Thread(target=self.process_request_thread, args=(request, client_address))
            t.daemon = True
            t.start()
        def process_request_thread(self, request, client_address):
            try:
                self.finish_request(request, client_address)
            except: pass
            self.shutdown_request(request)
    server = ThreadedServer(('127.0.0.1', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
