import { join } from 'node:path';

import type { OverlayWorkingChangesOptions, OverlayWorkingChangesResult } from '../contracts/index.js';
import { assertUsage } from '../errors.js';
import { GIT_ARGS } from '../internal/gitArgs.js';
import { splitNulFields } from '../parsers/nulFields.js';
import { runGit, type GitContext } from './gitContext.js';
import { applyPatch, exportTrackedDiff } from './patch.workflow.js';
import { getGitCommonDir, getRepoRoot } from './repository.workflow.js';

async function listUntrackedFiles(context: GitContext, path: string): Promise<string[]> {
  return splitNulFields(await runGit(context, path, GIT_ARGS.listUntracked));
}

/**
 * Replays the source worktree's tracked diff (check, then apply) into the target worktree and optionally copies
 * untracked files. Both worktrees must belong to the same repository.
 */
export async function overlayWorkingChanges(
  context: GitContext,
  options: OverlayWorkingChangesOptions,
): Promise<OverlayWorkingChangesResult> {
  const [sourceRoot, targetRoot] = await Promise.all([
    getRepoRoot(context, options.sourcePath ?? context.repoPath),
    getRepoRoot(context, options.worktreePath),
  ]);
  const [sourceCommonDir, targetCommonDir] = await Promise.all([
    getGitCommonDir(context, sourceRoot),
    getGitCommonDir(context, targetRoot),
  ]);

  assertUsage(
    sourceCommonDir === targetCommonDir,
    'overlayWorkingChanges() requires sourcePath and worktreePath to belong to the same repository.',
  );

  const trackedPatch = await exportTrackedDiff(context, {
    worktreePath: sourceRoot,
    ...(options.baseRef === undefined ? {} : { baseRef: options.baseRef }),
  });
  const { appliedBytes } = await applyPatch(context, { worktreePath: targetRoot, patch: trackedPatch });

  const untrackedFiles = options.includeUntracked === true ? await listUntrackedFiles(context, sourceRoot) : [];

  for (const relativePath of untrackedFiles) {
    await context.filesystem.copyFileOrSymlink(join(sourceRoot, relativePath), join(targetRoot, relativePath));
  }

  return {
    worktreePath: targetRoot,
    sourcePath: sourceRoot,
    trackedPatchBytes: appliedBytes,
    untrackedFilesCopied: untrackedFiles,
  };
}
