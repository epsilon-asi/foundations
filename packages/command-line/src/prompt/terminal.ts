import { createInterface, emitKeypressEvents, type Key } from 'node:readline';
import { isatty } from 'node:tty';
import { PromptCancelledError } from '../errors.js';
import type {
  MultiselectOptions,
  Prompter,
  PromptInputStream,
  PromptOutputStream,
  SelectOptions,
  TerminalPrompterOptions,
} from '../types.js';
import { editInEditor } from './editor.js';
import { readList } from './list.js';
import { choiceList, questionLine, rejection, serial } from './shared.js';

/** Drawn for each character of a secret unless the prompt says otherwise. */
const DEFAULT_MASK = '*';

/**
 * A prompter that asks on the terminal: it reads keys from stdin and draws on
 * stderr. Returns undefined when there is no one to ask: stdin or stderr is
 * not a TTY, `TERM` is `dumb`, or `CI` is set.
 *
 * Prompts are asked one at a time. Ctrl+C, and Ctrl+D on an empty answer,
 * reject with PromptCancelledError. Secrets and lists read keys in raw mode,
 * which is always put back afterwards. The editor always runs on the process's
 * own terminal, whatever `input` and `output` are.
 */
export function terminalPrompter(options: TerminalPrompterOptions = {}): Prompter | undefined {
  const env = options.env ?? process.env;
  // isatty() rather than process.stdin.isTTY, which would create the stdin stream just to look.
  const inputIsTTY = options.input === undefined ? isatty(0) : options.input.isTTY === true;
  const outputIsTTY = options.output === undefined ? isatty(2) : options.output.isTTY === true;
  if (!inputIsTTY || !outputIsTTY || env.TERM === 'dumb' || env.CI !== undefined) return undefined;

  const input = (): PromptInputStream => options.input ?? process.stdin;
  const output = options.output ?? process.stderr;
  const write = (text: string): void => {
    output.write(text);
  };
  const queue = serial();

  return Object.freeze({
    confirm: (message, { default: fallback } = {}) =>
      queue(async () => {
        const hint = fallback === undefined ? 'y/n' : fallback ? 'Y/n' : 'y/N';
        const question = `${message.trimEnd()} [${hint}] `;

        for (;;) {
          const answer = (await readLine(input(), output, question)).trim().toLowerCase();
          if (answer === '' && fallback !== undefined) return fallback;
          if (answer === 'y' || answer === 'yes') return true;
          if (answer === 'n' || answer === 'no') return false;
          write('Please answer y or n.\n');
        }
      }),

    text: (message, { default: fallback, validate } = {}) =>
      queue(async () => {
        const question = questionLine(message, fallback);

        for (;;) {
          const answer = await readLine(input(), output, question);
          if (answer === '' && fallback !== undefined) return fallback;
          const problem = await rejection(validate, answer);
          if (problem === undefined) return answer;
          write(`${problem}\n`);
        }
      }),

    secret: (message, { mask = DEFAULT_MASK, validate } = {}) =>
      queue(() => {
        const question = questionLine(message);
        // Kept raw while an answer is checked, so nothing typed meanwhile is echoed.
        return inRawMode(input(), async (keys) => {
          for (;;) {
            const answer = await readHidden(keys, output, question, mask);
            const problem = await rejection(validate, answer);
            if (problem === undefined) return answer;
            write(`${problem}\n`);
          }
        });
      }),

    editor: (editorOptions = {}) =>
      queue(() => editInEditor({ env, editorEnv: options.editorEnv, write }, editorOptions)),

    select: <T extends string>(message: string, { choices, default: fallback }: SelectOptions<T>) =>
      queue(async (): Promise<T> => {
        const defaults = fallback === undefined ? undefined : [fallback];
        const list = choiceList({ kind: 'select', message, choices, defaults, min: 0 });
        const cursor = Math.max(0, list.findIndex((choice) => choice.value === fallback));

        const [index = 0] = await inRawMode(input(), (keys) =>
          readList({ input: keys, output, message, choices: list, multiple: false, picked: [], cursor, min: 0 }),
        );
        return list[index]?.value as T;
      }),

    multiselect: <T extends string>(message: string, { choices, default: fallback, min = 0 }: MultiselectOptions<T>) =>
      queue(async (): Promise<T[]> => {
        const list = choiceList({ kind: 'multiselect', message, choices, defaults: fallback, min });
        const picked = list.flatMap((choice, index) => (fallback?.includes(choice.value as T) === true ? [index] : []));

        const indexes = await inRawMode(input(), (keys) =>
          readList({ input: keys, output, message, choices: list, multiple: true, picked, cursor: 0, min }),
        );
        return indexes.map((index) => list[index]?.value as T);
      }),
  } satisfies Prompter);
}

