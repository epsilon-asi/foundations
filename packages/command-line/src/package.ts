import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PackageJson } from './types.js';

/** The directory to start searching from: `from` itself when it is a directory, otherwise its parent. */
function startDirectory(from: string | URL): string {
  const path =
    from instanceof URL ? fileURLToPath(from) : from.startsWith('file:') ? fileURLToPath(from) : resolve(from);

  try {
    if (statSync(path).isDirectory()) return path;
  } catch {
    // A path that does not exist still names a place to search from.
  }

  return dirname(path);
}

/**
 * Path of the nearest package.json in or above `from`, which is a `file:` URL
 * (typically `import.meta.url`) or a path to a file or directory. Throws when
 * there is none.
 */
export function findPackageJson(from: string | URL): string {
  const start = startDirectory(from);
  let directory = start;

  for (;;) {
    const candidate = join(directory, 'package.json');
    if (existsSync(candidate)) return candidate;

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`No package.json found in ${start} or any directory above it.`);
    }
    directory = parent;
  }
}

/**
 * Parses the nearest package.json in or above `from`. Pass `import.meta.url`
 * to read the package the calling module belongs to; it resolves the same
 * from `src/` (tsx, vitest) and from a compiled `dist/`.
 */
export function readPackageJson(from: string | URL): PackageJson {
  const path = findPackageJson(from);
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} does not contain a JSON object.`);
  }

  return parsed as PackageJson;
}

/**
 * The name a package's CLI is invoked by: its single `bin` entry, or its
 * package name without the scope. Undefined when the package declares several
 * bins (none of them is "the" CLI) or has no name.
 */
export function cliNameFromPackage(packageJson: PackageJson): string | undefined {
  const { bin, name } = packageJson;

  if (typeof bin === 'object' && bin !== null) {
    const names = Object.keys(bin);
    if (names.length === 1) return names[0];
    if (names.length > 1) return undefined;
  }

  if (typeof name !== 'string' || name === '') return undefined;
  return name.replace(/^@[^/]+\//, '');
}
