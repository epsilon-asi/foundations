import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PromptCancelledError,
  resolveEditor,
  terminalPrompter,
  type Prompter,
  type PromptInputStream,
  type PromptOutputStream,
} from '../src/index.js';
import { renderScreen } from './helpers/captureTerminal.js';

interface FakeTerminal {
  readonly input: PromptInputStream & { isRaw: boolean };
  readonly output: PromptOutputStream;
  readonly prompter: Prompter;
  /** Raw mode changes and writes to the output, in the order they happened. */
  readonly events: string[];
  /** Everything drawn so far. */
  readonly drawn: () => string;
  /** What the terminal shows after everything drawn so far. */
  readonly screen: () => string;
  /** Types `keys` once `drawn()` shows `waitFor`, so each answer reaches the prompt it is meant for. */
  readonly type: (keys: string, waitFor?: string) => Promise<void>;
}

/** A pretend TTY pair and a terminal prompter on it. The env is empty, so CI on the test machine does not matter. */
function fakeTerminal(env: NodeJS.ProcessEnv = {}): FakeTerminal {
  const events: string[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) {
      events.push(mode ? 'raw on' : 'raw off');
      input.isRaw = mode;
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80 });
  const write = output.write.bind(output);
  output.write = ((chunk: string | Uint8Array, ...rest: never[]) => {
    events.push(`draw ${String(chunk)}`);
    return write(chunk, ...rest);
  }) as typeof output.write;
  let drawn = '';
  output.on('data', (chunk: Buffer) => {
    drawn += chunk.toString();
  });

  const prompter = terminalPrompter({ input, output, env });
  if (prompter === undefined) throw new Error('expected a prompter on a pretend TTY');

  return {
    input,
    output,
    prompter,
    events,
    drawn: () => drawn,
    screen: () => renderScreen(drawn),
    type: async (keys, waitFor) => {
      if (waitFor !== undefined) await vi.waitFor(() => expect(drawn).toContain(waitFor));
      input.write(keys);
    },
  };
}

/** How many times `part` occurs in `text`. */
const count = (text: string, part: string): number => text.split(part).length - 1;

