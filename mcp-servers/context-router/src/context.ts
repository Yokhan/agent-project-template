import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import type { ProjectContext } from './types.js';

const exec = promisify(execCb);

const LIBRARY_PATH = join(process.cwd(), '.claude', 'library');

export async function loadRules(files: string[]): Promise<{ text: string; lines: number }> {
  const contents: string[] = [];
  let totalLines = 0;

  await Promise.all(
    files.map(async (f) => {
      try {
        const fullPath = join(LIBRARY_PATH, f);
        const content = await readFile(fullPath, 'utf-8');
        contents.push(`# --- ${f} ---\n${content}`);
        totalLines += content.split('\n').length;
      } catch {
        // File not found — skip silently
      }
    })
  );

  return {
    text: contents.join('\n\n'),
    lines: totalLines
  };
}

export async function getProjectContext(keywords: string): Promise<ProjectContext> {
  const [lessons, research, gitLog, currentTask] = await Promise.all([
    grepFile('tasks/lessons.md', keywords),
    readIfExists('tasks/.research-cache.md'),
    getGitLog(),
    readIfExists('tasks/current.md', 30)
  ]);

  return { lessons, research, gitLog, currentTask };
}

async function grepFile(filePath: string, keywords: string): Promise<string> {
  if (!existsSync(filePath)) return '';

  try {
    const content = await readFile(filePath, 'utf-8');
    const keywordList = keywords.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    if (keywordList.length === 0) return '';

    const lines = content.split('\n');
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywordList.some(k => lineLower.includes(k))) {
        // Include context: 2 lines before and after
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        matches.push(lines.slice(start, end).join('\n'));
        matches.push('---');
      }
    }

    return matches.slice(0, 10).join('\n'); // Max 10 matches
  } catch {
    return '';
  }
}

async function readIfExists(filePath: string, maxLines?: number): Promise<string> {
  if (!existsSync(filePath)) return '';

  try {
    const content = await readFile(filePath, 'utf-8');
    if (maxLines) {
      return content.split('\n').slice(0, maxLines).join('\n');
    }
    return content;
  } catch {
    return '';
  }
}

async function getGitLog(): Promise<string> {
  try {
    const { stdout } = await exec('git log --oneline -5', { timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}
