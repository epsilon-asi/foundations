import type { AbstractContainerRuntime, NodeTypescriptContainerOptions } from '../container-runtime/index.js';
import type { RepositorySearchOptions } from '../repo-search/index.js';
import type { CommandExecutor } from '../shared/index.js';

/** Container settings for a sandbox. The worktree is always mounted as the container workspace. */
export interface SandboxContainerOptions extends Omit<NodeTypescriptContainerOptions, 'workspacePath'> {
  /**
   * `general` (default) applies the coding-agent defaults; `node-typescript` adds Node/npm environment and the
   * optional package-manager cache mount (`packageManager`, `installCachePath`).
   */
  readonly preset?: 'general' | 'node-typescript';
  /** Container backend. Default: `DockerContainerRuntime` using the sandbox's host executor. */
  readonly runtime?: AbstractContainerRuntime;
  /** User that commands run as inside the container (`docker exec --user`). */
  readonly user?: string;
}

/** Options for {@link Sandbox.create}. */
export interface CreateSandboxOptions {
  /** Repository the sandbox is created from (any path inside it). */
  readonly repoPath: string;
  /** Where the sandbox's git worktree is created (must not exist yet). */
  readonly worktreePath: string;
  /** New branch checked out in the worktree. Omit for a detached HEAD at `startRef`. */
  readonly branchName?: string;
  /** Commit the worktree starts from. Default: `HEAD`. */
  readonly startRef?: string;
  /** Replay uncommitted tracked changes from `repoPath` into the worktree. */
  readonly overlayWorkingChanges?: boolean;
  /** With `overlayWorkingChanges`, also copy untracked (non-ignored) files. */
  readonly includeUntracked?: boolean;
  /** Run commands and repository tasks inside a container mounted on the worktree. Omit to run on the host. */
  readonly container?: SandboxContainerOptions;
  /** Executes host commands: git, code search, and the container CLI. Default: `ChildProcessCommandExecutor`. */
  readonly executor?: CommandExecutor;
  /** Default timeout for repository tasks (install, test, build, ...). */
  readonly taskTimeoutMs?: number;
  /** Code-search settings; the search root is always the worktree. */
  readonly search?: Omit<RepositorySearchOptions, 'root' | 'executor'>;
}

/** Options for {@link Sandbox.dispose}. */
export interface DisposeSandboxOptions {
  /** Leave the worktree (and its branch) on disk. Default: `false`. */
  readonly keepWorktree?: boolean;
  /** Leave the container running. Default: `false`. */
  readonly keepContainer?: boolean;
  /** Remove the worktree even when it has uncommitted changes. Default: `true`. */
  readonly force?: boolean;
}
