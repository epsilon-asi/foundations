import type { CommandExecutionOptions, CommandExecutionResult, CommandExecutor } from '../../../src/shared/index.js';

/** One `run()` call as the executor received it. */
export interface RecordedCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: CommandExecutionOptions;
}

/** Either stdout of a successful run, or the result fields to override (exit code 0 and empty output by default). */
export type FakeResponse =
  string | Partial<Pick<CommandExecutionResult, 'exitCode' | 'signal' | 'stdout' | 'stderr' | 'timedOut'>>;

export interface FakeExecutor {
  readonly executor: CommandExecutor;
  readonly calls: RecordedCall[];
  /** Each call rendered as `<cwd> <args...>`. */
  readonly argv: () => string[];
}

/**
 * A `CommandExecutor` that records every call and answers from `respond`. Throwing from `respond` makes `run()`
 * reject with that error, like an executor that cannot spawn the binary.
 */
export function createFakeExecutor(respond: (call: RecordedCall) => FakeResponse = () => ''): FakeExecutor {
  const calls: RecordedCall[] = [];
  const executor: CommandExecutor = {
    run: async (binary, args, options = {}) => {
      const call: RecordedCall = { binary, args: [...args], options };
      calls.push(call);
      const response = respond(call);
      return {
        binary,
        args: [...args],
        command: [binary, ...args],
        cwd: options.cwd ?? '/fake-cwd',
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        timedOut: false,
        ...(typeof response === 'string' ? { stdout: response } : response),
      };
    },
  };
  return { executor, calls, argv: () => calls.map((call) => [call.options.cwd, ...call.args].join(' ')) };
}
