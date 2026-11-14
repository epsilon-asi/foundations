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
 * the start of the row, `\n` to the start of the next, `\b` back a cell,
 * `ESC[<n>A` up n rows, `ESC[K` erases to the end of the row and `ESC[J` to
 * the end of the screen. Other escape sequences are skipped and every other
 * character takes one cell.
 */
export function renderScreen(output: string): string {
  const rows: string[][] = [[]];
  let row = 0;
  let column = 0;

  for (const token of output.match(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|[^]/gu) ?? []) {
    const cells = rows[row] ?? [];
    const up = /^\x1b\[(\d*)A$/.exec(token);

    if (token === '\n') {
      row += 1;
      rows[row] ??= [];
      column = 0;
    } else if (token === '\r') {
      column = 0;
    } else if (token === '\b') {
      column = Math.max(0, column - 1);
    } else if (up !== null) {
      row = Math.max(0, row - Number(up[1] === '' ? 1 : up[1]));
    } else if (token === '\x1b[K') {
      cells.length = Math.min(cells.length, column);
    } else if (token === '\x1b[J') {
      cells.length = Math.min(cells.length, column);
      rows.length = row + 1;
    } else if (!token.startsWith('\x1b')) {
      cells[column] = token;
      column += 1;
    }
  }

  return rows.map((cells) => Array.from(cells, (cell) => cell ?? ' ').join('')).join('\n');
}
