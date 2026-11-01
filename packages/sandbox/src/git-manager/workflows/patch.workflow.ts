import { Buffer } from 'node:buffer';

import type {
  ApplyGitPatchOptions,
  GitDiffNameStatusEntry,
  GitDiffOptions,
  GitPatchApplyResult,
} from '../contracts/index.js';
import { buildApplyArgs, buildDiffArgs } from '../internal/gitArgs.js';
import { parseDiffNameStatus } from '../parsers/diffNameStatus.parser.js';
import { runGit, type GitContext } from './gitContext.js';

export async function exportTrackedDiff(context: GitContext, options: GitDiffOptions): Promise<string> {
  return await runGit(context, options.worktreePath, buildDiffArgs('tracked', options.baseRef));
}

export async function exportStagedDiff(context: GitContext, options: GitDiffOptions): Promise<string> {
  return await runGit(context, options.worktreePath, buildDiffArgs('staged', options.baseRef));
}

export async function diffNameStatus(
  context: GitContext,
  options: GitDiffOptions,
): Promise<readonly GitDiffNameStatusEntry[]> {
  return parseDiffNameStatus(await runGit(context, options.worktreePath, buildDiffArgs('nameStatus', options.baseRef)));
}

/** Preflights the patch with `git apply --check`, then applies it unless `checkOnly`. An empty patch runs nothing. */
export async function applyPatch(context: GitContext, options: ApplyGitPatchOptions): Promise<GitPatchApplyResult> {
  const checkOnly = options.checkOnly === true;
  const index = options.index === true;
  const appliedBytes = Buffer.byteLength(options.patch, 'utf8');
  const gitApply = async (check: boolean): Promise<void> => {
    await runGit(context, options.worktreePath, buildApplyArgs({ index, check }), { stdin: options.patch });
  };

  if (appliedBytes > 0) {
    await gitApply(true);

    if (!checkOnly) {
      await gitApply(false);
    }
  }

  return { worktreePath: options.worktreePath, checkOnly, index, appliedBytes };
}
