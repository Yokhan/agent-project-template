import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

const exec = promisify(execCb);

/**
 * Bridge to Engram memory. Checks if Engram is available and queries it.
 * Falls back to file-based memory (tasks/lessons.md, brain/) if Engram unavailable.
 */

let engramAvailable: boolean | null = null;

async function checkEngram(): Promise<boolean> {
  if (engramAvailable !== null) return engramAvailable;

  // Check if engram binary exists
  try {
    await exec('engram --version', { timeout: 2000 });
    engramAvailable = true;
  } catch {
    // Check if engram is configured in .mcp.json
    try {
      if (existsSync('.mcp.json')) {
        const config = JSON.parse(await readFile('.mcp.json', 'utf-8'));
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

/**
 * Search Engram for relevant memories. Returns formatted string.
 * Falls back to grep on tasks/lessons.md if Engram unavailable.
 */
export async function searchMemory(keywords: string): Promise<string> {
  if (!keywords) return '';

  const isAvailable = await checkEngram();

  if (isAvailable) {
    // Try engram CLI search
    try {
      const { stdout } = await exec(
        `engram search "${keywords.replace(/"/g, '\\"')}" --limit 5 --format text`,
        { timeout: 5000 }
      );
      if (stdout.trim()) {
        return `=== ENGRAM MEMORY ===\n${stdout.trim()}`;
      }
    } catch {
      // Engram available but search failed — fall through to file fallback
    }
  }

  // File fallback: grep lessons + brain/
  const results: string[] = [];

  if (existsSync('tasks/lessons.md')) {
    try {
      const { stdout } = await exec(
        `grep -i "${keywords.split(/\s+/)[0]}" tasks/lessons.md | head -5`,
        { timeout: 2000 }
      );
      if (stdout.trim()) results.push(`LESSONS:\n${stdout.trim()}`);
    } catch { /* no matches */ }
  }

  if (existsSync('brain/03-knowledge')) {
    try {
      const { stdout } = await exec(
        `grep -rl "${keywords.split(/\s+/)[0]}" brain/03-knowledge/ 2>/dev/null | head -3`,
        { timeout: 2000 }
      );
      if (stdout.trim()) results.push(`BRAIN FILES:\n${stdout.trim()}`);
    } catch { /* no matches */ }
  }

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
