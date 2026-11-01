import { describe, expect, it } from 'vitest';

import { buildTaskArgs, formatTaskCommand } from '../../../src/repo-runner/runners/taskCommand.js';

describe('taskCommand', () => {
  it('appends forwarded args directly by default', () => {
    const task = { binary: 'uv', args: ['run', 'pytest'] };

    expect(buildTaskArgs(task)).toEqual(['run', 'pytest']);
    expect(buildTaskArgs(task, ['-q'])).toEqual(['run', 'pytest', '-q']);
  });

  it('inserts the separator only when there are forwarded args', () => {
    const task = { binary: 'npm', args: ['run', 'lint'], argsSeparator: '--' };

    expect(buildTaskArgs(task, [])).toEqual(['run', 'lint']);
    expect(buildTaskArgs(task, ['--fix'])).toEqual(['run', 'lint', '--', '--fix']);
  });

  it('places forwarded args before trailing args', () => {
    const task = { binary: 'go', args: ['test'], trailingArgs: ['./...'] };

    expect(buildTaskArgs(task)).toEqual(['test', './...']);
    expect(buildTaskArgs(task, ['-run', 'TestX'])).toEqual(['test', '-run', 'TestX', './...']);
  });

  it('formats the full command line without forwarded args', () => {
    expect(formatTaskCommand({ binary: 'go', args: ['vet'], trailingArgs: ['./...'], argsSeparator: '--' })).toBe(
      'go vet ./...',
    );
  });
});
