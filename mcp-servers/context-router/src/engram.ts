import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { readdirSync } from 'fs';
import { getOptionalProjectPath, readProjectText } from './project-files.js';

const execFile = promisify(execFileCb);

/**
 * Bridge to Engram memory. Checks if Engram is available and queries it.
 * Falls back to file-based memory (tasks/lessons.md, brain/) if Engram unavailable.
 */

let engramAvailable: boolean | null = null;

async function checkEngram(): Promise<boolean> {
  if (engramAvailable !== null) return engramAvailable;

  try {
    await execFile('engram', ['--version'], { timeout: 2000 });
    engramAvailable = true;
  } catch {
    try {
      if (getOptionalProjectPath('.mcp.json')) {
        const config = JSON.parse(readProjectText('.mcp.json'));
        engramAvailable = !!config?.mcpServers?.engram && !config.mcpServers.engram.disabled;
      } else {
        engramAvailable = false;
      }
    } catch {
      engramAvailable = false;
    }
  }
  return engramAvailable;
}

/** Node.js native grep — no shell dependency */
function nativeGrep(filePath: string, keyword: string, maxLines = 5): string {
  if (!getOptionalProjectPath(filePath)) return '';
  try {
    const content = readProjectText(filePath);
    const kw = keyword.toLowerCase();
    return content.split('\n')
      .filter(line => line.toLowerCase().includes(kw))
      .slice(0, maxLines)
      .join('\n');
  } catch {
    return '';
  }
}

/** Node.js native find — search directory for files matching keyword */
function nativeFindFiles(dir: string, keyword: string, max = 3): string[] {
  const directoryPath = getOptionalProjectPath(dir);
  if (!directoryPath) return [];
  const results: string[] = [];
  const kw = keyword.toLowerCase();
  try {
    const walk = (d: string) => {
      if (results.length >= max) return;
      for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink() || !entry.isFile()) continue;
        const relativePath = `${dir}/${entry.name}`;
        try {
          const content = readProjectText(relativePath);
          if (content.toLowerCase().includes(kw)) results.push(relativePath);
        } catch { /* skip binary/inaccessible */ }
      }
    };
    walk(directoryPath);
  } catch { /* dir inaccessible */ }
  return results;
}

/**
 * Search Engram for relevant memories. Returns formatted string.
 * Falls back to Node.js native file search if Engram unavailable.
 */
export async function searchMemory(keywords: string): Promise<string> {
  if (!keywords) return '';

  const isAvailable = await checkEngram();

  if (isAvailable) {
    try {
      const { stdout } = await execFile(
        'engram',
        ['search', keywords, '--limit', '5', '--format', 'text'],
        { timeout: 5000 }
      );
      if (stdout.trim()) {
        return `=== ENGRAM MEMORY ===\n${stdout.trim()}`;
      }
    } catch (err) {
      // Engram available but search failed — fall through to file fallback
      // Log: err instanceof Error ? err.message : 'search failed'
    }
  }

  // File fallback: Node.js native search (no shell commands)
  const results: string[] = [];
  const firstKeyword = keywords.split(/\s+/)[0] || keywords;

  const lessonsMatch = nativeGrep('tasks/lessons.md', firstKeyword);
  if (lessonsMatch) results.push(`LESSONS:\n${lessonsMatch}`);

  const brainFiles = nativeFindFiles('brain/03-knowledge', firstKeyword);
  if (brainFiles.length) results.push(`BRAIN FILES:\n${brainFiles.join('\n')}`);

  if (results.length > 0) {
    return `=== MEMORY (file fallback) ===\n${results.join('\n')}`;
  }

  return '';
}

/**
 * Check if Engram is available (for status reporting)
 */
export async function getEngramStatus(): Promise<string> {
  const available = await checkEngram();
  return available ? 'engram: AVAILABLE' : 'engram: UNAVAILABLE (using file fallback)';
}
