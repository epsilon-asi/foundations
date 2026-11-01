import {
  ContainerCommandExecutor,
  DockerContainerRuntime,
  buildCodingAgentContainerOptions,
  buildNodeTypescriptContainerOptions,
  type AbstractContainerRuntime,
  type ContainerHandle,
} from '../container-runtime/index.js';
import {
  GitWorktreeManager,
  type ApplyGitPatchOptions,
  type CreateWorktreeResult,
  type GitCommitInfo,
  type GitCommitOptions,
  type GitDiffNameStatusEntry,
  type GitPatchApplyResult,
  type GitStatusEntry,
} from '../git-manager/index.js';
import {
  createDefaultRepoRunnerRegistry,
  type InstallDependenciesOptions,
  type RepoRunner,
  type RepoTaskResult,
  type RunTaskOptions,
} from '../repo-runner/index.js';
import { LocalRepoSearch, type RepositorySearchOptions } from '../repo-search/index.js';
import {
  ChildProcessCommandExecutor,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type CommandExecutor,
  SandboxError,
} from '../shared/index.js';
import { omitUndefined } from '../shared/objects.js';
import { SandboxDisposeError } from './errors.js';
import type { CreateSandboxOptions, DisposeSandboxOptions, SandboxContainerOptions } from './types.js';

interface SandboxParts {
  readonly git: GitWorktreeManager;
  readonly worktree: CreateWorktreeResult;
  readonly hostExecutor: CommandExecutor;
  readonly taskExecutor: CommandExecutor;
  readonly runtime: AbstractContainerRuntime | undefined;
  readonly container: ContainerHandle | undefined;
  readonly taskTimeoutMs: number | undefined;
  readonly searchOptions: Omit<RepositorySearchOptions, 'root' | 'executor'>;
}

/**
 * One isolated workspace for a coding agent: a git worktree of a repository, optionally mounted into a
 * container, with repository tasks, code search, and git operations scoped to it.
 *
 * Git and code search run on the host against the worktree; `exec`, `installDependencies` and `runTask` run
 * inside the container when one was requested (otherwise on the host). Dispose the sandbox to remove the
 * container and the worktree — `await using sandbox = await Sandbox.create(...)` does it automatically.
 */
export class Sandbox implements AsyncDisposable {
  /** Git operations for the whole repository; sandbox-scoped shortcuts are provided below. */
  readonly git: GitWorktreeManager;
  /** The worktree created for this sandbox. */
  readonly worktree: CreateWorktreeResult;
  /** The container mounted on the worktree, when the sandbox has one. */
  readonly container: ContainerHandle | undefined;
  /** Runs commands where the sandbox's tasks run: inside the container, or on the host in the worktree. */
  readonly executor: CommandExecutor;

  readonly #parts: SandboxParts;
  #runner: Promise<RepoRunner> | undefined;
  #search: Promise<LocalRepoSearch> | undefined;
  #disposed = false;

  private constructor(parts: SandboxParts) {
    this.#parts = parts;
    this.git = parts.git;
    this.worktree = parts.worktree;
    this.container = parts.container;
    this.executor = parts.taskExecutor;
  }

  /**
   * Creates the worktree and, when `options.container` is set, starts a container mounted on it. If the container
   * cannot be started, the worktree is removed again before the error is rethrown.
   */
  static async create(options: CreateSandboxOptions): Promise<Sandbox> {
    const hostExecutor = options.executor ?? new ChildProcessCommandExecutor();
    const git = new GitWorktreeManager({ repoPath: options.repoPath, executor: hostExecutor });
    const worktree = await git.createWorktree({
      worktreePath: options.worktreePath,
      ...(options.branchName === undefined ? { detached: true } : { branchName: options.branchName }),
      ...omitUndefined({
        startRef: options.startRef,
        overlayWorkingChanges: options.overlayWorkingChanges,
        includeUntracked: options.includeUntracked,
      }),
    });

    let runtime: AbstractContainerRuntime | undefined;
    let container: ContainerHandle | undefined;
    if (options.container !== undefined) {
      runtime = options.container.runtime ?? new DockerContainerRuntime({ executor: hostExecutor });
      try {
        container = await startContainer(runtime, options.container, worktree.worktreePath);
      } catch (error: unknown) {
        await git.removeWorktree({ worktreePath: worktree.worktreePath, force: true }).catch(() => undefined);
        throw error;
      }
    }

    const taskExecutor =
      runtime === undefined || container === undefined
        ? hostExecutor
        : new ContainerCommandExecutor({
            runtime,
            container,
            ...omitUndefined({ user: options.container?.user }),
          });

    return new Sandbox({
      git,
      worktree,
      hostExecutor,
      taskExecutor,
      runtime,
      container,
      taskTimeoutMs: options.taskTimeoutMs,
      searchOptions: options.search ?? {},
    });
  }

  /** Absolute path of the worktree on the host. */
  get worktreePath(): string {
    return this.worktree.worktreePath;
  }

