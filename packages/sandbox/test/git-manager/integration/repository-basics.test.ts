import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { CommandExecutionError, CommandFailedError, GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('repository basics', () => {
  it('resolves repository details and parses real porcelain status output', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const repositoryInfo = await manager.ensureRepository();

      expect(repositoryInfo.repoRoot).toBe(repo.repoPath);
      expect(repositoryInfo.currentBranch).toBe('main');
      expect(repositoryInfo.headSha).toMatch(/^[0-9a-f]{40}$/u);
      await mkdir(join(repo.repoPath, 'nested', 'dir'), { recursive: true });
      expect(await manager.getRepoRoot(join(repo.repoPath, 'nested', 'dir'))).toBe(repo.repoPath);
      expect(await manager.getHeadSha()).toBe(repositoryInfo.headSha);
      expect(await manager.resolveRef('HEAD')).toBe(repositoryInfo.headSha);

      await writeFile(join(repo.repoPath, 'tracked.txt'), 'modified tracked\n', 'utf8');
      await writeFile(join(repo.repoPath, 'added.txt'), 'added file\n', 'utf8');
      await rm(join(repo.repoPath, 'delete-me.txt'));
      await rename(join(repo.repoPath, 'rename-me.txt'), join(repo.repoPath, 'renamed.txt'));
      await repo.runGit(['add', '-A', '--', '.']);
      await writeFile(join(repo.repoPath, 'untracked.txt'), 'untracked\n', 'utf8');

      const status = await manager.getStatus();
      const byPath = new Map(status.map((entry) => [entry.path, entry]));

      expect(byPath.get('tracked.txt')?.kind).toBe('modified');
      expect(byPath.get('added.txt')?.kind).toBe('added');
      expect(byPath.get('delete-me.txt')?.kind).toBe('deleted');
      expect(byPath.get('renamed.txt')?.kind).toBe('renamed');
      expect(byPath.get('renamed.txt')?.originalPath).toBe('rename-me.txt');
      expect(byPath.get('untracked.txt')?.kind).toBe('untracked');
      expect(await manager.isClean()).toBe(false);

      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]?.worktreePath).toBe(repo.repoPath);
      expect(worktrees[0]?.branchName).toBe('main');
    } finally {
      await repo.cleanup();
    }
  });

  it('reports a detached HEAD as a null branch and rejects unknown refs', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await repo.runGit(['checkout', '-q', '--detach']);

      expect(await manager.ensureRepository()).toMatchObject({ repoRoot: repo.repoPath, currentBranch: null });
      await expect(manager.resolveRef('no-such-ref')).rejects.toBeInstanceOf(CommandFailedError);

      // The ceiling keeps git from discovering an enclosing repository above the temp directory.
      const outside = new GitWorktreeManager({
        repoPath: repo.rootDir,
        env: { GIT_CEILING_DIRECTORIES: dirname(repo.rootDir) },
      });
      await expect(outside.ensureRepository()).rejects.toBeInstanceOf(CommandFailedError);
    } finally {
      await repo.cleanup();
    }
  });

  it('raises CommandFailedError carrying the git result for a failing command', async () => {
    const repo = await createTestRepo();

    try {
      const error: unknown = await new GitWorktreeManager({ repoPath: repo.repoPath })
        .resolveRef('no-such-ref')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(CommandFailedError);
      expect((error as CommandFailedError).result).toMatchObject({
        command: ['git', 'rev-parse', '--verify', 'no-such-ref'],
        cwd: repo.repoPath,
        exitCode: 128,
      });
      expect((error as CommandFailedError).result.stderr).toMatch(/fatal/u);
    } finally {
      await repo.cleanup();
    }
  });

  it('propagates CommandExecutionError when the git binary cannot be started', async () => {
    const gitBinary = '/nonexistent/git-manager-test/git';
    const manager = new GitWorktreeManager({ repoPath: tmpdir(), gitBinary });

    const error: unknown = await manager.getHeadSha().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error).toMatchObject({ binary: gitBinary, args: ['rev-parse', 'HEAD'], cwd: tmpdir() });
    expect((error as Error).cause).toMatchObject({ code: 'ENOENT' });
  });

  it('unsets an inherited variable when env maps it to undefined', async () => {
    const repo = await createTestRepo();

    try {
      vi.stubEnv('GIT_DIR', join(repo.rootDir, 'not-a-git-dir'));

      await expect(new GitWorktreeManager({ repoPath: repo.repoPath }).getHeadSha()).rejects.toBeInstanceOf(
        CommandFailedError,
      );
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath, env: { GIT_DIR: undefined } });
      expect(await manager.getHeadSha()).toMatch(/^[0-9a-f]{40}$/u);
    } finally {
      vi.unstubAllEnvs();
      await repo.cleanup();
    }
  });
});
