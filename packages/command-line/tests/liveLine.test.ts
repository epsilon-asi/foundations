import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Command,
  DEFAULT_SPINNER,
  Option,
  createLiveOutput,
  runCli,
  type CliCommand,
  type CommandContext,
  type LiveLineSpinner,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';
import { captureTerminal } from './helpers/captureTerminal.js';

/** What every redraw starts with: back to the start of the row, then erase it. */
const ERASE = '\r\x1b[K';

describe('a live line on a terminal', () => {
  it('is redrawn in place and leaves its final text behind', () => {
    const terminal = captureTerminal();
    const line = createLiveOutput(terminal.io).liveLine('Working');
    expect(terminal.screen()).toBe('Working');

    line.update('Still working');
    expect(terminal.screen()).toBe('Still working');

    line.done('Finished');
    expect(terminal.stderr()).toBe(`${ERASE}Working${ERASE}Still working${ERASE}Finished\n`);
    expect(terminal.screen()).toBe('Finished\n');
  });

  it('leaves its current text behind when done() is given none', () => {
    const terminal = captureTerminal();
    createLiveOutput(terminal.io).liveLine('Halfway').done();

    expect(terminal.screen()).toBe('Halfway\n');
  });

  it('leaves its final text as ordinary output, neither cut nor kept to one row', () => {
    const terminal = captureTerminal({ columns: 10 });
    createLiveOutput(terminal.io).liveLine('Working').done('Synced 3 repositories:\n  a, b, c');

    expect(terminal.screen()).toBe('Synced 3 repositories:\n  a, b, c\n');
  });

  it('erases itself on clear() and on done() with empty text', () => {
    const terminal = captureTerminal();
    const { liveLine } = createLiveOutput(terminal.io);

    liveLine('One').clear();
    liveLine('Two').done('');

    expect(terminal.stderr()).toBe(`${ERASE}One${ERASE}${ERASE}Two${ERASE}`);
    expect(terminal.screen()).toBe('');
  });

  it('writes nothing until it has text, nor for text already shown', () => {
    const terminal = captureTerminal();
    const line = createLiveOutput(terminal.io).liveLine();
    expect(terminal.output()).toBe('');

    line.update('Same');
    line.update('Same');
    expect(terminal.stderr()).toBe(`${ERASE}Same`);
  });

  it('reports its text and whether it is active, and ignores every call once ended', () => {
    const terminal = captureTerminal();
    const line = createLiveOutput(terminal.io).liveLine('Working');
    expect([line.text, line.active]).toEqual(['Working', true]);

    line.update('Nearly');
    line.done();
    const written = terminal.output();

    line.update('Again');
    line.done('Again');
    line.clear();

    expect([line.text, line.active]).toEqual(['Nearly', false]);
    expect(terminal.output()).toBe(written);
    expect(Object.isFrozen(line)).toBe(true);
  });

  it('keeps output written through its io above the line', () => {
    const terminal = captureTerminal();
    const { io, liveLine } = createLiveOutput(terminal.io);

    io.stdout('Header\n');
    const line = liveLine('Syncing');
    io.stdout('result\n');
    io.stderr('[info] synced\n');
    expect(terminal.screen()).toBe('Header\nresult\n[info] synced\nSyncing');

    line.done('Synced');
    expect(terminal.screen()).toBe('Header\nresult\n[info] synced\nSynced\n');
  });

  it('stays off a row that output left unfinished until that row ends', () => {
    const terminal = captureTerminal();
    const { io, liveLine } = createLiveOutput(terminal.io);

    io.stdout('Checking… ');
    const line = liveLine('Working');
    line.update('Still working');
    expect(terminal.screen()).toBe('Checking… ');

    io.stdout('ok\n');
    expect(terminal.screen()).toBe('Checking… ok\nStill working');

    line.clear();
    expect(terminal.screen()).toBe('Checking… ok\n');
  });

  it('leaves its final text after a row that output left unfinished', () => {
    const terminal = captureTerminal();
    const { io, liveLine } = createLiveOutput(terminal.io);

    io.stdout('Result: ');
    liveLine('Working').done('42');

    expect(terminal.screen()).toBe('Result: 42\n');
  });

  it('ignores empty writes', () => {
    const terminal = captureTerminal();
    const { io, liveLine } = createLiveOutput(terminal.io);

    liveLine('Working');
    io.stdout('');
    io.stderr('');

    expect(terminal.output()).toBe(`${ERASE}Working`);
  });

  it('passes stdout straight through when it writes somewhere other than the terminal', () => {
    const terminal = captureTerminal({ columns: 80, stdout: false });
    const { io, liveLine } = createLiveOutput(terminal.io);

    const line = liveLine('Working');
    io.stdout('{"partial":');
    line.update('Still working');

    expect(terminal.stdout()).toBe('{"partial":');
    expect(terminal.stderr()).toBe(`${ERASE}Working${ERASE}Still working`);
  });

  it('describes the same terminal on its io', () => {
    const terminal = captureTerminal({ columns: 30 });
    const { io } = createLiveOutput(terminal.io);

    expect(io).not.toBe(terminal.io);
    expect(io.terminal).toBe(terminal.io.terminal);
    expect(Object.isFrozen(io)).toBe(true);
  });

  it('ends the current line when another starts, and on end()', () => {
    const terminal = captureTerminal();
    const output = createLiveOutput(terminal.io);

    const first = output.liveLine('First');
    const second = output.liveLine('Second');
    expect([first.active, second.active]).toEqual([false, true]);

    output.end();
    output.end();
    expect(second.active).toBe(false);
    expect(terminal.screen()).toBe('First\nSecond\n');
  });
});

