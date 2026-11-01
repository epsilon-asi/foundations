import { SandboxError } from '../shared/errors.js';

/** Removing a sandbox's container and/or worktree failed; `errors` holds every failure (also the `cause`). */
export class SandboxDisposeError extends SandboxError {
  readonly worktreePath: string;
  readonly errors: readonly unknown[];

  constructor(worktreePath: string, errors: readonly unknown[]) {
    super(`Failed to dispose sandbox at ${worktreePath}`, {
      cause: errors.length === 1 ? errors[0] : new AggregateError(errors),
    });
    this.worktreePath = worktreePath;
    this.errors = [...errors];
  }
}