  /** Runs a command in the sandbox (container workspace or host worktree). Non-zero exits are returned. */
  async exec(
    command: readonly [string, ...string[]],
    options: CommandExecutionOptions = {},
  ): Promise<CommandExecutionResult> {
    this.#assertOpen();
    const [binary, ...args] = command;
    return await this.executor.run(binary, args, { cwd: this.worktreePath, ...options });
  }

  /** The repository runner for the worktree's toolchain (detected once); its commands run where `exec` runs. */
  async runner(): Promise<RepoRunner> {
    this.#assertOpen();
    this.#runner ??= createDefaultRepoRunnerRegistry({
      executor: this.#parts.taskExecutor,
      ...omitUndefined({ defaultTimeoutMs: this.#parts.taskTimeoutMs }),
    }).detect(this.worktreePath);
    return await this.#runner;
  }

  /** Installs the repository's dependencies with its detected toolchain. */
  async installDependencies(options?: InstallDependenciesOptions): Promise<RepoTaskResult> {
    return await (await this.runner()).installDependencies(options);
  }

  /** Runs a repository task (`test`, `build`, `lint`, a package script, ...) with its detected toolchain. */
  async runTask(name: string, options?: RunTaskOptions): Promise<RepoTaskResult> {
    return await (await this.runner()).runNamedTask(name, options);
  }

  /** Code search over the worktree, indexed on first use; `refresh: true` re-indexes (e.g. after edits). */
  async search(options: { readonly refresh?: boolean } = {}): Promise<LocalRepoSearch> {
    this.#assertOpen();
    if (this.#search === undefined || options.refresh === true) {
      this.#search = LocalRepoSearch.create({
        ...this.#parts.searchOptions,
        root: this.worktreePath,
        executor: this.#parts.hostExecutor,
      });
    }
    return await this.#search;
  }

  /** Uncommitted changes in the worktree (untracked files included). */
  async status(): Promise<readonly GitStatusEntry[]> {
    return await this.git.getStatus(this.worktreePath);
  }

  /** Unified diff of uncommitted tracked changes (`staged: true` for the index only), suitable for `applyPatch`. */
  async diff(options: { readonly staged?: boolean; readonly baseRef?: string } = {}): Promise<string> {
    const diffOptions = { worktreePath: this.worktreePath, ...omitUndefined({ baseRef: options.baseRef }) };
    return options.staged === true
      ? await this.git.exportStagedDiff(diffOptions)
      : await this.git.exportTrackedDiff(diffOptions);
  }

  /** Changed paths with their git status letters (`M`, `A`, `D`, `R100`, ...). */
  async changedFiles(options: { readonly baseRef?: string } = {}): Promise<readonly GitDiffNameStatusEntry[]> {
    return await this.git.diffNameStatus({ worktreePath: this.worktreePath, ...omitUndefined(options) });
  }

  /** Commits the worktree's changes (staging everything first unless `stageAll: false`). */
  async commit(options: Omit<GitCommitOptions, 'worktreePath'>): Promise<GitCommitInfo> {
    return await this.git.commit({ ...options, worktreePath: this.worktreePath });
  }

  /** Applies a unified diff to the worktree after a `git apply --check` preflight. */
  async applyPatch(
    patch: string,
    options: Omit<ApplyGitPatchOptions, 'worktreePath' | 'patch'> = {},
  ): Promise<GitPatchApplyResult> {
    return await this.git.applyPatch({ ...options, worktreePath: this.worktreePath, patch });
  }

  /** Destructive: resets tracked files to `HEAD` and, with `removeUntracked`, deletes untracked files. */
  async discardChanges(options: { readonly removeUntracked?: boolean } = {}): Promise<void> {
    await this.git.discardUncommittedChanges({ worktreePath: this.worktreePath, ...omitUndefined(options) });
  }

  /**
   * Removes the container and the worktree (the branch and its commits are kept). Safe to call more than once.
   * Both steps are attempted; failures are reported together as `SandboxDisposeError`.
   */
  async dispose(options: DisposeSandboxOptions = {}): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    const errors: unknown[] = [];
    const { runtime, container } = this.#parts;
    if (runtime !== undefined && container !== undefined && options.keepContainer !== true) {
      await runtime.removeContainer(container.id, { force: true }).catch((error: unknown) => errors.push(error));
    }
    if (options.keepWorktree !== true) {
      await this.git
        .removeWorktree({ worktreePath: this.worktreePath, force: options.force ?? true })
        .catch((error: unknown) => errors.push(error));
    }
    if (errors.length > 0) {
      throw new SandboxDisposeError(this.worktreePath, errors);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  #assertOpen(): void {
    if (this.#disposed) {
      throw new SandboxError(`Sandbox at ${this.worktreePath} has been disposed`);
    }
  }
}

async function startContainer(
  runtime: AbstractContainerRuntime,
  options: SandboxContainerOptions,
  workspacePath: string,
): Promise<ContainerHandle> {
  const { preset = 'general', runtime: _runtime, user: _user, ...containerOptions } = options;
  const presetOptions = { ...containerOptions, workspacePath };
  const createOptions =
    preset === 'node-typescript'
      ? buildNodeTypescriptContainerOptions(presetOptions)
      : buildCodingAgentContainerOptions(presetOptions);
  return await runtime.createStartedContainer(createOptions);
}
