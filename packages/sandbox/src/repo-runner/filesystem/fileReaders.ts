import { readdir, readFile } from 'node:fs/promises';

import { isMissingPathError } from '../../shared/fs.js';

/** Reads a UTF-8 text file. */
export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

/** Names of the regular files directly inside `dirPath`, sorted; `[]` when `dirPath` is missing or not a directory. */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
  }
}
