import { describe, expect, it } from 'vitest';

import {
  buildInstallPlan,
  buildNpmTaskTable,
  getNpmBinary,
} from '../../../src/repo-runner/runners/node-typescript/npmCommands.js';
import { buildTaskArgs } from '../../../src/repo-runner/runners/taskCommand.js';
import { withProcessPlatform } from '../helpers/testUtils.js';

describe('npmCommands', () => {
  it('returns npm on non-Windows platforms and npm.cmd on Windows', () => {
    expect(withProcessPlatform('linux', () => getNpmBinary())).toBe('npm');
    expect(withProcessPlatform('win32', () => getNpmBinary())).toBe('npm.cmd');
  });

  it('builds install and ci plans', () => {
    expect(buildInstallPlan(false)).toEqual({ binary: 'npm', args: ['install'], mode: 'install' });
    expect(buildInstallPlan(true)).toEqual({ binary: 'npm', args: ['ci'], mode: 'ci' });
  });

  it('maps scripts to npm test / npm run <name>, described by the script body', () => {
    const tasks = buildNpmTaskTable({ test: 'vitest', lint: 'eslint .' });

    expect([...tasks]).toEqual([
      ['test', { binary: 'npm', args: ['test'], argsSeparator: '--', description: 'vitest' }],
      ['lint', { binary: 'npm', args: ['run', 'lint'], argsSeparator: '--', description: 'eslint .' }],
    ]);
  });

  it('forwards extra args after --', () => {
    const tasks = buildNpmTaskTable({ test: 'vitest', lint: 'eslint .' });
    const lint = tasks.get('lint');
    const test = tasks.get('test');
    if (lint === undefined || test === undefined) {
      throw new Error('expected lint and test tasks');
    }

    expect(buildTaskArgs(lint)).toEqual(['run', 'lint']);
    expect(buildTaskArgs(lint, ['--fix'])).toEqual(['run', 'lint', '--', '--fix']);
    expect(buildTaskArgs(test, ['--runInBand'])).toEqual(['test', '--', '--runInBand']);
  });
});
