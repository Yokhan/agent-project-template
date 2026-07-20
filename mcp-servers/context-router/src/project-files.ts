import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_MAX_BYTES = 1024 * 1024;
const ROOT_INPUT = process.env.CONTEXT_ROUTER_PROJECT_ROOT || process.cwd();
export const PROJECT_ROOT = realpathSync.native(resolve(ROOT_INPUT));

function isInsideRoot(candidate: string): boolean {
  const relation = relative(PROJECT_ROOT, candidate);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}

export function normalizeProjectPath(input: string): string {
  if (!input || input.includes("\0") || isAbsolute(input) || /^[a-zA-Z]:[\\/]/u.test(input) || /^\\\\/u.test(input)) {
    throw new Error(`Unsafe project path: ${input}`);
  }
  const normalized = input.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/+$/u, "");
  const parts = normalized.split("/");
  if (!normalized || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe project path: ${input}`);
  }
  return normalized;
}

function inspectComponents(relativePath: string, allowMissingLeaf: boolean): string {
  const normalized = normalizeProjectPath(relativePath);
  const parts = normalized.split("/");
  let current = PROJECT_ROOT;
  for (let index = 0; index < parts.length; index += 1) {
    current = resolve(current, parts[index]);
    if (!isInsideRoot(current)) throw new Error(`Project path escapes root: ${relativePath}`);
    if (!existsSync(current) && allowMissingLeaf) return current;
    const info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`Symlink/reparse project path is not allowed: ${relativePath}`);
    if (index < parts.length - 1 && !info.isDirectory()) {
      throw new Error(`Non-directory project path component: ${relativePath}`);
    }
  }
  return current;
}

export function getProjectPath(relativePath: string): string {
  return inspectComponents(relativePath, false);
}

export function getOptionalProjectPath(relativePath: string): string | null {
  const normalized = normalizeProjectPath(relativePath);
  const parts = normalized.split("/");
  const parent = parts.slice(0, -1).join("/");
  if (parent) inspectComponents(parent, true);
  const candidate = resolve(PROJECT_ROOT, normalized);
  return existsSync(candidate) ? inspectComponents(normalized, false) : null;
}

export function readProjectText(relativePath: string, maxBytes = DEFAULT_MAX_BYTES): string {
  const filePath = getProjectPath(relativePath);
  const info = lstatSync(filePath);
  if (!info.isFile()) throw new Error(`Project path is not a regular file: ${relativePath}`);
  if (info.size > maxBytes) throw new Error(`Project file exceeds ${maxBytes} bytes: ${relativePath}`);
  return readFileSync(filePath, "utf8");
}

export function ensureProjectDirectory(relativePath: string): string {
  const normalized = normalizeProjectPath(relativePath);
  const parent = dirname(normalized).replace(/\\/gu, "/");
  if (parent !== ".") inspectComponents(parent, false);
  const directoryPath = resolve(PROJECT_ROOT, normalized);
  if (!existsSync(directoryPath)) mkdirSync(directoryPath, { mode: 0o700 });
  return inspectComponents(normalized, false);
}

export function writeProjectTextAtomic(relativePath: string, text: string): void {
  const normalized = normalizeProjectPath(relativePath);
  const parent = dirname(normalized).replace(/\\/gu, "/");
  if (parent !== ".") inspectComponents(parent, false);
  const targetPath = inspectComponents(normalized, true);
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    writeFileSync(descriptor, text, "utf8");
    closeSync(descriptor);
    descriptor = null;
    inspectComponents(normalized, true);
    renameSync(temporaryPath, targetPath);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    try { unlinkSync(temporaryPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
