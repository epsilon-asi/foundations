import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLI, ENV_VARS } from '../src/config.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** Runs the real entrypoint in a child process, the way the `bin` would. */
function cli(...args: string[]) {
  const { [ENV_VARS.logLevel]: _ignored, ...env } = process.env;

  return spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args], {
    cwd: packageRoot,
    env,
    encoding: 'utf8',
  });
}

describe('main entrypoint', () => {
  it('exits 0 and prints the version', () => {
    const result = cli('--version');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${CLI.version}\n`);
  });

  it('sets a non-zero exit code on invalid input', () => {
    const result = cli('info', '--format', 'xml');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Allowed choices are text, json');
  });
});