describe('a live line off a terminal', () => {
  it('writes only the text it leaves behind, and keeps the io as it is', () => {
    const { io, stderr } = captureIO();
    const output = createLiveOutput(io);
    expect(output.io).toBe(io);

    const line = output.liveLine('Working');
    line.update('Nearly');
    expect(stderr()).toBe('');

    line.done();
    output.liveLine('Again').done('Finished');
    output.liveLine('Gone').clear();
    output.liveLine('Empty').done('');

    expect(stderr()).toBe('Nearly\nFinished\n');
  });

  it('never starts a spinner', () => {
    vi.useFakeTimers();
    try {
      const { io, stderr } = captureIO();
      createLiveOutput(io).liveLine('Working', { spinner: true }).done();

      expect(vi.getTimerCount()).toBe(0);
      expect(stderr()).toBe('Working\n');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fitting a live line to the terminal', () => {
  /** The line as drawn on a terminal `columns` wide. */
  const drawn = (text: string, columns: number | undefined): string => {
    const terminal = captureTerminal({ columns });
    createLiveOutput(terminal.io).liveLine(text);
    return terminal.stderr().slice(ERASE.length);
  };

  it('cuts text too wide for the row with an ellipsis, one column short of the edge', () => {
    expect(drawn('abcdefghijklmnop', 10)).toBe('abcdefgh…');
    expect(drawn('abcdefghi', 10)).toBe('abcdefghi');
    expect(drawn('abc', 2)).toBe('…');
  });

  it('leaves text whole when the width is unknown or unusable', () => {
    const long = 'x'.repeat(200);

    expect(drawn(long, undefined)).toBe(long);
    expect(drawn(long, 0)).toBe(long);
    expect(drawn(long, 1)).toBe(long);
  });

  it('reads the width before every redraw', () => {
    const size = { columns: 20 };
    const terminal = captureTerminal(size);
    const line = createLiveOutput(terminal.io).liveLine('Syncing every repository');
    expect(terminal.screen()).toBe('Syncing every repo…');

    size.columns = 10;
    line.update('Syncing every repository again');
    expect(terminal.screen()).toBe('Syncing …');
  });

  it('counts wide characters and emoji as two columns and invisible characters as none', () => {
    expect(drawn('日本語のテキスト', 8)).toBe('日本語…');
    expect(drawn('🚀🚀🚀🚀', 6)).toBe('🚀🚀…');
    expect(drawn('café café', 10)).toBe('café café');
    expect(drawn('​abc', 4)).toBe('​abc');
  });

  it('keeps escape sequences, which take no room, even past the cut', () => {
    expect(drawn('\x1b[31mred\x1b[0m', 4)).toBe('\x1b[31mred\x1b[0m');
    expect(drawn('\x1b[1mbold text\x1b[22m and more', 8)).toBe('\x1b[1mbold t…\x1b[22m');

    const link = '\x1b]8;;https://example.com\x07example.com/a/long/path\x1b]8;;\x07';
    expect(drawn(link, 12)).toBe('\x1b]8;;https://example.com\x07example.co…\x1b]8;;\x07');
  });

  it('puts line breaks and tabs on one row and drops other control characters', () => {
    expect(drawn('one\ntwo\r\nthree\rfour\tfive\x07\x1b', 80)).toBe('one two three four five');
  });
});

describe('a live line spinner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('animates the default frames before the text', () => {
    const terminal = captureTerminal();
    const line = createLiveOutput(terminal.io).liveLine('Loading', { spinner: true });
    expect(terminal.screen()).toBe('⠋ Loading');

    vi.advanceTimersByTime(DEFAULT_SPINNER.interval);
    expect(terminal.screen()).toBe('⠙ Loading');

    line.update('Still loading');
    expect(terminal.screen()).toBe('⠙ Still loading');

    vi.advanceTimersByTime(DEFAULT_SPINNER.interval * (DEFAULT_SPINNER.frames.length - 1));
    expect(terminal.screen()).toBe('⠋ Still loading');

    line.done('Loaded');
    expect(terminal.screen()).toBe('Loaded\n');
  });

  it('draws custom frames at their own interval', () => {
    const spinner: LiveLineSpinner = { frames: ['-', '+'], interval: 250 };
    const terminal = captureTerminal();
    const line = createLiveOutput(terminal.io).liveLine('Waiting', { spinner });

    vi.advanceTimersByTime(249);
    expect(terminal.screen()).toBe('- Waiting');
    vi.advanceTimersByTime(1);
    expect(terminal.screen()).toBe('+ Waiting');
    vi.advanceTimersByTime(250);
    expect(terminal.screen()).toBe('- Waiting');

    line.clear();
  });

  it('stops when its line ends', () => {
    const terminal = captureTerminal();
    const { liveLine } = createLiveOutput(terminal.io);

    liveLine('One', { spinner: true }).clear();
    liveLine('Two', { spinner: true }).done();
    const written = terminal.output();
    vi.advanceTimersByTime(1000);

    expect(vi.getTimerCount()).toBe(0);
    expect(terminal.output()).toBe(written);
  });

  it('waits with the line while output leaves a row unfinished', () => {
    const terminal = captureTerminal();
    const { io, liveLine } = createLiveOutput(terminal.io);

    const line = liveLine('Loading', { spinner: true });
    io.stdout('partial');
    vi.advanceTimersByTime(DEFAULT_SPINNER.interval);
    expect(terminal.screen()).toBe('partial');

    io.stdout('\n');
    expect(terminal.screen()).toBe('partial\n⠙ Loading');
    line.clear();
  });

  it('is left out with spinner: false', () => {
    const terminal = captureTerminal();
    createLiveOutput(terminal.io).liveLine('Plain', { spinner: false });

    expect(terminal.screen()).toBe('Plain');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is rejected without frames or with an unusable interval, even off a terminal', () => {
    const { liveLine } = createLiveOutput(captureIO().io);

    expect(() => liveLine('x', { spinner: { frames: [], interval: 80 } })).toThrow(
      'A live line spinner needs at least one frame.',
    );
    expect(() => liveLine('x', { spinner: { frames: ['-'], interval: 0 } })).toThrow(
      'A live line spinner interval must be a positive number of milliseconds, not 0.',
    );
    expect(() => liveLine('x', { spinner: { frames: ['-'], interval: Number.POSITIVE_INFINITY } })).toThrow(
      /not Infinity\.$/,
    );
  });

  it('leaves the current line alone when the next one is rejected', () => {
    const terminal = captureTerminal();
    const { liveLine } = createLiveOutput(terminal.io);

    const line = liveLine('Working');
    expect(() => liveLine('Next', { spinner: { frames: [], interval: 80 } })).toThrow();

    expect(line.active).toBe(true);
    expect(terminal.screen()).toBe('Working');
  });
});