describe('terminalPrompter', () => {
  it('finds no one to ask without a TTY on both ends, with TERM=dumb or in CI', () => {
    const tty = Object.assign(new PassThrough(), { isTTY: true });
    const pipe = new PassThrough();

    expect(terminalPrompter({ input: pipe, output: tty, env: {} })).toBeUndefined();
    expect(terminalPrompter({ input: tty, output: pipe, env: {} })).toBeUndefined();
    expect(terminalPrompter({ input: tty, output: tty, env: { TERM: 'dumb' } })).toBeUndefined();
    expect(terminalPrompter({ input: tty, output: tty, env: { CI: 'true' } })).toBeUndefined();
    expect(terminalPrompter({ input: tty, output: tty, env: {} })).toBeDefined();
  });

  describe('confirm', () => {
    it('reads y, yes, n and no in any case, showing the default in the hint', async () => {
      const terminal = fakeTerminal();
      const answers: boolean[] = [];

      for (const [keys, options] of [
        ['y', {}],
        ['YES', { default: false }],
        ['n', { default: true }],
        ['No', {}],
      ] as const) {
        const answer = terminal.prompter.confirm('Go?', options);
        await terminal.type(`${keys}\r`);
        answers.push(await answer);
      }

      expect(answers).toEqual([true, true, false, false]);
      expect(terminal.drawn()).toContain('Go? [y/n] ');
      expect(terminal.drawn()).toContain('Go? [y/N] ');
      expect(terminal.drawn()).toContain('Go? [Y/n] ');
    });

    it('takes the default for Enter, and asks again for anything else', async () => {
      const terminal = fakeTerminal();

      const fallback = terminal.prompter.confirm('Go?', { default: true });
      await terminal.type('\r');
      await expect(fallback).resolves.toBe(true);

      const insisted = terminal.prompter.confirm('Delete?');
      await terminal.type('\r', 'Delete? [y/n] ');
      await terminal.type('maybe\r', 'Please answer y or n.\n');
      await vi.waitFor(() => expect(count(terminal.drawn(), 'Please answer y or n.')).toBe(2));
      await terminal.type('y\r');

      await expect(insisted).resolves.toBe(true);
      expect(terminal.input.isRaw).toBe(false);
    });

    it('cancels on Ctrl+C and on Ctrl+D', async () => {
      const terminal = fakeTerminal();

      const interrupted = terminal.prompter.confirm('Go?');
      await terminal.type('\x03', 'Go?');
      await expect(interrupted).rejects.toThrow(PromptCancelledError);

      const ended = terminal.prompter.confirm('Again?');
      await terminal.type('\x04', 'Again?');
      await expect(ended).rejects.toThrow(PromptCancelledError);
      expect(terminal.input.isRaw).toBe(false);
    });
  });

  describe('text', () => {
    it('reads a line, with readline editing', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.text('Name');
      // Backspace removes the typo.
      await terminal.type('Adx\x7fa\r', 'Name: ');

      await expect(answer).resolves.toBe('Ada');
    });

    it('shows the default and uses it for Enter', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.text('Which branch?', { default: 'main' });
      await terminal.type('\r', 'Which branch? (main) ');

      await expect(answer).resolves.toBe('main');
    });

    it('prints why an answer is rejected and asks again', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.text('Name', { validate: async (value) => value.trim() !== '' || 'A name is needed.' });
      await terminal.type('  \r', 'Name: ');
      await terminal.type('Ada\r', 'A name is needed.\n');

      await expect(answer).resolves.toBe('Ada');
    });
  });

  describe('secret', () => {
    it('draws a star per character, never the character, and handles backspace, Ctrl+U and arrow keys', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.secret('API key');
      await terminal.type('wrong', 'API key: ');
      await terminal.type('\x15');
      // Up arrow, then a typo removed with backspace.
      await terminal.type('sk-12\x1b[A34x\x7f\r');

      await expect(answer).resolves.toBe('sk-1234');
      expect(terminal.drawn()).toBe(`API key: ${'*'.repeat(5)}${'\b \b'.repeat(5)}${'*'.repeat(8)}\b \b\n`);
      expect(terminal.input.isRaw).toBe(false);
    });

    it('takes pasted text in one go, and draws nothing with an empty mask', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.secret('Token:', { mask: '' });
      await terminal.type('ghp_pasted-token\r', 'Token: ');

      await expect(answer).resolves.toBe('ghp_pasted-token');
      expect(terminal.drawn()).toBe('Token: \n');
    });

    it('asks again when validate rejects, without showing the answer', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.secret('API key', {
        validate: (value) => value.startsWith('sk-') || 'Keys start with sk-.',
      });
      await terminal.type('nope\r', 'API key: ');
      await terminal.type('sk-1\r', 'Keys start with sk-.\n');

      await expect(answer).resolves.toBe('sk-1');
      expect(terminal.drawn()).not.toContain('nope');
      // Echo is off before the question shows, and stays off while the first answer is checked.
      expect(terminal.events[0]).toBe('raw on');
      expect(terminal.events[1]).toBe('draw API key: ');
      expect(terminal.events.filter((event) => event.startsWith('raw'))).toEqual(['raw on', 'raw off']);
    });

    it('cancels on Ctrl+C, and on Ctrl+D only when nothing is typed', async () => {
      const terminal = fakeTerminal();

      const interrupted = terminal.prompter.secret('Key');
      await terminal.type('abc\x03', 'Key: ');
      await expect(interrupted).rejects.toThrow(PromptCancelledError);

      const ended = terminal.prompter.secret('Key');
      await terminal.type('a\x04\x7f\x04', 'Key: ');
      await expect(ended).rejects.toThrow(PromptCancelledError);
      expect(terminal.input.isRaw).toBe(false);
    });
  });

  describe('select', () => {
    const regions = ['us-east-1', { value: 'eu-west-1', label: 'Ireland' }, 'ap-south-1'];
    const HIDE_CURSOR = '\x1b[?25l';
    const SHOW_CURSOR = '\x1b[?25h';

    it('shows the choices below the question, moves with the arrow keys and picks with Enter', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.select('Region', { choices: regions });
      await vi.waitFor(() =>
        expect(terminal.screen()).toBe('Region (type to filter): \n> us-east-1\n  Ireland\n  ap-south-1'),
      );
      // Up from the first choice wraps to the last; down from the last wraps to the first.
      await terminal.type('\x1b[A');
      await vi.waitFor(() => expect(terminal.screen()).toContain('> ap-south-1'));
      await terminal.type('\x1b[B\x1b[B\r');

      await expect(answer).resolves.toBe('eu-west-1');
      // The list is gone, and the question is left with the label picked.
      expect(terminal.screen()).toBe('Region: Ireland\n');
      expect(terminal.drawn().startsWith(HIDE_CURSOR)).toBe(true);
      expect(terminal.drawn().endsWith(SHOW_CURSOR)).toBe(true);
      expect(terminal.events.filter((event) => event.startsWith('raw'))).toEqual(['raw on', 'raw off']);
    });

    it('filters the list by label or value as you type', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.select('Region', { choices: regions });
      await terminal.type('zz', '> us-east-1');
      await vi.waitFor(() => expect(terminal.screen()).toBe('Region (type to filter): zz\n  No choices match.'));
      // Enter picks nothing while nothing matches, the cursor has nowhere to go, and other keys are ignored.
      await terminal.type('\r\x1b[A\x1b[B\x1b[C\t');
      await terminal.type('\x15');
      await vi.waitFor(() => expect(terminal.screen()).toContain('> us-east-1\n  Ireland\n  ap-south-1'));
      await terminal.type('IRx\x7f');
      await vi.waitFor(() => expect(terminal.screen()).toBe('Region (type to filter): IR\n> Ireland'));
      await terminal.type('\x15west');
      await vi.waitFor(() => expect(terminal.screen()).toBe('Region (type to filter): west\n> Ireland'));
      await terminal.type('\r');

      await expect(answer).resolves.toBe('eu-west-1');
    });

    it('starts on the default, and scrolls a long list to keep the cursor in view', async () => {
      const terminal = fakeTerminal();
      const sizes = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
      const page = (from: number, cursor: number): string =>
        sizes
          .slice(from, from + 7)
          .map((size, offset) => `${from + offset === cursor ? '>' : ' '} ${size}`)
          .concat(`  (${from + 1}-${from + 7} of 10)`)
          .join('\n');

      const answer = terminal.prompter.select('Size', { choices: sizes, default: '4xl' });
      await vi.waitFor(() => expect(terminal.screen()).toBe(`Size (type to filter): \n${page(1, 7)}`));
      // Ctrl+N and Ctrl+P move too.
      await terminal.type('\x0e');
      await vi.waitFor(() => expect(terminal.screen()).toBe(`Size (type to filter): \n${page(2, 8)}`));
      await terminal.type('\x1b[B\x1b[B');
      await vi.waitFor(() => expect(terminal.screen()).toBe(`Size (type to filter): \n${page(0, 0)}`));
      await terminal.type('\x10');
      await vi.waitFor(() => expect(terminal.screen()).toBe(`Size (type to filter): \n${page(3, 9)}`));
      await terminal.type('\r');

      await expect(answer).resolves.toBe('6xl');
    });

    it('keeps each row on one line of the terminal', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.select('Pick', { choices: ['x'.repeat(100), 'short'] });
      await terminal.type('\r', '> x');

      await expect(answer).resolves.toBe('x'.repeat(100));
      const rows = renderScreen(terminal.drawn().split('\r')[0] ?? '').split('\n');
      expect(rows[1]).toBe(`> ${'x'.repeat(76)}…`);
      expect(terminal.screen()).toBe(`Pick: ${'x'.repeat(72)}…\n`);
    });

    it('cancels on Ctrl+C, and on Ctrl+D only when nothing is typed', async () => {
      const interrupted = fakeTerminal();
      const first = interrupted.prompter.select('Region', { choices: regions });
      await interrupted.type('\x03', '> us-east-1');
      await expect(first).rejects.toThrow(PromptCancelledError);
      expect(interrupted.screen()).toBe('Region: \n');
      expect(interrupted.drawn().endsWith(SHOW_CURSOR)).toBe(true);
      expect(interrupted.input.isRaw).toBe(false);

      const ended = fakeTerminal();
      const second = ended.prompter.select('Region', { choices: regions });
      await ended.type('u\x04\x7f\x04', '> us-east-1');
      await expect(second).rejects.toThrow(PromptCancelledError);
    });

    it('rejects choices it cannot show', async () => {
      const terminal = fakeTerminal();

      await expect(terminal.prompter.select('Region', { choices: [] })).rejects.toThrow(
        'select "Region" has no choices to pick from.',
      );
      expect(terminal.events).toEqual([]);
    });
  });

  describe('multiselect', () => {
    const checks = ['lint', { value: 'test', label: 'Unit tests' }, 'build'];

    it('picks and unpicks with Space, and accepts with Enter, in the order of the choices', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.multiselect('Checks', { choices: checks, default: ['build'] });
      await vi.waitFor(() =>
        expect(terminal.screen()).toBe('Checks (space to pick): \n> [ ] lint\n  [ ] Unit tests\n  [x] build'),
      );
      // Pick Unit tests, then lint; then up again, round to build, and unpick it. Letters do nothing.
      await terminal.type('\x1b[B \x1b[A x\x1b[A ');
      await vi.waitFor(() =>
        expect(terminal.screen()).toBe('Checks (space to pick): \n  [x] lint\n  [x] Unit tests\n> [ ] build'),
      );
      await terminal.type('\r');

      await expect(answer).resolves.toEqual(['lint', 'test']);
      expect(terminal.screen()).toBe('Checks: lint, Unit tests\n');
      expect(terminal.input.isRaw).toBe(false);
    });

    it('waits for at least min picks before accepting', async () => {
      const terminal = fakeTerminal();

      const answer = terminal.prompter.multiselect('Checks', { choices: ['lint', 'test'], min: 1 });
      await terminal.type('\r', '> [ ] lint');
      await vi.waitFor(() =>
        expect(terminal.screen()).toBe('Checks (space to pick): \n> [ ] lint\n  [ ] test\nPick at least 1 choice.'),
      );
      await terminal.type(' ');
      await vi.waitFor(() => expect(terminal.screen()).toBe('Checks (space to pick): \n> [x] lint\n  [ ] test'));
      await terminal.type('\r');

      await expect(answer).resolves.toEqual(['lint']);
    });

    it('accepts nothing picked when min allows it, and cancels on Ctrl+C or Ctrl+D', async () => {
      const none = fakeTerminal();
      const empty = none.prompter.multiselect('Checks', { choices: checks });
      await none.type('\r', '> [ ] lint');
      await expect(empty).resolves.toEqual([]);
      expect(none.screen()).toBe('Checks: \n');

      for (const key of ['\x03', '\x04']) {
        const terminal = fakeTerminal();
        const cancelled = terminal.prompter.multiselect('Checks', { choices: checks });
        await terminal.type(` ${key}`, '> [ ] lint');
        await expect(cancelled).rejects.toThrow(PromptCancelledError);
        expect(terminal.input.isRaw).toBe(false);
      }
    });
  });

  describe('editor', () => {
    const fakeEditor = fileURLToPath(new URL('./fixtures/fake-editor.mjs', import.meta.url));
    let scratch: string;
    let seenFile: string;

    beforeEach(async () => {
      scratch = await mkdtemp(join(tmpdir(), 'prompt-test-'));
      seenFile = join(scratch, 'seen.json');
    });
    afterEach(async () => {
      await rm(scratch, { recursive: true, force: true });
    });

    /** An env whose EDITOR is the fake editor, leaving `text` in the file and exiting with `exit`. */
    const editorEnv = (text: string | undefined, exit = 0, variable = 'EDITOR'): NodeJS.ProcessEnv => ({
      PATH: process.env.PATH,
      [variable]: `"${process.execPath}" "${fakeEditor}"`,
      FAKE_EDITOR_SEEN: seenFile,
      FAKE_EDITOR_EXIT: String(exit),
      ...(text === undefined ? {} : { FAKE_EDITOR_TEXT: text }),
    });

    const seen = (): { file: string; mode: string; text: string } => JSON.parse(readFileSync(seenFile, 'utf8'));

    it('opens a private file holding the initial text, and resolves to what is left in it', async () => {
      const terminal = fakeTerminal(editorEnv('fix: the thing\n\n# Lines starting with # are removed.\n'));
      const listeners = process.listenerCount('SIGINT');

      const message = await terminal.prompter.editor({
        initial: '\n# Lines starting with # are removed.\n',
        extension: 'md',
        comment: '#',
      });

      expect(message).toBe('fix: the thing');
      expect(seen().text).toBe('\n# Lines starting with # are removed.\n');
      expect(seen().file).toMatch(/edit\.md$/);
      expect(seen().mode).toBe('600');
      expect(existsSync(dirname(seen().file))).toBe(false);
      expect(process.listenerCount('SIGINT')).toBe(listeners);
      expect(terminal.drawn()).toBe('Waiting for your editor to close the file…\r\x1b[K');
    });

    it('cancels when the file is left empty', async () => {
      const terminal = fakeTerminal(editorEnv('# only a comment\n'));

      await expect(terminal.prompter.editor({ comment: '#' })).rejects.toThrow(
        'Cancelled: nothing was left in the editor.',
      );
    });

    it('fails when the editor fails, and removes the file anyway', async () => {
      const terminal = fakeTerminal(editorEnv(undefined, 3));

      await expect(terminal.prompter.editor({ initial: 'draft' })).rejects.toThrow(/the editor ".*" exited with code 3\./);
      expect(existsSync(dirname(seen().file))).toBe(false);
    });

    it('cancels when the editor is killed by a signal, and removes the file anyway', async () => {
      const terminal = fakeTerminal({ ...editorEnv(undefined), FAKE_EDITOR_SIGNAL: 'SIGTERM' });
      const listeners = process.listenerCount('SIGINT');

      await expect(terminal.prompter.editor({ initial: 'draft' })).rejects.toThrow(PromptCancelledError);
      expect(seen().text).toBe('draft');
      expect(existsSync(dirname(seen().file))).toBe(false);
      expect(process.listenerCount('SIGINT')).toBe(listeners);
    });

    it('says how to fix it when the editor is not installed', async () => {
      // The shell reports the missing command on stderr too.
      const terminal = fakeTerminal({ PATH: process.env.PATH, EDITOR: 'no-such-editor-for-tests' });

      await expect(terminal.prompter.editor()).rejects.toThrow(
        'could not run the editor "no-such-editor-for-tests"; set VISUAL or EDITOR to an editor that is installed.',
      );
    });

    it('prefers the CLI editor variable to VISUAL and EDITOR', async () => {
      const env = { ...editorEnv('from the cli variable', 0, 'TOOL_EDITOR'), VISUAL: 'false', EDITOR: 'false' };
      const input = Object.assign(new PassThrough(), { isTTY: true });
      const output = Object.assign(new PassThrough(), { isTTY: true });
      const prompter = terminalPrompter({ input, output, env, editorEnv: 'TOOL_EDITOR' });

      await expect(prompter?.editor()).resolves.toBe('from the cli variable');
    });

    it('rejects an extension with a path in it', async () => {
      const terminal = fakeTerminal(editorEnv('x'));

      await expect(terminal.prompter.editor({ extension: '../x' })).rejects.toThrow('cannot contain a path separator');
    });
  });
});

describe('resolveEditor', () => {
  it('looks at the CLI variable, then VISUAL, then EDITOR, then falls back to vi', () => {
    const env = { TOOL_EDITOR: 'code --wait', VISUAL: 'nvim', EDITOR: 'nano' };

    expect(resolveEditor(env, 'TOOL_EDITOR')).toBe('code --wait');
    expect(resolveEditor(env, undefined)).toBe('nvim');
    expect(resolveEditor({ VISUAL: '  ', EDITOR: 'nano' }, 'TOOL_EDITOR')).toBe('nano');
    expect(resolveEditor({}, undefined)).toBe('vi');
  });
});
