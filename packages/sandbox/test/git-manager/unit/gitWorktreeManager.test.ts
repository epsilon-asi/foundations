import { describe, expect, it } from 'vitest';

import {
  GitOutputParseError,
  GitUsageError,
  GitWorktreeManager,
  type FilesystemPort,
} from '../../../src/git-manager/index.js';
import { createFakeExecutor, type RecordedCall } from '../fixtures/fakeExecutor.js';

const REPO = '/nonexistent/git-manager-unit/repo';
const WORKTREE = '/nonexistent/git-manager-unit/worktree';

function createFakeFilesystem() {
  const operations: string[] = [];
  const filesystem: FilesystemPort = {
    mkdir: async (path) => {
      operations.push(`mkdir ${path}`);
    },
    copyFileOrSymlink: async (source, destination) => {
      operations.push(`copy ${source} -> ${destination}`);
    },
  };
  return { filesystem, operations };
}

const headResponses = (call: RecordedCall): string =>
  ({
    'rev-parse --show-toplevel': `${call.options.cwd ?? ''}\n`,
    'rev-parse HEAD': 'abc123\n',
    'rev-parse --abbrev-ref HEAD': 'main\n',
  })[call.args.join(' ')] ?? '';

function createManager(respond?: (call: RecordedCall) => string) {
  const fakeExecutor = createFakeExecutor(respond);
  const fakeFilesystem = createFakeFilesystem();
  const manager = new GitWorktreeManager({
    repoPath: REPO,
    executor: fakeExecutor.executor,
    filesystem: fakeFilesystem.filesystem,
  });
  return { manager, ...fakeExecutor, ...fakeFilesystem };
}

