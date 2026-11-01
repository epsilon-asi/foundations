import type {
  CommandExecutionOptions,
  CommandExecutionResult,
  CommandExecutor,
} from '../../../src/container-runtime/index.js';

/** The parts of a result a test scripts; `cwd` defaults to the run's `cwd` option, then `/host`. */
export type ScriptedResult = Partial<Omit<CommandExecutionResult, 'binary' | 'args' | 'command'>>;

/** Produces a result (or an error to throw) for commands that have no queued result. */
export type CommandResponder = (args: readonly string[]) => ScriptedResult | Error;

export interface RecordedCall {
  binary: string;
  args: string[];
  options?: CommandExecutionOptions;
}

/** Records every call; answers from the FIFO queue first, then from the optional responder. */
export class RecordingCommandExecutor implements CommandExecutor {
  readonly calls: RecordedCall[] = [];
  private readonly queue: (ScriptedResult | Error)[] = [];
  private readonly responder: CommandResponder | undefined;

  constructor(responder?: CommandResponder) {
    this.responder = responder;
  }

  /** `<group> <verb>` of every call, e.g. `container create`. */
  get verbs(): string[] {
    return this.calls.map((call) => call.args.slice(0, 2).join(' '));
  }

  enqueue(result: ScriptedResult = {}): void {
    this.queue.push(result);
  }

  enqueueError(error: Error): void {
    this.queue.push(error);
  }

  async run(
    binary: string,
    args: readonly string[],
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    this.calls.push({ binary, args: [...args], ...(options !== undefined ? { options } : {}) });

    const next = this.queue.shift() ?? this.responder?.(args);
    if (next === undefined) {
      throw new Error(`No queued result for ${binary} ${args.join(' ')}`);
    }
    if (next instanceof Error) {
      throw next;
    }
    return {
      binary,
      args: [...args],
      command: [binary, ...args],
      cwd: next.cwd ?? options?.cwd ?? '/host',
      exitCode: next.exitCode === undefined ? 0 : next.exitCode,
      signal: next.signal ?? null,
      stdout: next.stdout ?? '',
      stderr: next.stderr ?? '',
      durationMs: next.durationMs ?? 1,
      timedOut: next.timedOut ?? false,
    };
  }
}
