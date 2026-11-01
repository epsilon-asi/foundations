import type { CommandExecutionOptions, CommandExecutionResult, CommandExecutor } from '../../shared/index.js';

/** Options shared by every runner constructor and by `createDefaultRepoRunnerRegistry`. */
export interface RepoRunnerOptions {
  /** Runs every command. Default: a new `ChildProcessCommandExecutor`. */
  readonly executor?: CommandExecutor;
  /** Timeout applied to every command unless overridden per call. Default: `DEFAULT_TASK_TIMEOUT_MS` (120 000 ms). */
  readonly defaultTimeoutMs?: number;
}

/** Task name → human-readable description of what the task runs. */
export type RepoTaskDefinitions = Readonly<Record<string, string>>;

/**
 * Outcome of a task or install command. A task skipped because it does not exist (`missingTaskBehavior: 'skip'`)
 * has `skipped: true`, an empty `command`, `exitCode: 0`, and `cwd` set to the repository root.
 */
export interface RepoTaskResult extends CommandExecutionResult {
  readonly skipped: boolean;
  /** Why the task was skipped; present only when `skipped` is `true`. */
  readonly skipReason?: string;
}

/**
 * Executor options plus the runner's result policy, for one command run by a runner. Runner-only options never
 * reach the {@link CommandExecutor}.
 */
export interface RepoCommandOptions extends CommandExecutionOptions {
  /**
   * Return failed results (non-zero exit, killed by a signal, or timed out) instead of throwing `CommandFailedError`.
   * Default: `false`.
   */
  readonly allowNonZeroExit?: boolean;
  /** Trim leading/trailing whitespace from the captured stdout. */
  readonly trimStdout?: boolean;
}

/** Options for running a named task. */
export interface RunTaskOptions extends RepoCommandOptions {
  /** Extra arguments forwarded to the task (placement is ecosystem-specific, see {@link TaskCommand}). */
  readonly args?: readonly string[];
  /** What to do when the task does not exist: throw `MissingTaskError` (default) or return a skipped result. */
  readonly missingTaskBehavior?: 'error' | 'skip';
}

/** Options for installing dependencies. */
export interface InstallDependenciesOptions extends RepoCommandOptions {
  /** Extra arguments appended to the install command. */
  readonly additionalArgs?: readonly string[];
}

/** An executable plus its argument vector, as run by a repo runner. */
export interface RepoCommandLine {
  readonly binary: string;
  readonly args: readonly string[];
}

/** The command a runner uses to install dependencies; `mode` names the strategy (e.g. `ci`, `sync`). */
export interface InstallPlan extends RepoCommandLine {
  readonly mode: string;
}

/**
 * How a runner invokes one task. Forwarded `RunTaskOptions.args` are placed as
 * `binary ...args [argsSeparator] ...forwardedArgs ...trailingArgs`.
 */
export interface TaskCommand extends RepoCommandLine {
  /** Arguments placed after forwarded args (e.g. Go's `./...` package pattern, which must follow flags). */
  readonly trailingArgs?: readonly string[];
  /** Token inserted before forwarded args when there are any (npm uses `--`). */
  readonly argsSeparator?: string;
  /** Text reported by `getTaskDefinitions()`; defaults to the command line. */
  readonly description?: string;
}

/** Every task a runner can execute, keyed by task name. */
export type TaskTable = ReadonlyMap<string, TaskCommand>;

/** Common contract of every repository runner. */
export interface RepoRunner<TRepoConfig = unknown, TInstallPlan extends InstallPlan = InstallPlan> {
  /** Stable identifier of the runner kind, e.g. `node-typescript`. */
  readonly kind: string;
  /** Absolute repository root. */
  readonly repoPath: string;

  /** Whether the repository at `repoPath` belongs to this runner's ecosystem. */
  detect(): Promise<boolean>;
  /** Throws `UnsupportedRepositoryError` unless {@link detect} succeeds. */
  assertDetected(): Promise<void>;
  /** Parsed repository configuration (memoized). */
  getRepoConfig(): Promise<TRepoConfig>;
  /** Every task {@link runNamedTask} accepts, with a description of the command it runs. */
  getTaskDefinitions(): Promise<RepoTaskDefinitions>;
  /** The command {@link installDependencies} will run. */
  getPreferredInstallPlan(options?: InstallDependenciesOptions): Promise<TInstallPlan>;
  /** Runs the install plan; throws `CommandFailedError` on failure unless `allowNonZeroExit` is set. */
  installDependencies(options?: InstallDependenciesOptions): Promise<RepoTaskResult>;
  /** Shorthand for `runNamedTask('test', options)`. */
  runTest(options?: RunTaskOptions): Promise<RepoTaskResult>;
  /** Shorthand for `runNamedTask('build', options)`. */
  runBuild(options?: RunTaskOptions): Promise<RepoTaskResult>;
  /** Runs a task; throws `CommandFailedError` on failure unless `allowNonZeroExit` is set. */
  runNamedTask(name: string, options?: RunTaskOptions): Promise<RepoTaskResult>;
}
