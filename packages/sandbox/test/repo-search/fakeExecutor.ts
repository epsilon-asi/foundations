import {
  CommandExecutionError,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type CommandExecutor,
} from '../../src/shared/index.js';

/** One recorded `run` call. */
export interface RecordedCommand {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: CommandExecutionOptions;
}

/** What a scripted command does: finish with (part of) a result, or reject with an error. */
export type FakeOutcome = Partial<CommandExecutionResult> | Error;

/** Picks the outcome of a call; `undefined` means "exit 0 with no output". */
export type FakeHandler = (command: RecordedCommand) => FakeOutcome | undefined;

/** A complete result for `binary args`, exiting 0 with no output unless overridden. */
export function commandResult(
  binary: string,
  args: readonly string[],
  overrides: Partial<CommandExecutionResult> = {},
): CommandExecutionResult {
  return {
    binary,
    args: [...args],
    command: [binary, ...args],
    cwd: '/fake',
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    durationMs: 0,
    timedOut: false,
    ...overrides,
  };
}

/** The `CommandExecutionError` the real executor raises when a binary is not installed. */
export function spawnFailure(binary: string, args: readonly string[] = []): CommandExecutionError {
  const cause = Object.assign(new Error(`spawn ${binary} ENOENT`), { code: 'ENOENT' });
  return new CommandExecutionError(`Failed to execute command: ${binary}`, { binary, args, cwd: '/fake' }, { cause });
}

/** Records every call and answers from a handler, like a scripted `ChildProcessCommandExecutor`. */
export class FakeCommandExecutor implements CommandExecutor {
  readonly calls: RecordedCommand[] = [];
  private readonly handler: FakeHandler;

  constructor(handler: FakeHandler = () => undefined) {
    this.handler = handler;
  }

  /** Calls whose binary is `binary`. */
  callsTo(binary: string): RecordedCommand[] {
    return this.calls.filter((call) => call.binary === binary);
  }

  async run(
    binary: string,
    args: readonly string[],
    options: CommandExecutionOptions = {},
  ): Promise<CommandExecutionResult> {
    const command = { binary, args: [...args], options };
    this.calls.push(command);
    const outcome = this.handler(command);
    if (outcome instanceof Error) throw outcome;
    return commandResult(binary, args, { cwd: options.cwd ?? '/fake', ...outcome });
  }
}
