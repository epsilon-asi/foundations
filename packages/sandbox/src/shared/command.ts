/**
 * Environment overrides layered over `process.env` (or over the target's environment). A key whose value is
 * `undefined` removes that variable.
 */
export type EnvironmentOverrides = Readonly<Record<string, string | undefined>>;

/** Options for one command run through a {@link CommandExecutor}. */
export interface CommandExecutionOptions {
  /** Working directory. Default: the current process directory. */
  readonly cwd?: string;
  readonly env?: EnvironmentOverrides;
  /** Text written to the command's stdin before it is closed. */
  readonly stdin?: string;
  /** Sends SIGTERM (then SIGKILL after a short grace period) after this many milliseconds; sets `timedOut`. */
  readonly timeoutMs?: number;
  /** Aborting kills the command and rejects with `CommandExecutionError`. */
  readonly signal?: AbortSignal;
  /** Kills the command and rejects with `CommandExecutionError` once stdout or stderr exceeds this many bytes. */
  readonly maxOutputBytes?: number;
}

/** Outcome of a command that ran. Non-zero exit codes are reported here, never thrown. */
export interface CommandExecutionResult {
  readonly binary: string;
  readonly args: readonly string[];
  /** `[binary, ...args]`. */
  readonly command: readonly string[];
  readonly cwd: string;
  /** `null` when the process was terminated by a signal. */
  readonly exitCode: number | null;
  /** Signal that terminated the process, if any. */
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  /** `true` when the command was killed because it exceeded `timeoutMs`. */
  readonly timedOut: boolean;
}

/**
 * Runs a binary with an argument array (never through a shell). Every component in the package accepts an
 * executor, so one implementation can log, fake, or redirect all command execution — for example into a
 * container with `ContainerCommandExecutor`.
 */
export interface CommandExecutor {
  run(binary: string, args: readonly string[], options?: CommandExecutionOptions): Promise<CommandExecutionResult>;
}

/** A command succeeded when it exited with code 0 and was not killed by a timeout. */
export function isSuccessfulResult(result: Pick<CommandExecutionResult, 'exitCode' | 'timedOut'>): boolean {
  return result.exitCode === 0 && !result.timedOut;
}

/** Human-readable outcome of a finished command, e.g. `exit code 2`, `signal SIGKILL`, `timed out`. */
export function describeOutcome(result: Pick<CommandExecutionResult, 'exitCode' | 'signal' | 'timedOut'>): string {
  if (result.timedOut) {
    return 'timed out';
  }
  return result.exitCode === null ? `signal ${result.signal ?? 'unknown'}` : `exit code ${result.exitCode}`;
}

/** Shell-like rendering of a command for messages; tokens with special characters are JSON-quoted. */
export function formatCommand(tokens: readonly string[]): string {
  return tokens.map((token) => (/[^A-Za-z0-9_./:=,@-]/.test(token) ? JSON.stringify(token) : token)).join(' ');
}

/**
 * Resolves `overrides` layered over `base` into a final environment; `undefined` values remove the variable.
 * Use this only where the environment is handed to a process. To stack override layers that will be passed on
 * to a `CommandExecutor`, spread them instead (`{ ...a, ...b }`) so `undefined` (= unset) entries survive.
 */
export function mergeEnvironment(
  base: EnvironmentOverrides,
  ...overrides: readonly (EnvironmentOverrides | undefined)[]
): Record<string, string> {
  const merged = Object.assign({}, base, ...overrides) as EnvironmentOverrides;
  return Object.fromEntries(
    Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
