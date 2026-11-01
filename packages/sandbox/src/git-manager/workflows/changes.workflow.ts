import type { EnvironmentOverrides } from '../../shared/index.js';
import type {
  GitCommitAuthor,
  GitCommitInfo,
  GitCommitOptions,
  GitDiscardChangesOptions,
  GitStagePathsOptions,
  GitStatusEntry,
} from '../contracts/index.js';
import { assertUsage } from '../errors.js';
import { GIT_ARGS, buildCommitArgs, buildStagePathsArgs } from '../internal/gitArgs.js';
import { parseStatusPorcelainV1Z } from '../parsers/statusPorcelain.parser.js';
import { runGit, type GitContext } from './gitContext.js';
import { readHead } from './repository.workflow.js';

function authorEnv(author: GitCommitAuthor | undefined): EnvironmentOverrides | undefined {
  return author === undefined
    ? undefined
    : {
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email,
      };
}

export async function getStatus(context: GitContext, path: string): Promise<readonly GitStatusEntry[]> {
  return parseStatusPorcelainV1Z(await runGit(context, path, GIT_ARGS.status));
}

export async function stageAll(context: GitContext, worktreePath: string): Promise<void> {
  await runGit(context, worktreePath, GIT_ARGS.stageAll);
}

export async function stagePaths(context: GitContext, options: GitStagePathsOptions): Promise<void> {
  assertUsage(options.paths.length > 0, 'stagePaths() requires at least one path.');
  await runGit(context, options.worktreePath, buildStagePathsArgs(options.paths));
}

export async function commit(context: GitContext, options: GitCommitOptions): Promise<GitCommitInfo> {
  assertUsage(options.message.trim().length > 0, 'commit() requires a non-empty message.');

  if (options.stageAll !== false) {
    await stageAll(context, options.worktreePath);
  }

  const env = authorEnv(options.author);
  await runGit(context, options.worktreePath, buildCommitArgs(options), env === undefined ? {} : { env });
  return {
    worktreePath: options.worktreePath,
    message: options.message,
    ...(await readHead(context, options.worktreePath)),
  };
}

export async function discardUncommittedChanges(context: GitContext, options: GitDiscardChangesOptions): Promise<void> {
  await runGit(context, options.worktreePath, GIT_ARGS.resetHard);

  if (options.removeUntracked === true) {
    await runGit(context, options.worktreePath, GIT_ARGS.cleanUntracked);
  }
}
