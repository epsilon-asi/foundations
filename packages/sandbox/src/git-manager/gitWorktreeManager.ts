import { ChildProcessCommandExecutor, type CommandExecutor, type EnvironmentOverrides } from '../shared/index.js';
import type {
  ApplyGitPatchOptions,
  CreateGitBranchOptions,
  CreateWorktreeOptions,
  CreateWorktreeResult,
  GitBranchInfo,
  GitCommitInfo,
  GitCommitOptions,
  GitDiffNameStatusEntry,
  GitDiffOptions,
  GitDiscardChangesOptions,
  GitPatchApplyResult,
  GitRepositoryInfo,
  GitStagePathsOptions,
  GitStatusEntry,
  OverlayWorkingChangesOptions,
  OverlayWorkingChangesResult,
  RemoveWorktreeOptions,
  WorktreeInfo,
} from './contracts/index.js';
import { nodeFilesystem } from './internal/filesystem.js';
import type { FilesystemPort } from './ports.js';
import * as changes from './workflows/changes.workflow.js';
import type { GitContext } from './workflows/gitContext.js';
import { overlayWorkingChanges } from './workflows/overlay.workflow.js';
import * as patches from './workflows/patch.workflow.js';
import * as repository from './workflows/repository.workflow.js';
import * as worktrees from './workflows/worktree.workflow.js';

const DEFAULT_GIT_BINARY = 'git';

export interface GitWorktreeManagerOptions {
  /** Repository (or any path inside it) the manager operates on; the default for every optional `path`. */
  readonly repoPath: string;
  /** Runs every git command (default: a new `ChildProcessCommandExecutor`). */
  readonly executor?: CommandExecutor;
  /** Git executable passed to the executor (default `git`). */
  readonly gitBinary?: string;
  /** Environment overrides for every git command; a key set to `undefined` unsets that variable. */
  readonly env?: EnvironmentOverrides;
  /** Replaces the default `node:fs` implementation used for worktree directories and untracked-file copies. */
  readonly filesystem?: FilesystemPort;
}

/** The public surface of {@link GitWorktreeManager}; useful for substituting the manager in consumer tests. */
export interface GitWorktreeManagerApi {
  /** Verifies `repoPath` is inside a git worktree and reports its root, HEAD and branch. */
  ensureRepository(): Promise<GitRepositoryInfo>;
  /** Real path of the worktree root containing `path`. */
  getRepoRoot(path?: string): Promise<string>;
  getHeadSha(path?: string): Promise<string>;
  /** Checked-out branch, or `null` when HEAD is detached. */
  getCurrentBranch(path?: string): Promise<string | null>;
  /** Full SHA of `ref` (`git rev-parse --verify`). */
  resolveRef(ref: string, path?: string): Promise<string>;
  listWorktrees(): Promise<readonly WorktreeInfo[]>;
  /** Adds a linked worktree on a new branch or a detached HEAD, optionally replaying working changes into it. */
  createWorktree(options: CreateWorktreeOptions): Promise<CreateWorktreeResult>;
  /** Creates (or with `force`, resets) a branch inside an existing worktree and switches to it. */
  createBranch(options: CreateGitBranchOptions): Promise<GitBranchInfo>;
  getStatus(path?: string): Promise<readonly GitStatusEntry[]>;
  /** `true` when `getStatus()` reports no entries (untracked files count as changes). */
  isClean(path?: string): Promise<boolean>;
  stageAll(worktreePath: string): Promise<void>;
  stagePaths(options: GitStagePathsOptions): Promise<void>;
  /** Commits in the worktree (staging everything first unless `stageAll: false`). */
  commit(options: GitCommitOptions): Promise<GitCommitInfo>;
  exportTrackedDiff(options: GitDiffOptions): Promise<string>;
  exportStagedDiff(options: GitDiffOptions): Promise<string>;
  diffNameStatus(options: GitDiffOptions): Promise<readonly GitDiffNameStatusEntry[]>;
  /** Preflights with `git apply --check`, then applies unless `checkOnly`. An empty patch is a no-op. */
  applyPatch(options: ApplyGitPatchOptions): Promise<GitPatchApplyResult>;
  /** Replays tracked (and optionally untracked) changes from a worktree of the same repository into another. */
  overlayWorkingChanges(options: OverlayWorkingChangesOptions): Promise<OverlayWorkingChangesResult>;
  /** Destructive: `git reset --hard HEAD`, plus `git clean -fd` when `removeUntracked` is set. */
  discardUncommittedChanges(options: GitDiscardChangesOptions): Promise<void>;
  /** Removes a linked worktree; dirty worktrees are refused unless `force` is set. */
  removeWorktree(options: RemoveWorktreeOptions): Promise<void>;
  /** Drops metadata of worktrees whose directories no longer exist. */
  pruneWorktrees(): Promise<void>;
}

