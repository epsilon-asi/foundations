import path from 'node:path';

import { fileExists } from '../../shared/fs.js';
import {
  ChildProcessCommandExecutor,
  ensureSuccess,
  type CommandExecutionOptions,
  type CommandExecutor,
} from '../../shared/index.js';
import type {
  InstallDependenciesOptions,
  InstallPlan,
  RepoCommandOptions,
  RepoRunner,
  RepoRunnerOptions,
  RepoTaskDefinitions,
  RepoTaskResult,
  RunTaskOptions,
  TaskTable,
} from '../contracts/runner.js';
import { MissingTaskError, UnsupportedRepositoryError } from '../errors/repoRunnerErrors.js';
import { buildTaskArgs, formatTaskCommand } from './taskCommand.js';

/** Timeout applied to runner commands when neither the runner nor the call sets one. */
export const DEFAULT_TASK_TIMEOUT_MS = 120_000;

/** The single place that strips runner-only options so only executor options reach the {@link CommandExecutor}. */
function toExecutionOptions(options: RunTaskOptions & InstallDependenciesOptions): CommandExecutionOptions {
  const {
    args: _args,
    missingTaskBehavior: _missingTaskBehavior,
    additionalArgs: _additionalArgs,
    allowNonZeroExit: _allowNonZeroExit,
    trimStdout: _trimStdout,
    ...executionOptions
  } = options;
  return executionOptions;
}

/** The result reported for a task that was not run: an empty command that "succeeded" in `cwd`. */
function skippedResult(cwd: string, skipReason: string): RepoTaskResult {
  return {
    binary: '',
    args: [],
    command: [],
    cwd,
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    durationMs: 0,
    timedOut: false,
    skipped: true,
    skipReason,
  };
}

/**
 * Template-method base class for repository runners.
 *
 * Subclasses describe an ecosystem through four hooks — {@link detect}, {@link loadRepoConfig},
 * {@link resolveTasks} and {@link resolveInstallPlan} — and inherit config memoization, task listing,
 * missing-task handling (`MissingTaskError` or a skipped result), argument forwarding, install, command execution
 * through the injected {@link CommandExecutor}, and the result policy (`CommandFailedError` unless
 * `allowNonZeroExit`).
 */
export abstract class AbstractRepoRunner<
  TRepoConfig,
  TInstallPlan extends InstallPlan = InstallPlan,
> implements RepoRunner<TRepoConfig, TInstallPlan> {
  public abstract readonly kind: string;
  public readonly repoPath: string;
  protected readonly executor: CommandExecutor;
  protected readonly defaultTimeoutMs: number;
  #repoConfig: Promise<TRepoConfig> | undefined;

  /** @param repoPath Repository root (resolved to an absolute path). */
  public constructor(repoPath: string, options: RepoRunnerOptions = {}) {
    this.repoPath = path.resolve(repoPath);
    this.executor = options.executor ?? new ChildProcessCommandExecutor();
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
  }

  public abstract detect(): Promise<boolean>;

  /** Reads and parses the repository's configuration. Only called after {@link detect} succeeded. */
  protected abstract loadRepoConfig(): Promise<TRepoConfig>;

  /** Every runnable task for `config`. The single source for both listing and running tasks. */
  protected abstract resolveTasks(config: TRepoConfig): TaskTable;

  /** The install command for `config`, without caller-supplied `additionalArgs`. */
  protected abstract resolveInstallPlan(config: TRepoConfig): TInstallPlan;

  public async assertDetected(): Promise<void> {
    if (!(await this.detect())) {
      throw new UnsupportedRepositoryError(this.kind, this.repoPath);
    }
  }

  /** Detects the repository and loads its config once; a failed attempt is retried on the next call. */
  public getRepoConfig(): Promise<TRepoConfig> {
    this.#repoConfig ??= this.assertDetected()
      .then(() => this.loadRepoConfig())
      .catch((error: unknown) => {
        this.#repoConfig = undefined;
        throw error;
      });
    return this.#repoConfig;
  }

  public async getTaskDefinitions(): Promise<RepoTaskDefinitions> {
    const tasks = this.resolveTasks(await this.getRepoConfig());
    return Object.fromEntries([...tasks].map(([name, task]) => [name, task.description ?? formatTaskCommand(task)]));
  }

  public async getPreferredInstallPlan(options: InstallDependenciesOptions = {}): Promise<TInstallPlan> {
    const plan = this.resolveInstallPlan(await this.getRepoConfig());
    return { ...plan, args: [...plan.args, ...(options.additionalArgs ?? [])] };
  }

  public async installDependencies(options: InstallDependenciesOptions = {}): Promise<RepoTaskResult> {
    const plan = await this.getPreferredInstallPlan(options);
    return this.runCommand(plan.binary, plan.args, options, 'Installing dependencies');
  }

  public runTest(options?: RunTaskOptions): Promise<RepoTaskResult> {
    return this.runNamedTask('test', options);
  }

  public runBuild(options?: RunTaskOptions): Promise<RepoTaskResult> {
    return this.runNamedTask('build', options);
  }

  public async runNamedTask(name: string, options: RunTaskOptions = {}): Promise<RepoTaskResult> {
    const tasks = this.resolveTasks(await this.getRepoConfig());
    const task = tasks.get(name);

    if (task === undefined) {
      if (options.missingTaskBehavior === 'skip') {
        return skippedResult(this.repoPath, `Task "${name}" is not defined for this ${this.kind} repository.`);
      }
      throw new MissingTaskError(name, this.repoPath, [...tasks.keys()]);
    }

    return this.runCommand(task.binary, buildTaskArgs(task, options.args), options, `Running task "${name}"`);
  }

  /**
   * Runs a command in the repository root with the runner's default timeout unless `options` override them, then
   * applies the result policy: `trimStdout`, and `CommandFailedError` (message prefixed by `failureMessage`) for a
   * failed command unless `allowNonZeroExit` is set. Spawn failures reject with the executor's
   * `CommandExecutionError` unchanged.
   */
  protected async runCommand(
    binary: string,
    args: readonly string[],
    options: RepoCommandOptions = {},
    failureMessage?: string,
  ): Promise<RepoTaskResult> {
    const executed = await this.executor.run(binary, args, {
      cwd: this.repoPath,
      timeoutMs: this.defaultTimeoutMs,
      ...toExecutionOptions(options),
    });
    const result: RepoTaskResult = {
      ...executed,
      stdout: options.trimStdout === true ? executed.stdout.trim() : executed.stdout,
      skipped: false,
    };
    if (options.allowNonZeroExit !== true) {
      ensureSuccess(result, failureMessage);
    }
    return result;
  }

  /** Absolute path of `relativePath` inside the repository. */
  protected resolvePath(relativePath: string): string {
    return path.resolve(this.repoPath, relativePath);
  }

  /** Whether `relativePath` exists inside the repository. */
  protected hasFile(relativePath: string): Promise<boolean> {
    return fileExists(this.resolvePath(relativePath));
  }
}
