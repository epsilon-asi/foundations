import type { CliIO, CliTerminal } from '../../src/index.js';

type Stream = 'stdout' | 'stderr';

export interface CapturedTerminal {
  readonly io: CliIO;
  /** Everything written to either stream, in order, as the terminal receives it. */
  readonly output: () => string;
  readonly stdout: () => string;
  readonly stderr: () => string;
  /** What the terminal shows after `output()`, rows joined with newlines. */
  readonly screen: () => string;
}

/** A `CliIO` on a pretend terminal. Both streams land in one transcript, as they do on a real one. */
export function captureTerminal(terminal: CliTerminal = { columns: 80 }): CapturedTerminal {
  const writes: { readonly stream: Stream; readonly text: string }[] = [];
  const written = (stream?: Stream): string =>
    writes
      .filter((write) => stream === undefined || write.stream === stream)
      .map((write) => write.text)
      .join('');

  return {
    io: {
      stdout: (text) => {
        writes.push({ stream: 'stdout', text });
      },
      stderr: (text) => {
        writes.push({ stream: 'stderr', text });
      },
      terminal,
    },
    output: () => written(),
    stdout: () => written('stdout'),
    stderr: () => written('stderr'),
    screen: () => renderScreen(written()),
  };
}

/**
 * Plays `output` on a pretend terminal and returns what it shows: `\r` goes to
 * the start of the row, `\n` to the start of the next, `ESC[K` erases to the
 * end of the row, other escape sequences are skipped and every other
 * character takes one cell.
 */
export function renderScreen(output: string): string {
  let cells: string[] = [];
  const rows = [cells];
  let column = 0;

  for (const token of output.match(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|[^]/gu) ?? []) {
    if (token === '\n') {
      cells = [];
      rows.push(cells);
      column = 0;
    } else if (token === '\r') {
      column = 0;
    } else if (token === '\x1b[K') {
      cells.length = Math.min(cells.length, column);
    } else if (!token.startsWith('\x1b')) {
      cells[column] = token;
      column += 1;
    }
  }

  return rows.map((row) => row.join('')).join('\n');
}
