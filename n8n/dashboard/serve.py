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
import urllib.parse
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
            # Extended fields (may not exist in old scan format)
            current_task = parts[7] if len(parts) > 7 else ''
            has_blockers = parts[8] == 'true' if len(parts) > 8 else False
            phase = parts[9] if len(parts) > 9 else ''
            lessons = int(parts[10]) if len(parts) > 10 and parts[10].isdigit() else 0

            days = int((now_ts - int(age)) / 86400) if age.isdigit() and int(age) > 0 else 999
            status = 'working' if days <= 1 else 'idle' if days <= 7 else 'sleeping'
            if has_blockers:
                status = 'blocked'
            if manifest == 'true':
                agents.append({
                    'id': i, 'name': name, 'status': status, 'branch': branch,
                    'last_commit': last, 'uncommitted': int(uncommitted) if uncommitted.isdigit() else 0,
                    'days': days, 'template_version': tpl,
                    'task': current_task, 'blockers': has_blockers,
                    'phase': phase, 'lessons': lessons,
                    'segment': PROJECT_SEGMENT.get(name, 'Other')
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


SEGMENTS_FILE = os.path.join(DIR, 'segments.json')
SEGMENTS = {}
if os.path.exists(SEGMENTS_FILE):
    try:
        SEGMENTS = json.loads(open(SEGMENTS_FILE, encoding='utf-8').read()).get('segments', {})
    except:
        pass

# Build reverse map: project_name → segment
PROJECT_SEGMENT = {}
for seg, projects in SEGMENTS.items():
    for p in projects:
        PROJECT_SEGMENT[p] = seg

CHATS_DIR = os.path.join(ROOT, 'tasks', 'chats')
os.makedirs(CHATS_DIR, exist_ok=True)


def build_orchestrator_context():
    """Build context prefix for PA orchestrator. Uses cached scan data."""
    try:
        cached = _scan_cache.get('data') or get_agents()
        agents_list = cached.get('agents', [])
        names = [a['name'] for a in agents_list]
        working = [a['name'] for a in agents_list if a['status'] == 'working']
        blocked = [a['name'] for a in agents_list if a.get('blockers')]
        ctx = (f"[CONTEXT: You are PA Orchestrator managing {len(agents_list)} projects.\n"
               f"Projects: {', '.join(names[:10])}\n"
               f"Working: {', '.join(working) or 'none'}. Blocked: {', '.join(blocked) or 'none'}.\n"
               f"DELEGATION: When user asks you to do something in a specific project, "
               f"write your response with this EXACT format at the end:\n"
               f"[DELEGATE:ProjectName]\n"
               f"<exact task message for that project's agent, as if from the user>\n"
               f"[/DELEGATE]\n"
               f"The dashboard will automatically send this to the project's agent and report back.\n"
               f"Be concise.]\n\n")
        return ctx
    except:
        return ''


# Pending delegations (in-memory, simple approach)
_pending_delegations = {}

# === TASK PERSISTENCE ===
# Running tasks persisted to file — survives page reload
TASKS_FILE = os.path.join(ROOT, 'tasks', '.running-tasks.json')
_running_pids = {}  # project → subprocess.Popen object


def _load_tasks():
    """Load running tasks from file."""
    try:
        if os.path.exists(TASKS_FILE):
            return json.loads(open(TASKS_FILE, encoding='utf-8').read())
    except:
        pass
    return {}


def _save_tasks(tasks):
    """Save running tasks to file."""
    try:
        with open(TASKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(tasks, f, ensure_ascii=False)
    except:
        pass


def set_activity(project, action, detail=''):
    """Mark project as active — persisted to file."""
    tasks = _load_tasks()
    tasks[project] = {'action': action, 'detail': detail, 'started': time.time()}
    _save_tasks(tasks)


def clear_activity(project):
    """Clear active task — persisted."""
    tasks = _load_tasks()
    tasks.pop(project, None)
    _save_tasks(tasks)
    _running_pids.pop(project, None)


def get_activities():
    """Return current activities, auto-expire stale (>5 min)."""
    tasks = _load_tasks()
    now = time.time()
    expired = [k for k, v in tasks.items() if now - v.get('started', 0) > 300]
    for k in expired:
        tasks.pop(k, None)
        # Kill zombie process if exists
        proc = _running_pids.pop(k, None)
        if proc and proc.poll() is None:
            try:
                proc.kill()
            except:
                pass
    if expired:
        _save_tasks(tasks)
    return tasks


def track_process(project, proc):
    """Track a subprocess for cleanup."""
    _running_pids[project] = proc


def cleanup_all():
    """Kill all tracked processes — called on server shutdown."""
    for name, proc in list(_running_pids.items()):
        if proc and proc.poll() is None:
            try:
                proc.kill()
            except:
                pass
    _running_pids.clear()
    if os.path.exists(TASKS_FILE):
        os.unlink(TASKS_FILE)


def parse_delegation(pa_response):
    """Parse PA response for delegation markers. Returns (project, task) or None."""
    pattern = r'\[DELEGATE:([^\]]+)\]\s*\n?(.*?)\n?\[/DELEGATE\]'
    match = re.search(pattern, pa_response, re.DOTALL)
    if not match:
        return None
    return match.group(1).strip(), match.group(2).strip()


def queue_delegation(target_project, task_message):
    """Queue a delegation for user approval."""
    delegation_id = str(int(time.time() * 1000))
    _pending_delegations[delegation_id] = {
        'id': delegation_id,
        'project': target_project,
        'task': task_message,
        'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'status': 'pending'
    }
    return delegation_id


def execute_delegation(delegation_id):
    """Execute an approved delegation."""
    d = _pending_delegations.get(delegation_id)
    if not d or d['status'] != 'pending':
        return {'status': 'error', 'error': 'Delegation not found or already executed'}

    target_project = d['project']
    task_message = d['task']
    project_dir = os.path.join(DOCS_DIR, target_project)
    if not os.path.exists(project_dir):
        return {'status': 'error', 'error': f'Project not found: {target_project}'}

    d['status'] = 'running'
    set_activity(target_project, 'delegation', task_message[:50])

    # Write task to project chat as "user"
    chat_file = os.path.join(CHATS_DIR, f'{target_project}.jsonl')
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(chat_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts, 'role': 'user', 'msg': f'[via PA] {task_message}'}) + '\n')

    # Execute with --dangerously-skip-permissions (user approved)
    tmp = os.path.join(tempfile.gettempdir(), f'delegate-{int(time.time()*1000)}.txt')
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(task_message)
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        result = subprocess.run(
            f'chcp 65001 >nul 2>&1 & claude --dangerously-skip-permissions -p < "{tmp}"',
            shell=True, capture_output=True, timeout=300, cwd=project_dir, env=env
        )
        try:
            response = result.stdout.decode('utf-8').strip()
        except:
            try:
                response = result.stdout.decode('cp1251').strip()
            except:
                response = str(result.stdout).strip()
        if not response:
            response = 'No response from agent'
    except subprocess.TimeoutExpired:
        response = 'Agent timed out (5 min)'
    except Exception as e:
        response = f'Error: {e}'
    finally:
        try:
            os.unlink(tmp)
        except:
            pass

    # Save agent response in project chat
    ts2 = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(chat_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts2, 'role': 'assistant', 'msg': response}) + '\n')

    # Log in orchestrator chat
    orch_file = os.path.join(CHATS_DIR, '_orchestrator.jsonl')
    with open(orch_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts2, 'role': 'system', 'msg': f'✓ Executed in {target_project}: {response[:200]}'}) + '\n')

    d['status'] = 'done'
    d['response'] = response
    clear_activity(target_project)

    # PA Review Loop: let PA evaluate the result
    review_result = None
    error_indicators = ['error', 'Error', 'failed', 'Failed', 'FAIL', 'not found', 'permission denied',
                        'timed out', 'No response', 'syntax error', 'SyntaxError', 'TypeError']
    has_error = any(indicator in response for indicator in error_indicators)

    if has_error and d.get('retries', 0) < 2:
        # Auto-retry with error context
        d['retries'] = d.get('retries', 0) + 1
        retry_msg = f"Previous attempt failed with: {response[:200]}\n\nPlease fix and retry: {task_message}"
        chat_file = os.path.join(CHATS_DIR, f'{target_project}.jsonl')
        ts_retry = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        with open(chat_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts_retry, 'role': 'system', 'msg': f'⚠ Error detected, auto-retrying ({d["retries"]}/2)...'}) + '\n')

        # Log to orchestrator
        orch_file = os.path.join(CHATS_DIR, '_orchestrator.jsonl')
        with open(orch_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts_retry, 'role': 'system', 'msg': f'⚠ {target_project}: error detected, auto-retrying ({d["retries"]}/2)'}) + '\n')

        # Re-execute with error context
        set_activity(target_project, 'retry', f'attempt {d["retries"]}/2')
        tmp_retry = os.path.join(tempfile.gettempdir(), f'retry-{int(time.time()*1000)}.txt')
        try:
            with open(tmp_retry, 'w', encoding='utf-8') as f:
                f.write(retry_msg)
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            retry_result = subprocess.run(
                f'chcp 65001 >nul 2>&1 & claude --dangerously-skip-permissions -p < "{tmp_retry}"',
                shell=True, capture_output=True, timeout=300, cwd=project_dir, env=env
            )
            try:
                response = retry_result.stdout.decode('utf-8').strip()
            except:
                response = str(retry_result.stdout).strip()
            if not response:
                response = 'No response on retry'
        except Exception as e:
            response = f'Retry error: {e}'
        finally:
            try:
                os.unlink(tmp_retry)
            except:
                pass

        # Save retry response
        ts_r2 = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        with open(chat_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts_r2, 'role': 'assistant', 'msg': response}) + '\n')
        with open(orch_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts_r2, 'role': 'system', 'msg': f'✓ {target_project} retry result: {response[:200]}'}) + '\n')
        clear_activity(target_project)
        d['response'] = response
        review_result = f'Auto-retried ({d["retries"]}/2). Final: {response[:200]}'

    return {'status': 'complete', 'project': target_project, 'task': task_message,
            'response': response, 'review': review_result}


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

    # Orchestrator chat runs in PersonalAssistant, not template root
    PA_DIR = os.path.join(DOCS_DIR, 'PersonalAssistant')
    cwd = os.path.join(DOCS_DIR, project) if project else (PA_DIR if os.path.exists(PA_DIR) else ROOT)
    if project and not os.path.exists(cwd):
        return {'status': 'error', 'error': f'Project not found: {cwd}'}

    chat_file = os.path.join(CHATS_DIR, f'{project or "_orchestrator"}.jsonl')
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    # Save user message
    with open(chat_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'ts': ts, 'role': 'user', 'msg': message}) + '\n')

    # PA handles delegation via [DELEGATE:Project] markers in response
    prompt = message
    if not project:
        prompt = build_orchestrator_context() + message

    # Execute via claude -p (temp file for injection safety)
    tmp = os.path.join(tempfile.gettempdir(), f'chat-{int(time.time()*1000)}.txt')
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(prompt)
        # Force UTF-8 on Windows (otherwise cmd.exe uses cp1251/cp866)
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['LANG'] = 'en_US.UTF-8'
        env['CHCP'] = '65001'
        set_activity(project or '_orchestrator', 'chatting', message[:50])
        result = subprocess.run(
            f'chcp 65001 >nul 2>&1 & claude -p < "{tmp}"',
            shell=True, capture_output=True, timeout=300, cwd=cwd, env=env
        )
        clear_activity(project or '_orchestrator')
        # Decode with fallback
        try:
            response = result.stdout.decode('utf-8').strip()
        except (UnicodeDecodeError, AttributeError):
            try:
                response = result.stdout.decode('cp1251').strip()
            except:
                response = str(result.stdout).strip()
        if not response:
            try:
                response = result.stderr.decode('utf-8').strip()
            except:
                response = 'No response'
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

    # Check if PA wants to delegate a task
    if not project:
        parsed = parse_delegation(response)
        if parsed:
            target, task = parsed
            did = queue_delegation(target, task)
            response += f'\n\n---\n**⏳ Awaiting approval to run in {target}:**\n{task}\n\n<delegation id="{did}" project="{target}"/>'

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

    def end_headers(self):
        # No-cache for HTML (prevent stale dashboard)
        if hasattr(self, '_headers_buffer'):
            path = self.path if hasattr(self, 'path') else ''
            if path.endswith('.html') or path == '/':
                self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/activity':
            self._json_response({'activities': get_activities(), 'delegations': {k: v for k, v in _pending_delegations.items() if v['status'] in ('pending', 'running')}})
        elif self.path == '/api/segments':
            self._json_response({'segments': SEGMENTS, 'project_segment': PROJECT_SEGMENT})
        elif self.path == '/api/agents':
            self._json_response(get_agents())
        elif self.path == '/api/feed':
            self._json_response(get_feed())
        elif self.path == '/api/chats':
            self._json_response(get_chats())
        elif self.path.startswith('/api/chat/'):
            project = urllib.parse.unquote(self.path.split('/api/chat/')[1])
            self._json_response(get_chat_history(project))
        elif self.path.startswith('/api/modules/'):
            project = urllib.parse.unquote(self.path.split('/api/modules/')[1])
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
        elif self.path == '/api/chat-stream':
            project = data.get('project', '')
            message = data.get('message', '')
            self._stream_chat(project, message)
        elif self.path == '/api/chat':
            project = data.get('project', '')
            message = data.get('message', '')
            self._json_response(send_chat(project, message))
        elif self.path.startswith('/api/modules/'):
            project = urllib.parse.unquote(self.path.split('/api/modules/')[1])
            self._json_response(get_modules(project))
        elif self.path == '/api/delegations':
            self._json_response({'delegations': [d for d in _pending_delegations.values() if d['status'] == 'pending']})
        elif self.path.startswith('/api/approve/'):
            did = urllib.parse.unquote(self.path.split('/api/approve/')[1])
            result = execute_delegation(did)
            self._json_response(result)
        elif self.path.startswith('/api/reject/'):
            did = urllib.parse.unquote(self.path.split('/api/reject/')[1])
            d = _pending_delegations.get(did)
            if d:
                d['status'] = 'rejected'
                self._json_response({'status': 'rejected'})
            else:
                self._json_response({'status': 'error', 'error': 'Not found'})
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

    def _stream_chat(self, project, message):
        """SSE streaming: run claude -p and stream stdout line by line."""
        if not message:
            self._json_response({'status': 'error', 'error': 'Empty message'})
            return

        PA_DIR = os.path.join(DOCS_DIR, 'PersonalAssistant')

        # PA handles delegation via [DELEGATE:Project] markers
        prompt = message
        if not project:
            prompt = build_orchestrator_context() + message

        cwd = os.path.join(DOCS_DIR, project) if project else (PA_DIR if os.path.exists(PA_DIR) else ROOT)
        chat_file = os.path.join(CHATS_DIR, f'{project or "_orchestrator"}.jsonl')
        ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        with open(chat_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts, 'role': 'user', 'msg': message}) + '\n')

        tmp = os.path.join(tempfile.gettempdir(), f'chat-{int(time.time()*1000)}.txt')
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(prompt)

        # SSE headers
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        full_response = ''
        set_activity(project or '_orchestrator', 'streaming', message[:50])
        try:
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            proc = subprocess.Popen(
                f'chcp 65001 >nul 2>&1 & claude -p < "{tmp}"',
                shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                cwd=cwd, env=env
            )
            track_process(project or '_orchestrator', proc)
            # Read stdout line by line
            for raw_line in iter(proc.stdout.readline, b''):
                try:
                    line = raw_line.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        line = raw_line.decode('cp1251')
                    except:
                        line = str(raw_line)
                full_response += line
                event = f"data: {json.dumps({'text': line})}\n\n"
                self.wfile.write(event.encode('utf-8'))
                self.wfile.flush()
            proc.wait()
        except Exception as e:
            err = f"data: {json.dumps({'error': str(e)})}\n\n"
            self.wfile.write(err.encode('utf-8'))
            self.wfile.flush()
        finally:
            try:
                os.unlink(tmp)
            except:
                pass

        # Save full response
        ts2 = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        with open(chat_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'ts': ts2, 'role': 'assistant', 'msg': full_response.strip()}) + '\n')

        # Check for delegation in PA response (orchestrator only)
        if not project:
            parsed = parse_delegation(full_response)
            if parsed:
                target, task = parsed
                did = queue_delegation(target, task)
                report = f'\n\n---\n**⏳ Awaiting approval to run in {target}:**\n{task}\n\n<delegation id="{did}" project="{target}"/>'
                event = f"data: {json.dumps({'text': report})}\n\n"
                self.wfile.write(event.encode('utf-8'))
                self.wfile.flush()

        clear_activity(project or '_orchestrator')
        # End SSE
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

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
        print('\nCleaning up...')
        cleanup_all()
        print('Stopped.')
