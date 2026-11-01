import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runBasicWorkflow } from '../../examples/git-manager/basic-workflow.example.js';
import { runDetachedWorkflow } from '../../examples/git-manager/detached-workflow.example.js';
import { runOverlayWorkingCopy } from '../../examples/git-manager/overlay-working-copy.example.js';
import { runPatchRoundTrip } from '../../examples/git-manager/patch-round-trip.example.js';
import { GitWorktreeManager } from '../../src/git-manager/index.js';
import { createTestRepo, type TestRepo } from './fixtures/createTestRepo.js';

let repo: TestRepo;

beforeEach(async () => {
  repo = await createTestRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

async function expectOnlyMainWorktree(): Promise<void> {
  const worktrees = await new GitWorktreeManager({ repoPath: repo.repoPath }).listWorktrees();
  expect(worktrees.map((worktree) => worktree.worktreePath)).toEqual([repo.repoPath]);
}

describe('examples', () => {
  it('basic-workflow commits a change on a worktree branch', async () => {
    const result = await runBasicWorkflow(repo.repoPath, join(repo.rootDir, 'basic'));

    expect(result.statusBeforeCommit).toMatchObject([{ path: 'example-basic.txt', kind: 'untracked' }]);
    expect(result.commit).toMatchObject({
      branchName: 'agent/basic-demo',
      message: 'example: create basic worktree change',
    });
    expect(result.statusAfterCommit).toEqual([]);
    await expectOnlyMainWorktree();
  });

  it('detached-workflow branches from a detached worktree', async () => {
    const result = await runDetachedWorkflow(repo.repoPath, join(repo.rootDir, 'detached'));

    expect(result.worktree.branchName).toBeNull();
    expect(result.branchBefore).toBeNull();
    expect(result.branch.branchName).toBe('agent/from-detached');
    expect(result.branchAfter).toBe('agent/from-detached');
    await expectOnlyMainWorktree();
  });

  it('patch-round-trip applies a patch exported from one worktree to another', async () => {
    const result = await runPatchRoundTrip(repo.repoPath, join(repo.rootDir, 'source'), join(repo.rootDir, 'target'));

    expect(result.patch).toContain('+Patch created from the source worktree.');
    expect(result.preflight).toMatchObject({ checkOnly: true, appliedBytes: result.applied.appliedBytes });
    expect(result.applied.checkOnly).toBe(false);
    expect(result.targetStatus).toMatchObject([{ path: 'tracked.txt', kind: 'modified' }]);
    await expectOnlyMainWorktree();
  });

  it('overlay-working-copy replays tracked and untracked changes', async () => {
    const result = await runOverlayWorkingCopy(repo.repoPath, join(repo.rootDir, 'overlay'));

    expect(result.overlay.trackedPatchBytes).toBeGreaterThan(0);
    expect(result.overlay.untrackedFilesCopied).toEqual(['example-untracked/note.txt']);
    expect(result.worktreeStatus).toMatchObject([
      { path: 'tracked.txt', kind: 'modified' },
      { path: 'example-untracked/', kind: 'untracked' },
    ]);
    await expectOnlyMainWorktree();
  });
});
