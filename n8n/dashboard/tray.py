"""
Agent Command Center — System Tray App
Double-click to launch. Sits in tray, serves dashboard on :3333.
Right-click tray icon for menu: Open Dashboard, Status, Quit.
"""
import sys
import os
import threading
import webbrowser
import time

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = str(os.path.abspath(os.path.join(DIR, '..', '..')))
sys.path.insert(0, DIR)

# Import serve.py components
os.chdir(ROOT)

PORT = 3333
DASHBOARD_URL = f'http://localhost:{PORT}'


def create_icon_image():
    """Create a simple tray icon — green dot on dark background."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (64, 64), (20, 20, 20, 255))
    draw = ImageDraw.Draw(img)
    # Green dot = running
    draw.ellipse([20, 20, 44, 44], fill=(51, 209, 122, 255))
    return img


def create_error_icon():
    """Red dot = error."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (64, 64), (20, 20, 20, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse([20, 20, 44, 44], fill=(215, 25, 33, 255))
    return img


def start_server():
    """Start the dashboard HTTP server in a thread."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('serve', os.path.join(DIR, 'serve.py'))
    serve_mod = importlib.util.module_from_spec(spec)

    # Patch sys.argv for serve.py
    old_argv = sys.argv
    sys.argv = ['serve.py', str(PORT)]
    try:
        spec.loader.exec_module(serve_mod)
    except SystemExit:
        pass
    finally:
        sys.argv = old_argv


def run_tray():
    """Main tray icon loop."""
    import pystray

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait for server to be ready
    time.sleep(2)

    def open_dashboard(icon, item):
        webbrowser.open(DASHBOARD_URL)

    def show_status(icon, item):
        try:
            import urllib.request
            r = urllib.request.urlopen(f'{DASHBOARD_URL}/api/health', timeout=3)
            import json
            data = json.loads(r.read())
            projects = data.get('projects', 0)
            uptime = data.get('uptime', 0)
            orch = data.get('orchestrator', 'none')
            icon.notify(
                f'Projects: {projects}\nOrchestrator: {orch}\nUptime: {uptime // 60}m',
                'Command Center Status'
            )
        except Exception as e:
            icon.notify(f'Error: {e}', 'Command Center')

    def quit_app(icon, item):
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem('Open Dashboard', open_dashboard, default=True),
        pystray.MenuItem('Status', show_status),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Quit', quit_app),
    )

    icon = pystray.Icon(
        'agent-cc',
        create_icon_image(),
        'Agent Command Center',
        menu
    )

    # Auto-open dashboard on first launch
    threading.Timer(3.0, lambda: webbrowser.open(DASHBOARD_URL)).start()

    print(f'Agent Command Center running in system tray')
    print(f'Dashboard: {DASHBOARD_URL}')
    icon.run()


if __name__ == '__main__':
    run_tray()
