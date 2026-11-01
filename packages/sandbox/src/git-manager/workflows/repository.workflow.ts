import { canonicalPath } from '../../shared/fs.js';
import type { GitRepositoryInfo, WorktreeInfo } from '../contracts/index.js';
import { GIT_ARGS, buildResolveRefArgs } from '../internal/gitArgs.js';
import { parseWorktreeList } from '../parsers/worktreeList.parser.js';
import { readGitValue, runGit, type GitContext } from './gitContext.js';

/** HEAD commit and branch of a worktree; `branchName` is `null` when HEAD is detached. */
export interface HeadState {
  readonly headSha: string;
  readonly branchName: string | null;
}

export async function getRepoRoot(context: GitContext, path: string): Promise<string> {
  return await canonicalPath(await readGitValue(context, path, GIT_ARGS.showToplevel));
}

export async function getHeadSha(context: GitContext, path: string): Promise<string> {
  return await readGitValue(context, path, GIT_ARGS.headSha);
}

export async function getCurrentBranch(context: GitContext, path: string): Promise<string | null> {
  const branch = await readGitValue(context, path, GIT_ARGS.currentBranch);
  return branch === 'HEAD' ? null : branch;
}

export async function readHead(context: GitContext, path: string): Promise<HeadState> {
  const [headSha, branchName] = await Promise.all([getHeadSha(context, path), getCurrentBranch(context, path)]);
  return { headSha, branchName };
}

export async function resolveRef(context: GitContext, ref: string, path: string): Promise<string> {
  return await readGitValue(context, path, buildResolveRefArgs(ref));
}

/** Real path of the shared `.git` directory; identical for every worktree of one repository. */
export async function getGitCommonDir(context: GitContext, path: string): Promise<string> {
  return await canonicalPath(await readGitValue(context, path, GIT_ARGS.commonDir));
}

export async function ensureRepository(context: GitContext): Promise<GitRepositoryInfo> {
  const repoRoot = await getRepoRoot(context, context.repoPath);
  const { headSha, branchName } = await readHead(context, repoRoot);
  return { repoRoot, headSha, currentBranch: branchName };
}

export async function listWorktrees(context: GitContext): Promise<readonly WorktreeInfo[]> {
  const repoRoot = await getRepoRoot(context, context.repoPath);
  return parseWorktreeList(await runGit(context, repoRoot, GIT_ARGS.worktreeList));
}
