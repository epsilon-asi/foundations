import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, vi } from 'vitest';

export interface ConfigSandbox {
  /** The fake home directory, so `~/.easi` never reads the real one. */
  readonly home: string;
  /** The parent of `cwd`. */
  readonly project: string;
  /** The working directory every run starts from. */
  readonly cwd: string;
  /** Writes `contents` to `filePath`, creating its directories. */
  write(filePath: string, contents: string): string;
}

/**
 * Points HOME and process.cwd() at an empty temporary tree for each test, so
 * the config middleware only sees the files a test writes.
 */
export function useConfigSandbox(): ConfigSandbox {
  let root = '';
  const sandbox = {
    get home() {
      return join(root, 'home');
    },
    get project() {
      return join(root, 'project');
    },
    get cwd() {
      return join(root, 'project', 'pkg');
    },
    write(filePath: string, contents: string): string {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents);
      return filePath;
    },
  };

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-engineer-config-')));
    mkdirSync(sandbox.cwd, { recursive: true });
    mkdirSync(sandbox.home, { recursive: true });
    vi.stubEnv('HOME', sandbox.home);
    vi.spyOn(process, 'cwd').mockReturnValue(sandbox.cwd);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  return sandbox;
}
