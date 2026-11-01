import { describe, expect, it } from 'vitest';

import {
  CommandExecutionError,
  CommandFailedError,
  GitWorktreeManager,
  type EnvironmentOverrides,
} from '../../../src/git-manager/index.js';
import { nodeFilesystem } from '../../../src/git-manager/internal/filesystem.js';
import { readGitValue, runGit, type GitContext } from '../../../src/git-manager/workflows/gitContext.js';
import { createFakeExecutor, type FakeExecutor, type RecordedCall } from '../fixtures/fakeExecutor.js';

const CWD = '/nonexistent/git-manager-unit/repo';

function contextFor(fake: FakeExecutor, env?: EnvironmentOverrides): GitContext {
  return { repoPath: CWD, executor: fake.executor, gitBinary: 'git-under-test', env, filesystem: nodeFilesystem };
}

describe('runGit', () => {
  it('runs the configured binary in cwd and returns stdout, passing no env or stdin when none is set', async () => {
    const fake = createFakeExecutor(() => 'output\n');

    expect(await runGit(contextFor(fake), CWD, ['status'])).toBe('output\n');
    expect(fake.calls).toStrictEqual([{ binary: 'git-under-test', args: ['status'], options: { cwd: CWD } }]);
  });

  it('layers the command env over the manager env and keeps undefined values so the executor unsets them', async () => {
    const fake = createFakeExecutor();
    const context = contextFor(fake, { GM_BASE: 'base', GM_OVERRIDDEN: 'base', GIT_DIR: undefined });

    await runGit(context, CWD, ['commit'], { env: { GM_OVERRIDDEN: 'command', GM_UNSET: undefined } });
    await runGit(contextFor(fake), CWD, ['commit'], { env: { GM_ONLY_COMMAND: '1' } });

    expect(fake.calls.map((call) => call.options.env)).toStrictEqual([
      { GM_BASE: 'base', GM_OVERRIDDEN: 'command', GIT_DIR: undefined, GM_UNSET: undefined },
      { GM_ONLY_COMMAND: '1' },
    ]);
  });

  it('passes stdin to the executor', async () => {
    const fake = createFakeExecutor();

    await runGit(contextFor(fake), CWD, ['apply', '-'], { stdin: 'patch body' });

    expect(fake.calls[0]?.options).toStrictEqual({ cwd: CWD, stdin: 'patch body' });
  });

  it.each([
    ['a non-zero exit', { exitCode: 128, stderr: 'fatal: bad revision\n' }, 'exit code 128'],
    ['a terminating signal', { exitCode: null, signal: 'SIGTERM' as const }, 'signal SIGTERM'],
    ['a timeout', { exitCode: null, signal: 'SIGKILL' as const, timedOut: true }, 'timed out'],
  ])('throws CommandFailedError with the full result for %s', async (_label, response, outcome) => {
    const fake = createFakeExecutor(() => ({ stdout: 'partial', ...response }));

    const error: unknown = await runGit(contextFor(fake), CWD, ['rev-parse', 'nope']).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect((error as CommandFailedError).result).toMatchObject({
      command: ['git-under-test', 'rev-parse', 'nope'],
      cwd: CWD,
      stdout: 'partial',
      ...response,
    });
    expect((error as Error).message).toContain(`git-under-test rev-parse nope failed (${outcome})`);
  });

  it('includes trimmed git stderr in the failure message', async () => {
    const fake = createFakeExecutor(() => ({ exitCode: 1, stderr: '  error: patch failed  \n' }));

    await expect(runGit(contextFor(fake), CWD, ['apply', '-'])).rejects.toThrow(
      'git-under-test apply - failed (exit code 1)\nerror: patch failed',
    );
  });

  it('propagates executor rejections such as CommandExecutionError unchanged', async () => {
    const spawnFailure = new CommandExecutionError('Failed to execute command: git-under-test', {
      binary: 'git-under-test',
      args: ['status'],
      cwd: CWD,
    });
    const fake = createFakeExecutor(() => {
      throw spawnFailure;
    });

    await expect(runGit(contextFor(fake), CWD, ['status'])).rejects.toBe(spawnFailure);
  });

  it('readGitValue strips the trailing line break only', async () => {
    const fake = createFakeExecutor(() => ' value with spaces \r\n');

    expect(await readGitValue(contextFor(fake), CWD, ['rev-parse', 'HEAD'])).toBe(' value with spaces ');
  });
});

describe('GitWorktreeManager executor defaults', () => {
  it('runs `git` without env overrides when gitBinary and env are omitted', async () => {
    const respond = (call: RecordedCall): string => `${call.options.cwd ?? ''}\n`;
    const fake = createFakeExecutor(respond);

    await new GitWorktreeManager({ repoPath: CWD, executor: fake.executor }).getRepoRoot();

    expect(fake.calls).toStrictEqual([
      { binary: 'git', args: ['rev-parse', '--show-toplevel'], options: { cwd: CWD } },
    ]);
  });
});
