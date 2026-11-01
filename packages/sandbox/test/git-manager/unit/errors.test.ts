import { describe, expect, it } from 'vitest';

import { GitError, GitOutputParseError, GitUsageError, SandboxError } from '../../../src/git-manager/index.js';

describe('error hierarchy', () => {
  it.each([
    ['GitError', new GitError('base')],
    ['GitUsageError', new GitUsageError('usage')],
    ['GitOutputParseError', new GitOutputParseError('parse', 'raw output')],
  ])('%s extends GitError and SandboxError with a matching name', (name, error) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SandboxError);
    expect(error).toBeInstanceOf(GitError);
    expect(error.name).toBe(name);
  });

  it('keeps structured payloads and causes', () => {
    const cause = new Error('underlying');
    const parseError = new GitOutputParseError('bad', 'raw', { cause });

    expect(parseError.output).toBe('raw');
    expect(parseError.cause).toBe(cause);
    expect(new GitUsageError('usage', { cause }).cause).toBe(cause);
  });
});
