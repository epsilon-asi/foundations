import { ensureSuccess, type CommandExecutor, type EnvironmentOverrides } from '../../shared/index.js';
import { omitUndefined } from '../../shared/objects.js';
import type { FilesystemPort } from '../ports.js';

/**
 * Everything a workflow needs. Every workflow function takes the context first, followed by the same arguments as
 * the matching `GitWorktreeManager` method (with path defaults already resolved).
 */
export interface GitContext {
  /** Default repository path (the manager's `repoPath`). */
  readonly repoPath: string;
  readonly executor: CommandExecutor;
  readonly gitBinary: string;
  /** Manager-wide environment overrides applied to every git command. */
  readonly env: EnvironmentOverrides | undefined;
  readonly filesystem: FilesystemPort;
}

/** Per-command extras for {@link runGit}. */
export interface RunGitExtras {
  /** Text written to git's stdin (used for `git apply -`). */
  readonly stdin?: string;
  /** Overrides layered over the manager's `env`; `undefined` values unset the variable. */
  readonly env?: EnvironmentOverrides;
}

/**
 * Runs git in `cwd` through the context's executor and returns its stdout. A non-zero exit throws the shared
 * `CommandFailedError`; an executor rejection (e.g. `CommandExecutionError` for a missing binary) propagates as is.
 */
export async function runGit(
  context: GitContext,
  cwd: string,
  args: readonly string[],
  extras: RunGitExtras = {},
): Promise<string> {
  // A spread (not `mergeEnvironment`) keeps `undefined` values so the executor still unsets those variables.
  const env = context.env === undefined && extras.env === undefined ? undefined : { ...context.env, ...extras.env };
  const result = await context.executor.run(context.gitBinary, args, omitUndefined({ cwd, env, stdin: extras.stdin }));
  return ensureSuccess(result).stdout;
}

/** Runs a single-value git query in `cwd` and returns stdout without its trailing line break. */
export async function readGitValue(context: GitContext, cwd: string, args: readonly string[]): Promise<string> {
  return (await runGit(context, cwd, args)).replace(/[\r\n]+$/u, '');
}
