import { SandboxError } from '../shared/index.js';

/**
 * Base class of the errors specific to the git worktree manager. Failed git commands raise the shared
 * `CommandFailedError`, and git binaries that cannot be started raise the shared `CommandExecutionError`.
 */
export class GitError extends SandboxError {}

/** The public API was called with missing or contradictory options; thrown before git is invoked. */
export class GitUsageError extends GitError {}

/** Git produced output that does not match the documented machine-readable format. */
export class GitOutputParseError extends GitError {
  /** The complete output that was being parsed. */
  readonly output: string;

  constructor(message: string, output: string, options?: ErrorOptions) {
    super(message, options);
    this.output = output;
  }
}

/** Throws a {@link GitUsageError} with `message` unless `condition` holds. */
export function assertUsage(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new GitUsageError(message);
  }
}