/** Creates and manages isolated linked worktrees of one repository. */
export class GitWorktreeManager implements GitWorktreeManagerApi {
  readonly #context: GitContext;

  constructor(options: GitWorktreeManagerOptions) {
    this.#context = {
      repoPath: options.repoPath,
      executor: options.executor ?? new ChildProcessCommandExecutor(),
      gitBinary: options.gitBinary ?? DEFAULT_GIT_BINARY,
      env: options.env,
      filesystem: options.filesystem ?? nodeFilesystem,
    };
  }

  #pathOrRepo(path: string | undefined): string {
    return path ?? this.#context.repoPath;
  }

  async ensureRepository(): Promise<GitRepositoryInfo> {
    return await repository.ensureRepository(this.#context);
  }

  async getRepoRoot(path?: string): Promise<string> {
    return await repository.getRepoRoot(this.#context, this.#pathOrRepo(path));
  }

  async getHeadSha(path?: string): Promise<string> {
    return await repository.getHeadSha(this.#context, this.#pathOrRepo(path));
  }

  async getCurrentBranch(path?: string): Promise<string | null> {
    return await repository.getCurrentBranch(this.#context, this.#pathOrRepo(path));
  }

  async resolveRef(ref: string, path?: string): Promise<string> {
    return await repository.resolveRef(this.#context, ref, this.#pathOrRepo(path));
  }

  async listWorktrees(): Promise<readonly WorktreeInfo[]> {
    return await repository.listWorktrees(this.#context);
  }

  async createWorktree(options: CreateWorktreeOptions): Promise<CreateWorktreeResult> {
    return await worktrees.createWorktree(this.#context, options);
  }

  async createBranch(options: CreateGitBranchOptions): Promise<GitBranchInfo> {
    return await worktrees.createBranch(this.#context, options);
  }

  async getStatus(path?: string): Promise<readonly GitStatusEntry[]> {
    return await changes.getStatus(this.#context, this.#pathOrRepo(path));
  }

  async isClean(path?: string): Promise<boolean> {
    return (await this.getStatus(path)).length === 0;
  }

  async stageAll(worktreePath: string): Promise<void> {
    await changes.stageAll(this.#context, worktreePath);
  }

  async stagePaths(options: GitStagePathsOptions): Promise<void> {
    await changes.stagePaths(this.#context, options);
  }

  async commit(options: GitCommitOptions): Promise<GitCommitInfo> {
    return await changes.commit(this.#context, options);
  }

  async exportTrackedDiff(options: GitDiffOptions): Promise<string> {
    return await patches.exportTrackedDiff(this.#context, options);
  }

  async exportStagedDiff(options: GitDiffOptions): Promise<string> {
    return await patches.exportStagedDiff(this.#context, options);
  }

  async diffNameStatus(options: GitDiffOptions): Promise<readonly GitDiffNameStatusEntry[]> {
    return await patches.diffNameStatus(this.#context, options);
  }

  async applyPatch(options: ApplyGitPatchOptions): Promise<GitPatchApplyResult> {
    return await patches.applyPatch(this.#context, options);
  }

  async overlayWorkingChanges(options: OverlayWorkingChangesOptions): Promise<OverlayWorkingChangesResult> {
    return await overlayWorkingChanges(this.#context, options);
  }

  async discardUncommittedChanges(options: GitDiscardChangesOptions): Promise<void> {
    await changes.discardUncommittedChanges(this.#context, options);
  }

  async removeWorktree(options: RemoveWorktreeOptions): Promise<void> {
    await worktrees.removeWorktree(this.#context, options);
  }

  async pruneWorktrees(): Promise<void> {
    await worktrees.pruneWorktrees(this.#context);
  }
}
