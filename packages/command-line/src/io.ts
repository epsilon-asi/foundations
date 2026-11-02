import type { CliIO, CliTerminal, TerminalStream } from './types.js';

export const processIO: CliIO = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  get terminal() {
    return detectTerminal(process.stderr, process.stdout);
  },
};

/**
 * Describes the terminal `stderr` writes to, or returns undefined when there
 * is no interactive one: it is not a TTY, `TERM` is `dumb`, or `CI` is set.
 */
export function detectTerminal(
  stderr: TerminalStream,
  stdout: TerminalStream,
  env: NodeJS.ProcessEnv = process.env,
): CliTerminal | undefined {
  if (stderr.isTTY !== true || env.TERM === 'dumb' || env.CI !== undefined) return undefined;

  return Object.freeze({
    // A TTY stream updates its columns when the terminal is resized.
    get columns() {
      return stderr.columns;
    },
    stdout: stdout.isTTY === true,
  });
}