it('does not let a spinner keep the process alive', () => {
  const intervals = vi.spyOn(globalThis, 'setInterval');
  const line = createLiveOutput(captureTerminal().io).liveLine('Working', { spinner: true });

  const timer = intervals.mock.results[0]?.value as NodeJS.Timeout;
  expect(timer.hasRef()).toBe(false);

  line.clear();
});

describe('context.liveLine', () => {
  @Command({ name: 'sync' })
  class Sync implements CliCommand {
    run({ io, logger, liveLine }: CommandContext): void {
      const line = liveLine('Syncing 0/2');
      logger.info('found a');
      io.stdout('a\n');
      line.update('Syncing 2/2');
      line.done('Synced 2 repos');
    }
  }

  it('draws on stderr while logger and io output stays above it', async () => {
    const terminal = captureTerminal();

    await expect(runCli(Sync, [], { io: terminal.io })).resolves.toBe(0);
    expect(terminal.screen()).toBe('[info] found a\na\nSynced 2 repos\n');
    expect(terminal.stdout()).toBe('a\n');
  });

  it('writes only the final text to captured io', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(runCli(Sync, [], { io })).resolves.toBe(0);
    expect(stderr()).toBe('[info] found a\nSynced 2 repos\n');
    expect(stdout()).toBe('a\n');
  });

  it('ends a line still live when run() returns or throws', async () => {
    @Command({ name: 'tool' })
    class Tool implements CliCommand {
      @Option.boolean()
      fail: boolean | undefined;

      run({ liveLine }: CommandContext): void {
        liveLine('Halfway');
        if (this.fail === true) throw new Error('boom');
      }
    }

    const finished = captureTerminal();
    await expect(runCli(Tool, [], { io: finished.io })).resolves.toBe(0);
    expect(finished.screen()).toBe('Halfway\n');

    const failed = captureTerminal();
    await expect(runCli(Tool, ['--fail'], { io: failed.io })).resolves.toBe(1);
    expect(failed.screen()).toBe('Halfway\nerror: boom\n');
  });

  it('keeps commander output clear of the line too', async () => {
    @Command({ name: 'tool' })
    class Tool implements CliCommand {
      run({ command, liveLine }: CommandContext): void {
        liveLine('Halfway');
        command.error('error: gave up');
      }
    }

    const terminal = captureTerminal();
    await expect(runCli(Tool, [], { io: terminal.io })).resolves.toBe(1);
    expect(terminal.screen()).toBe('error: gave up\nHalfway\n');
  });
});
