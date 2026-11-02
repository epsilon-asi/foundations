import type { CliIO, LiveLine, LiveLineOptions, LiveLineSpinner, LiveOutput, Writer } from './types.js';

/** The braille-dot spinner most terminal tools draw. */
export const DEFAULT_SPINNER: LiveLineSpinner = Object.freeze({
  frames: Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']),
  interval: 80,
});

/** Returns to the start of the row and erases it. */
const ERASE = '\r\x1b[K';

/** The line being shown: the handle that ends it, and what to draw for it. */
interface Current {
  readonly line: LiveLine;
  readonly content: () => string;
}

/**
 * Wraps `io` so it can show a live line: one line at the bottom of `stderr`,
 * redrawn in place, with everything written through the returned `io`
 * appearing above it. That needs `io.terminal`; without one nothing is
 * redrawn, a line writes only the text it leaves behind, and `io` is kept as is.
 */
export function createLiveOutput(io: CliIO): LiveOutput {
  const { terminal } = io;
  // What of the current line is on screen ('' for nothing), and whether output
  // written through `io` left the cursor mid-row, where the line cannot be
  // drawn until that row is finished.
  let current: Current | undefined;
  let drawn = '';
  let midRow = false;

  const draw = (): void => {
    if (terminal === undefined || current === undefined || midRow) return;
    const content = fitLine(current.content(), terminal.columns);
    if (content === drawn) return;
    io.stderr(`${ERASE}${content}`);
    drawn = content;
  };

  const erase = (): void => {
    if (drawn === '') return;
    io.stderr(ERASE);
    drawn = '';
  };

  /** Ends the current line, leaving `text` in its place as an ordinary line, or nothing when it is empty. */
  const leave = (text: string): void => {
    current = undefined;
    if (text === '') {
      erase();
      return;
    }
    io.stderr(`${drawn === '' ? '' : ERASE}${text}\n`);
    drawn = '';
    midRow = false;
  };

  /** Wraps a writer so the line is erased before each write and drawn again after it. */
  const above =
    (write: Writer): Writer =>
    (text) => {
      if (text === '') return;
      erase();
      write(text);
      midRow = !text.endsWith('\n');
      draw();
    };

  const liveLine = (initial = '', options: LiveLineOptions = {}): LiveLine => {
    const spinner = spinnerFrom(options.spinner);
    current?.line.done();

    let text = initial;
    let active = true;
    let frame: string | undefined;
    let timer: NodeJS.Timeout | undefined;

    // Off a terminal nothing is drawn, so there is nothing to animate.
    if (spinner !== undefined && terminal !== undefined) {
      const frames = cycle(spinner.frames);
      frame = frames.next().value;
      // Unreferenced, so a line nobody ends cannot keep the process alive.
      timer = setInterval(() => {
        frame = frames.next().value;
        draw();
      }, spinner.interval).unref();
    }

    const end = (leaving: string): void => {
      if (!active) return;
      active = false;
      clearInterval(timer);
      leave(leaving);
    };

    const line: LiveLine = Object.freeze({
      get text() {
        return text;
      },
      get active() {
        return active;
      },
      update: (next: string): void => {
        if (!active) return;
        text = next;
        draw();
      },
      done: (final: string = text): void => end(final),
      clear: (): void => end(''),
    });

    current = { line, content: () => (frame === undefined ? text : `${frame} ${text}`) };
    draw();
    return line;
  };

  return Object.freeze({
    io:
      terminal === undefined
        ? io
        : Object.freeze({
            stdout: terminal.stdout === false ? io.stdout : above(io.stdout),
            stderr: above(io.stderr),
            terminal,
          }),
    liveLine,
    end: (): void => current?.line.done(),
  });
}

/** Repeats `frames` forever. `frames` must not be empty. */
function* cycle(frames: readonly string[]): Generator<string, never> {
  for (;;) yield* frames;
}

/** The spinner `option` asks for, checked here so a bad one fails off a terminal too. */
function spinnerFrom(option: boolean | LiveLineSpinner | undefined): LiveLineSpinner | undefined {
  if (!option) return undefined;
  const spinner = option === true ? DEFAULT_SPINNER : option;

  if (spinner.frames.length === 0) {
    throw new Error('A live line spinner needs at least one frame.');
  }
  if (!Number.isFinite(spinner.interval) || spinner.interval <= 0) {
    throw new Error(`A live line spinner interval must be a positive number of milliseconds, not ${spinner.interval}.`);
  }
  return spinner;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** CSI (colours, cursor movement), OSC (titles, links) and other escape sequences, captured so `split` keeps them. */
const ESCAPE_SEQUENCES = /(\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[ -/]*[0-~]))/;

/** Graphemes drawn two columns wide: emoji, and East Asian wide and fullwidth characters. */
const WIDE =
  /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[\p{Ideographic}ᄀ-ᅟ⺀-㏿ꀀ-꓏가-힣︰-﹏！-｠￠-￦])/u;

/** Graphemes that take no room: combining marks and invisible formatting characters on their own. */
const ZERO_WIDTH = /^[\p{Mark}\p{Default_Ignorable_Code_Point}]+$/u;

interface Piece {
  readonly text: string;
  readonly width: number;
  readonly escape: boolean;
}

/**
 * `text` as it fits on one row of a terminal `columns` wide: line breaks and
 * tabs become spaces, other control characters are dropped, and text that is
 * too wide is cut with an ellipsis one column short of the edge, since filling
 * the last column makes some terminals wrap. Widths are approximate.
 */
function fitLine(text: string, columns: number | undefined): string {
  const pieces = text.split(ESCAPE_SEQUENCES).flatMap((part, index): Piece[] =>
    // `split` puts the captured escape sequences at the odd indexes.
    index % 2 === 1
      ? [{ text: part, width: 0, escape: true }]
      : Array.from(graphemes.segment(oneRow(part)), ({ segment }) => ({
          text: segment,
          width: widthOf(segment),
          escape: false,
        })),
  );

  const room = columns !== undefined && columns > 1 ? columns - 1 : Infinity;
  if (pieces.reduce((width, piece) => width + piece.width, 0) <= room) {
    return pieces.map((piece) => piece.text).join('');
  }

  // Escape sequences past the cut are kept, so colours and links opened before it are still closed.
  let fitted = '';
  let used = 0;
  let cut = false;
  for (const piece of pieces) {
    if (piece.escape) {
      fitted += piece.text;
    } else if (!cut && used + piece.width < room) {
      // `<` keeps a column free for the ellipsis.
      fitted += piece.text;
      used += piece.width;
    } else if (!cut) {
      fitted += '…';
      cut = true;
    }
  }
  return fitted;
}

/** Line breaks and tabs become spaces and other control characters are dropped, so text stays on one row. */
function oneRow(text: string): string {
  return text.replace(/\r\n|[\n\r\t\v\f]/g, ' ').replace(/\p{Cc}/gu, '');
}

/** Columns a grapheme takes on a terminal, approximately. */
function widthOf(grapheme: string): number {
  if (WIDE.test(grapheme)) return 2;
  return ZERO_WIDTH.test(grapheme) ? 0 : 1;
}
