import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

export interface FixtureTemplate {
  /** The `template.yaml` contents; `null` leaves the manifest out. */
  readonly manifest: string | null;
  /** Files under `files/`, by `/`-separated path. */
  readonly files?: Record<string, string | Uint8Array>;
  /** Set to false to leave the `files/` folder out. */
  readonly filesDir?: boolean;
}

/** Writes a template folder `root/folder` and returns its path. */
export function writeTemplate(root: string, folder: string, template: FixtureTemplate): string {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  if (template.manifest !== null) {
    writeFileSync(join(dir, 'template.yaml'), template.manifest);
  }
  if (template.filesDir !== false) {
    mkdirSync(join(dir, 'files'), { recursive: true });
  }
  for (const [path, contents] of Object.entries(template.files ?? {})) {
    const target = join(dir, 'files', ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  return dir;
}

/** A `template.yaml` with the given id, description and raw YAML for `variables`. */
export function manifest(id: string, variables?: string, description = `The ${id} template`): string {
  return `id: ${id}\ndescription: ${description}\n${variables === undefined ? '' : `variables:\n${variables}`}`;
}

export interface TempDir {
  /** A fresh, empty folder for each test. */
  readonly path: string;
}

/** A temporary folder created before and removed after each test. */
export function useTempDir(prefix = 'agent-engineer-templates-'): TempDir {
  let path = '';
  beforeEach(() => {
    path = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  });
  afterEach(() => {
    rmSync(path, { recursive: true, force: true });
  });
  return {
    get path() {
      return path;
    },
  };
}
