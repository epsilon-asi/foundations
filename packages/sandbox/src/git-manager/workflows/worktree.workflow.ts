import { dirname, resolve } from 'node:path';

import { canonicalPath } from '../../shared/fs.js';
import type {
  CreateGitBranchOptions,
  CreateWorktreeOptions,
  CreateWorktreeResult,
  GitBranchInfo,
  RemoveWorktreeOptions,
} from '../contracts/index.js';
import { assertUsage } from '../errors.js';
import { GIT_ARGS, buildSwitchArgs, buildWorktreeAddArgs, buildWorktreeRemoveArgs } from '../internal/gitArgs.js';
import { runGit, type GitContext } from './gitContext.js';
import { overlayWorkingChanges } from './overlay.workflow.js';
import { getRepoRoot, readHead } from './repository.workflow.js';

const DEFAULT_START_REF = 'HEAD';

export async function createWorktree(
  context: GitContext,
  options: CreateWorktreeOptions,
): Promise<CreateWorktreeResult> {
  assertUsage(
    (options.branchName !== undefined) !== (options.detached === true),
    'createWorktree() requires exactly one of branchName or detached=true.',
  );
  assertUsage(
    options.branchName === undefined || options.branchName.trim().length > 0,
    'createWorktree() requires a non-empty branchName when branch mode is selected.',
  );

  const repoRoot = await getRepoRoot(context, context.repoPath);
  const startRef = options.startRef ?? DEFAULT_START_REF;
  const requestedPath = resolve(options.worktreePath);

  await context.filesystem.mkdir(dirname(requestedPath));
  await runGit(context, repoRoot, buildWorktreeAddArgs({ ...options, worktreePath: requestedPath, startRef }));

  const worktreePath = await canonicalPath(requestedPath);
  const overlay =
    options.overlayWorkingChanges === true
      ? await overlayWorkingChanges(context, {
          worktreePath,
          baseRef: startRef,
          sourcePath: options.sourcePath ?? repoRoot,
          includeUntracked: options.includeUntracked === true,
        })
      : null;

  return {
    worktreePath,
    repoRoot,
    startRef,
    ...(await readHead(context, worktreePath)),
    overlayApplied: overlay !== null && (overlay.trackedPatchBytes > 0 || overlay.untrackedFilesCopied.length > 0),
    untrackedFilesCopied: overlay?.untrackedFilesCopied ?? [],
  };
}

export async function createBranch(context: GitContext, options: CreateGitBranchOptions): Promise<GitBranchInfo> {
  assertUsage(options.branchName.trim().length > 0, 'createBranch() requires a non-empty branchName.');

  await runGit(context, options.worktreePath, buildSwitchArgs(options));
  return { worktreePath: options.worktreePath, ...(await readHead(context, options.worktreePath)) };
}

export async function removeWorktree(context: GitContext, options: RemoveWorktreeOptions): Promise<void> {
  const repoRoot = await getRepoRoot(context, context.repoPath);
  await runGit(context, repoRoot, buildWorktreeRemoveArgs(options));

  if (options.prune === true) {
    await runGit(context, repoRoot, GIT_ARGS.worktreePrune);
  }
}

export async function pruneWorktrees(context: GitContext): Promise<void> {
  await runGit(context, await getRepoRoot(context, context.repoPath), GIT_ARGS.worktreePrune);
}
