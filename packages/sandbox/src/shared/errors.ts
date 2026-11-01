import { describeOutcome, formatCommand, isSuccessfulResult, type CommandExecutionResult } from './command.js';

/** Root of every error thrown by `@epsilon-asi/sandbox`; catch this to handle any failure from the package. */
export class SandboxError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Where a command was going to run when it failed to start. */
export interface CommandErrorContext {
  readonly binary: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/**
 * A command could not run to completion: it failed to spawn (e.g. the binary is not installed), was aborted
 * through its `AbortSignal`, or exceeded `maxOutputBytes`. The underlying error is the `cause`.
 */
export class CommandExecutionError extends SandboxError {
  readonly binary: string;
  readonly args: readonly string[];
  readonly cwd: string;

  constructor(message: string, context: CommandErrorContext, options?: ErrorOptions) {
    super(message, options);
    this.binary = context.binary;
    this.args = [...context.args];
    this.cwd = context.cwd;
  }
}

/** A command that was required to succeed exited non-zero, was killed by a signal, or timed out. */
export class CommandFailedError extends SandboxError {
  readonly result: CommandExecutionResult;

  constructor(message: string, result: CommandExecutionResult, options?: ErrorOptions) {
    super(message, options);
    this.result = result;
  }
}

/**
 * Returns `result` when the command succeeded; otherwise throws `CommandFailedError` whose message names the
 * command, its outcome, and its trimmed stderr, prefixed by `message` when given.
 */
export function ensureSuccess(result: CommandExecutionResult, message?: string): CommandExecutionResult {
  if (isSuccessfulResult(result)) {
    return result;
  }
  const summary = `${formatCommand(result.command)} failed (${describeOutcome(result)})`;
  const lines = [message === undefined ? summary : `${message}: ${summary}`, result.stderr.trim()];
  throw new CommandFailedError(lines.filter((line) => line.length > 0).join('\n'), result);
}
