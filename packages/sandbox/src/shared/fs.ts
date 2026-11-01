import { access, realpath } from 'node:fs/promises';
import path from 'node:path';

/** `true` for filesystem errors meaning "nothing at this path" (`ENOENT`, `ENOTDIR`). */
export function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

/** Whether anything exists at `filePath`; other filesystem errors (e.g. `EACCES`) are rethrown. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

/** Absolute, symlink-resolved form of `filePath`; paths that do not exist yet are only resolved. */
export async function canonicalPath(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);
  try {
    return await realpath(resolved);
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return resolved;
    }
    throw error;
  }
}
