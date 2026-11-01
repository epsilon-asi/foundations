import type { TaskTable } from '../../contracts/runner.js';
import type { NodeInstallPlan } from './nodeTypescript.contracts.js';

/** `npm.cmd` on Windows, `npm` elsewhere. */
export function getNpmBinary(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/** `npm ci` when a lockfile exists (reproducible install), otherwise `npm install`. */
export function buildInstallPlan(hasLockfile: boolean): NodeInstallPlan {
  const mode = hasLockfile ? 'ci' : 'install';
  return { binary: getNpmBinary(), args: [mode], mode };
}

/**
 * One task per `package.json` script: `npm test` for `test`, `npm run <name>` otherwise.
 * Forwarded args follow `--` so npm passes them to the script; the description is the script body.
 */
export function buildNpmTaskTable(scripts: Readonly<Record<string, string>>): TaskTable {
  const binary = getNpmBinary();
  return new Map(
    Object.entries(scripts).map(([name, body]) => [
      name,
      { binary, args: name === 'test' ? ['test'] : ['run', name], argsSeparator: '--', description: body },
    ]),
  );
}
