import path from 'node:path';

import { listFiles, readTextFile } from '../../filesystem/fileReaders.js';

const REQUIRED_VERSION = /^\s*required_version\s*=\s*"(?<constraint>[^"]*)"/m;

/** `*.tf` file names directly inside `dirPath`, sorted; `[]` when the directory does not exist. */
export async function listTerraformFiles(dirPath: string): Promise<string[]> {
  return (await listFiles(dirPath)).filter((name) => name.endsWith('.tf'));
}

/** The `required_version = "..."` constraint in Terraform source, or `null` (a line-based scan, not an HCL parser). */
export function extractRequiredVersion(source: string): string | null {
  return REQUIRED_VERSION.exec(source)?.groups?.constraint ?? null;
}

/** The first `required_version` constraint across `files` (relative to `dirPath`), or `null`. */
export async function findRequiredVersion(dirPath: string, files: readonly string[]): Promise<string | null> {
  const sources = await Promise.all(files.map((file) => readTextFile(path.join(dirPath, file))));
  return sources.map(extractRequiredVersion).find((constraint) => constraint !== null) ?? null;
}
