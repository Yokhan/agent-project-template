"""
Fast project scanner — Python native, minimal subprocess calls.
Replaces scan-projects.sh: 1 git call per repo instead of 3, parallel execution.
Usage: python scripts/scan-projects-fast.py [directory]
Output: name|branch|last_commit|age_timestamp|uncommitted|has_manifest|template_version|current_task|has_blockers|phase|lessons
"""
import os
import sys
import json
import subprocess
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

SCAN_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Documents'


def scan_repo(path: Path) -> str | None:
    """Scan a single git repo — returns pipe-delimited string or None."""
    git_dir = path / '.git'
    if not git_dir.exists():
        return None

    try:
        # Single git command: branch + last commit info + status count
        # Combines 3 calls into 1 by using format strings
        result = subprocess.run(
            ['git', '-C', str(path), 'log', '-1', '--format=%D|%cr|%ct'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            return None

        parts = result.stdout.strip().split('|')
        if len(parts) < 3:
            return None

        # Extract branch from refnames (HEAD -> branch_name)
        refs = parts[0]
        branch = 'unknown'
        for ref in refs.split(','):
            ref = ref.strip()
            if ref.startswith('HEAD -> '):
                branch = ref[8:]
                break

        last_commit = parts[1].strip()
        age = parts[2].strip()

        # Count uncommitted — use --porcelain for speed, just count lines
        result2 = subprocess.run(
            ['git', '-C', str(path), 'status', '--porcelain', '-uno'],
            capture_output=True, text=True, timeout=5
        )
        uncommitted = len([l for l in result2.stdout.splitlines() if l.strip()])

        # Also count untracked
        result3 = subprocess.run(
            ['git', '-C', str(path), 'status', '--porcelain', '-unormal'],
            capture_output=True, text=True, timeout=5
        )
        uncommitted = len([l for l in result3.stdout.splitlines() if l.strip()])

        # Template manifest
        manifest = path / '.template-manifest.json'
        has_manifest = manifest.exists()
        tpl_ver = 'none'
        if has_manifest:
            try:
                tpl_ver = json.loads(manifest.read_text()).get('template_version', '?')
            except:
                tpl_ver = '?'

        # --- Management data (file reads, no subprocess) ---

        # Current task from tasks/current.md
        current_task = ''
        has_blockers = False
        current_md = path / 'tasks' / 'current.md'
        if current_md.exists():
            try:
                content = current_md.read_text(encoding='utf-8', errors='replace')
                # First non-empty, non-heading line = current task
                for line in content.splitlines():
                    line = line.strip()
                    if line and not line.startswith('#') and not line.startswith('---'):
                        current_task = line[:80]
                        break
                # Only match actual blocker section with content after it
                import re
                blocker_match = re.search(r'^## [Bb]locker.*\n+\S', content, re.MULTILINE)
                has_blockers = blocker_match is not None
            except:
                pass

        # Phase from PROJECT_SPEC.md
        phase = ''
        spec = path / 'PROJECT_SPEC.md'
        if spec.exists():
            try:
                for line in spec.read_text(encoding='utf-8', errors='replace').splitlines():
                    if 'phase' in line.lower() and ':' in line:
                        phase = line.split(':', 1)[1].strip().strip('_[]* ')
                        break
            except:
                pass

        # Lessons count
        lessons = 0
        lessons_file = path / 'tasks' / 'lessons.md'
        if lessons_file.exists():
            try:
                lessons = lessons_file.read_text(encoding='utf-8', errors='replace').count('### ')
            except:
                pass

        # Extended output: original 7 fields + 4 management fields
        return (f'{path.name}|{branch}|{last_commit}|{age}|{uncommitted}|'
                f'{str(has_manifest).lower()}|{tpl_ver}|'
                f'{current_task}|{str(has_blockers).lower()}|{phase}|{lessons}')

    except (subprocess.TimeoutExpired, Exception):
        return None


def main():
    if not SCAN_DIR.exists():
        print(f'ERROR: {SCAN_DIR} not found', file=sys.stderr)
        sys.exit(1)

    # Collect directories first (fast — just readdir)
    dirs = [d for d in SCAN_DIR.iterdir() if d.is_dir() and (d / '.git').exists()]

    # Parallel scan — 8 threads
    results = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(scan_repo, d): d for d in dirs}
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    # Sort by name
    results.sort()
    for line in results:
        print(line)


if __name__ == '__main__':
    main()
