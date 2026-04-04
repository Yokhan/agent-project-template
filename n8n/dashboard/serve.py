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


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path == '/api/agents':
            self._json_response(get_agents())
        elif self.path == '/api/feed':
            self._json_response(get_feed())
        elif self.path.startswith('/webhook/'):
            self._proxy('GET')
        else:
            if self.path == '/':
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        body = self._read_body()
        if self.path == '/api/agents':
            self._json_response(get_agents())
        elif self.path == '/api/feed':
            self._json_response(get_feed())
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
    print(f'Fast API:   /api/agents (local, ~2s)')
    print(f'            /api/feed (local, instant)')
    print(f'n8n proxy:  /webhook/* -> {N8N}')
    print(f'Projects:   {DOCS_DIR}')
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
