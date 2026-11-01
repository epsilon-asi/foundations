export { GitWorktreeManager } from './gitWorktreeManager.js';
export type { GitWorktreeManagerApi, GitWorktreeManagerOptions } from './gitWorktreeManager.js';
export { GitError, GitOutputParseError, GitUsageError } from './errors.js';
export type { FilesystemPort } from './ports.js';
export type {
  ApplyGitPatchOptions,
  CreateGitBranchOptions,
  CreateWorktreeOptions,
  CreateWorktreeResult,
  GitBranchInfo,
  GitCommitAuthor,
  GitCommitInfo,
  GitCommitOptions,
  GitDiffNameStatusEntry,
  GitDiffOptions,
  GitDiscardChangesOptions,
  GitPatchApplyResult,
  GitRepositoryInfo,
  GitStagePathsOptions,
  GitStatusEntry,
  GitStatusKind,
  OverlayWorkingChangesOptions,
  OverlayWorkingChangesResult,
  RemoveWorktreeOptions,
  WorktreeInfo,
} from './contracts/index.js';

// Shared symbols this API relies on, so `@epsilon-asi/sandbox/git-manager` is self-sufficient.
export {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  CommandFailedError,
  SandboxError,
  ensureSuccess,
} from '../shared/index.js';
export type {
  CommandExecutionOptions,
  CommandExecutionResult,
  CommandExecutor,
  EnvironmentOverrides,
} from '../shared/index.js';
