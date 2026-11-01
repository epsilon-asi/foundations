import { describe, expect, it } from 'vitest';

import {
  MissingTaskError,
  RepoConfigParseError,
  RepoRunnerError,
  UnsupportedRepositoryError,
} from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { SandboxError } from '../../../src/shared/index.js';

describe('errors', () => {
  it('every error extends RepoRunnerError and SandboxError, is named after its class, and keeps the cause', () => {
    const cause = new Error('root cause');
    const errors = [
      new RepoRunnerError('base', { cause }),
      new UnsupportedRepositoryError('golang', '/repo', { cause }),
      new MissingTaskError('build', '/repo', [], { cause }),
      new RepoConfigParseError('/repo/go.mod', 'bad', { cause }),
    ];

    expect(errors.map((error) => error.name)).toEqual([
      'RepoRunnerError',
      'UnsupportedRepositoryError',
      'MissingTaskError',
      'RepoConfigParseError',
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(RepoRunnerError);
      expect(error).toBeInstanceOf(SandboxError);
      expect(error.cause).toBe(cause);
    }
  });

  it('carries structured metadata', () => {
    expect(new UnsupportedRepositoryError('golang', '/repo')).toMatchObject({
      kind: 'golang',
      repoPath: '/repo',
      message: 'Repository at /repo is not compatible with runner kind "golang".',
    });
    expect(new RepoConfigParseError('/repo/go.mod', 'bad')).toMatchObject({
      filePath: '/repo/go.mod',
      message: 'Failed to parse /repo/go.mod: bad',
    });
  });

  it('MissingTaskError lists the available tasks when known', () => {
    expect(new MissingTaskError('deploy', '/repo', ['build', 'test'])).toMatchObject({
      taskName: 'deploy',
      repoPath: '/repo',
      availableTasks: ['build', 'test'],
      message: 'Task "deploy" was not found in repository /repo. Available tasks: build, test.',
    });
    expect(new MissingTaskError('deploy', '/repo').message).toBe('Task "deploy" was not found in repository /repo.');
  });
});