/**
 * Runs `during` with `keys` in raw mode, so the terminal neither echoes what
 * is typed nor waits for Enter to pass it on, then puts the mode back. Raw
 * mode is set before anything is drawn, since the terminal applies it only
 * once earlier output has drained.
 */
async function inRawMode<T>(keys: PromptInputStream, during: (keys: PromptInputStream) => Promise<T>): Promise<T> {
  const wasRaw = keys.isRaw === true;
  keys.setRawMode?.(true);
  try {
    return await during(keys);
  } finally {
    keys.setRawMode?.(wasRaw);
  }
}

/** Reads one line with readline, so the usual line editing works. */
function readLine(input: PromptInputStream, output: PromptOutputStream, question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lines = createInterface({ input, output, terminal: true, historySize: 0 });
    let settled = false;

    const settle = (finish: () => void, close = true): void => {
      if (settled) return;
      settled = true;
      if (close) lines.close();
      finish();
    };
    const cancel = (): void => {
      // The cursor is still on the question's row.
      output.write('\n');
      reject(new PromptCancelledError());
    };

    lines.on('line', (line: string) => settle(() => resolve(line)));
    // Ctrl+C. Without a listener readline would only pause the input.
    lines.on('SIGINT', () => settle(cancel));
    // Ctrl+D on an empty line, or the end of the input.
    lines.on('close', () => settle(cancel, false));

    lines.setPrompt(question);
    lines.prompt();
  });
}

/**
 * Reads one line from an input already in raw mode, drawing `mask` for each
 * character instead of the character. Backspace and Ctrl+U edit; arrow keys
 * and other control keys are ignored; pasted text is taken as typed.
 */
function readHidden(
  input: PromptInputStream,
  output: PromptOutputStream,
  question: string,
  mask: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const typed: string[] = [];
    const width = Array.from(mask).length;

    const unmask = (count: number): void => {
      if (width === 0 || count === 0) return;
      output.write(`${'\b'.repeat(width)}${' '.repeat(width)}${'\b'.repeat(width)}`.repeat(count));
    };

    const finish = (done: () => void): void => {
      input.removeListener('keypress', onKeypress);
      input.pause();
      output.write('\n');
      done();
    };
    const cancel = (): void => reject(new PromptCancelledError());

    const onKeypress = (character: string | undefined, key: Key | undefined): void => {
      const ctrl = key?.ctrl === true;

      if (ctrl && key?.name === 'c') return finish(cancel);
      if (ctrl && key?.name === 'd') {
        if (typed.length === 0) finish(cancel);
        return;
      }
      if (key?.name === 'return' || key?.name === 'enter') return finish(() => resolve(typed.join('')));
      if (key?.name === 'backspace') {
        if (typed.pop() !== undefined) unmask(1);
        return;
      }
      if (ctrl && key?.name === 'u') {
        unmask(typed.length);
        typed.length = 0;
        return;
      }
      // Escape sequences (arrows, function keys) arrive without a character.
      if (character === undefined || ctrl || key?.meta === true || /\p{Cc}/u.test(character)) return;

      typed.push(character);
      if (width > 0) output.write(mask);
    };

    emitKeypressEvents(input);
    input.on('keypress', onKeypress);
    input.resume();
    output.write(question);
  });
}
