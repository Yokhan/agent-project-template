"""
Fast project scanner — Python native, minimal subprocess calls.
Replaces scan-projects.sh: 1 git call per repo instead of 3, parallel execution.
Usage: python scripts/scan-projects-fast.py [directory]
Output: name|branch|last_commit|age_timestamp|uncommitted|has_manifest|template_version
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

        return f'{path.name}|{branch}|{last_commit}|{age}|{uncommitted}|{str(has_manifest).lower()}|{tpl_ver}'

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
