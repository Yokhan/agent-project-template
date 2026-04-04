"""
Dashboard server with proxy to n8n webhooks (solves CORS).
Serves static files from current dir + proxies /webhook/* to n8n.
Usage: python n8n/dashboard/serve.py [port]
"""
import http.server
import urllib.request
import sys
import os
import json

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3333
N8N = os.environ.get('N8N_URL', 'http://localhost:5678')
DIR = os.path.dirname(os.path.abspath(__file__))


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith('/webhook/'):
            self._proxy('GET')
        else:
            if self.path == '/':
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/webhook/'):
            self._proxy('POST')
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _proxy(self, method):
        url = N8N + self.path
        body = None
        if method == 'POST':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b'{}'

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
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': f'n8n unreachable: {e}'}).encode())

    def log_message(self, format, *args):
        if '/webhook/' in str(args[0]):
            print(f'  proxy: {args[0]}')


if __name__ == '__main__':
    print(f'Dashboard: http://localhost:{PORT}')
    print(f'n8n proxy: {N8N}/webhook/* -> localhost:{PORT}/webhook/*')
    print()
    server = http.server.HTTPServer(('127.0.0.1', PORT), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