describe('GitWorktreeManager with substituted ports', () => {
  it('runs repository queries through the injected executor, defaulting to repoPath', async () => {
    const { manager, argv } = createManager(headResponses);

    expect(await manager.ensureRepository()).toEqual({ repoRoot: REPO, headSha: 'abc123', currentBranch: 'main' });
    expect(await manager.getHeadSha(WORKTREE)).toBe('abc123');
    expect(argv()).toEqual([
      `${REPO} rev-parse --show-toplevel`,
      `${REPO} rev-parse HEAD`,
      `${REPO} rev-parse --abbrev-ref HEAD`,
      `${WORKTREE} rev-parse HEAD`,
    ]);
  });

  it('creates a worktree through the filesystem port and the worktree add builder', async () => {
    const { manager, argv, operations } = createManager(headResponses);

    const worktree = await manager.createWorktree({ worktreePath: WORKTREE, branchName: 'agent/x', startRef: 'v1' });

    expect(worktree).toEqual({
      repoRoot: REPO,
      worktreePath: WORKTREE,
      startRef: 'v1',
      headSha: 'abc123',
      branchName: 'main',
      overlayApplied: false,
      untrackedFilesCopied: [],
    });
    expect(operations).toEqual(['mkdir /nonexistent/git-manager-unit']);
    expect(argv()).toEqual([
      `${REPO} rev-parse --show-toplevel`,
      `${REPO} worktree add --quiet -b agent/x ${WORKTREE} v1`,
      `${WORKTREE} rev-parse HEAD`,
      `${WORKTREE} rev-parse --abbrev-ref HEAD`,
    ]);
  });

  it('commits with the author identity in the command environment', async () => {
    const { manager, calls } = createManager(headResponses);

    await manager.commit({
      worktreePath: WORKTREE,
      message: 'msg',
      stageAll: false,
      author: { name: 'Bot', email: 'b@x' },
    });

    expect(calls[0]).toEqual({
      binary: 'git',
      args: ['commit', '--no-gpg-sign', '-m', 'msg'],
      options: {
        cwd: WORKTREE,
        env: { GIT_AUTHOR_NAME: 'Bot', GIT_AUTHOR_EMAIL: 'b@x', GIT_COMMITTER_NAME: 'Bot', GIT_COMMITTER_EMAIL: 'b@x' },
      },
    });
  });

  it('checks before applying a patch, stops after the check when checkOnly, and skips empty patches', async () => {
    const { manager, calls } = createManager();

    expect(await manager.applyPatch({ worktreePath: WORKTREE, patch: '' })).toEqual({
      worktreePath: WORKTREE,
      checkOnly: false,
      index: false,
      appliedBytes: 0,
    });
    expect(calls).toEqual([]);

    await manager.applyPatch({ worktreePath: WORKTREE, patch: 'diff\n', index: true });
    await manager.applyPatch({ worktreePath: WORKTREE, patch: 'diff\n', checkOnly: true });

    expect(calls.map((call) => [call.args.join(' '), call.options.stdin])).toEqual([
      ['apply --whitespace=nowarn --index --check -', 'diff\n'],
      ['apply --whitespace=nowarn --index -', 'diff\n'],
      ['apply --whitespace=nowarn --check -', 'diff\n'],
    ]);
  });

  it('copies untracked files through the filesystem port and skips apply for an empty tracked diff', async () => {
    const { manager, argv, operations } = createManager((call) => {
      if (call.args[0] === 'ls-files') {
        return 'new.txt\0dir/link\0';
      }
      return call.args.includes('--git-common-dir') ? '/shared/.git\n' : headResponses(call);
    });

    const result = await manager.overlayWorkingChanges({ worktreePath: WORKTREE, includeUntracked: true });

    expect(result).toEqual({
      worktreePath: WORKTREE,
      sourcePath: REPO,
      trackedPatchBytes: 0,
      untrackedFilesCopied: ['new.txt', 'dir/link'],
    });
    expect(operations).toEqual([
      `copy ${REPO}/new.txt -> ${WORKTREE}/new.txt`,
      `copy ${REPO}/dir/link -> ${WORKTREE}/dir/link`,
    ]);
    expect(argv().filter((line) => line.includes(' apply '))).toEqual([]);
  });

  it('applies the tracked diff and leaves untracked files alone unless requested', async () => {
    const { manager, argv, operations } = createManager((call) => {
      if (call.args[0] === 'diff') {
        return 'diff --git a/x b/x\n';
      }
      return call.args.includes('--git-common-dir') ? '/shared/.git\n' : headResponses(call);
    });

    const result = await manager.overlayWorkingChanges({ worktreePath: WORKTREE, sourcePath: REPO });

    expect(result).toMatchObject({ trackedPatchBytes: 19, untrackedFilesCopied: [] });
    expect(operations).toEqual([]);
    expect(argv().filter((line) => !line.includes('rev-parse'))).toEqual([
      `${REPO} diff --binary --find-renames`,
      `${WORKTREE} apply --whitespace=nowarn --check -`,
      `${WORKTREE} apply --whitespace=nowarn -`,
    ]);
  });

  it('refuses to overlay across repositories', async () => {
    const { manager } = createManager((call) =>
      call.args.includes('--git-common-dir') ? `${call.options.cwd ?? ''}/.git\n` : headResponses(call),
    );

    await expect(manager.overlayWorkingChanges({ worktreePath: WORKTREE })).rejects.toThrow(GitUsageError);
  });

  it('surfaces malformed git output as GitOutputParseError', async () => {
    const { manager } = createManager(() => '?');

    await expect(manager.getStatus()).rejects.toBeInstanceOf(GitOutputParseError);
  });

  it.each([
    [
      'createWorktree with branchName and detached',
      (m: GitWorktreeManager) => m.createWorktree({ worktreePath: WORKTREE, branchName: 'x', detached: true }),
    ],
    [
      'createWorktree without branchName or detached',
      (m: GitWorktreeManager) => m.createWorktree({ worktreePath: WORKTREE }),
    ],
    [
      'createWorktree with a blank branchName',
      (m: GitWorktreeManager) => m.createWorktree({ worktreePath: WORKTREE, branchName: '  ' }),
    ],
    [
      'createBranch with a blank branchName',
      (m: GitWorktreeManager) => m.createBranch({ worktreePath: WORKTREE, branchName: '' }),
    ],
    ['stagePaths without paths', (m: GitWorktreeManager) => m.stagePaths({ worktreePath: WORKTREE, paths: [] })],
    ['commit with a blank message', (m: GitWorktreeManager) => m.commit({ worktreePath: WORKTREE, message: ' \n' })],
  ])('rejects %s before running git', async (_label, action) => {
    const { manager, calls } = createManager();

    await expect(action(manager)).rejects.toBeInstanceOf(GitUsageError);
    expect(calls).toEqual([]);
  });

  it('removes a worktree from the repository root and prunes on request', async () => {
    const { manager, argv } = createManager(headResponses);

    await manager.removeWorktree({ worktreePath: WORKTREE, force: true, prune: true });
    await manager.pruneWorktrees();
    await manager.stageAll(WORKTREE);

    expect(argv()).toEqual([
      `${REPO} rev-parse --show-toplevel`,
      `${REPO} worktree remove --force ${WORKTREE}`,
      `${REPO} worktree prune`,
      `${REPO} rev-parse --show-toplevel`,
      `${REPO} worktree prune`,
      `${WORKTREE} add -A -- .`,
    ]);
  });

  it('combines a custom executor with gitBinary and env', async () => {
    const { executor, calls } = createFakeExecutor();
    const manager = new GitWorktreeManager({
      repoPath: REPO,
      executor,
      gitBinary: '/opt/git/bin/git',
      env: { GIT_CONFIG_NOSYSTEM: '1', GIT_DIR: undefined },
    });

    await manager.getStatus();

    expect(calls).toEqual([
      {
        binary: '/opt/git/bin/git',
        args: ['status', '--porcelain=v1', '-z'],
        options: { cwd: REPO, env: { GIT_CONFIG_NOSYSTEM: '1', GIT_DIR: undefined } },
      },
    ]);
  });
});
