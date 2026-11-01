import type { Logger } from './logger.js';

export type Writer = (text: string) => void;

/** Output streams the CLI writes to. Injected so tests can capture output. */
export interface CliIO {
  readonly stdout: Writer;
  readonly stderr: Writer;
}

export const processIO: CliIO = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
};

/** Everything a command handler needs besides its own options. */
export interface CommandContext {
  readonly io: CliIO;
  readonly logger: Logger;
}
