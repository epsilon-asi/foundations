import { emitKeypressEvents, type Key } from 'node:readline';
import { PromptCancelledError } from '../errors.js';
import { fitLine } from '../liveLine.js';
import type { PromptInputStream, PromptOutputStream } from '../types.js';
import { plural, questionLine, type ListChoice } from './shared.js';

/** How many choices show at once. The list scrolls to keep the cursor in view. */
const PAGE_SIZE = 7;
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

export interface ListPrompt {
  /** Already in raw mode. */
  readonly input: PromptInputStream;
  readonly output: PromptOutputStream;
  readonly message: string;
  readonly choices: readonly ListChoice[];
  /** Any number can be picked with Space, instead of one with Enter. */
  readonly multiple: boolean;
  /** Indexes of the choices picked when the list opens. */
  readonly picked: readonly number[];
  /** Index of the choice the cursor starts on. */
  readonly cursor: number;
  /** How many must be picked before Enter is accepted. */
  readonly min: number;
}

/**
 * Shows a list of choices below the question and resolves to the indexes of
 * those picked, in the order of the choices. Arrow keys (or Ctrl+P and
 * Ctrl+N) move, wrapping at either end. With one to pick, typing filters the
 * list and Enter picks; with several, Space picks or unpicks and Enter
 * accepts. Ctrl+C, and Ctrl+D with nothing typed, cancel. Once answered, the
 * list is erased and the question left with the answer, as other prompts do.
 */
export function readList(prompt: ListPrompt): Promise<number[]> {
  const { input, output, choices, multiple, min } = prompt;
  const asking = questionLine(prompt.message, multiple ? 'space to pick' : 'type to filter');
  const answered = questionLine(prompt.message);

  return new Promise((resolve, reject) => {
    const picked = new Set(prompt.picked);
    let filter = '';
    // Where the cursor is among the choices shown, and the first one shown.
    let cursor = prompt.cursor;
    let top = 0;
    let notice: string | undefined;
    // Rows drawn below the question, so the next draw can go back over them.
    let below: number | undefined;

    const shown = (): number[] => {
      const needle = filter.toLowerCase();
      return choices.flatMap((choice, index) =>
        needle === '' || choice.label.toLowerCase().includes(needle) || choice.value.toLowerCase().includes(needle)
          ? [index]
          : [],
      );
    };

    const lines = (visible: readonly number[]): string[] => {
      cursor = Math.min(cursor, Math.max(0, visible.length - 1));
      top = Math.min(Math.max(top, cursor - PAGE_SIZE + 1), cursor);

      const rows = visible.slice(top, top + PAGE_SIZE).map((index, offset) => {
        const pointer = top + offset === cursor ? '>' : ' ';
        const box = multiple ? (picked.has(index) ? '[x] ' : '[ ] ') : '';
        return `${pointer} ${box}${choices[index]?.label ?? ''}`;
      });
      if (visible.length === 0) rows.push('  No choices match.');
      if (visible.length > PAGE_SIZE) {
        rows.push(`  (${top + 1}-${Math.min(top + PAGE_SIZE, visible.length)} of ${visible.length})`);
      }
      if (notice !== undefined) rows.push(notice);
      return [`${asking}${filter}`, ...rows];
    };

    // Each line is cut to one row, so moving up `below` rows reaches the question again.
    const erase = (): string => (below === undefined ? '' : `\r${below > 0 ? `\x1b[${below}A` : ''}\x1b[J`);
    const draw = (): void => {
      const rows = lines(shown()).map((line) => fitLine(line, output.columns));
      output.write(`${below === undefined ? HIDE_CURSOR : erase()}${rows.join('\n')}`);
      below = rows.length - 1;
      notice = undefined;
    };

    const finish = (answer: string | undefined, done: () => void): void => {
      input.removeListener('keypress', onKeypress);
      input.pause();
      output.write(`${erase()}${fitLine(`${answered}${answer ?? ''}`, output.columns)}\n${SHOW_CURSOR}`);
      done();
    };
    const cancel = (): void => reject(new PromptCancelledError());
    const refilter = (text: string): void => {
      filter = text;
      cursor = 0;
      top = 0;
      draw();
    };

    const onKeypress = (character: string | undefined, key: Key | undefined): void => {
      const name = key?.name;
      const ctrl = key?.ctrl === true;
      const visible = shown();

      if (ctrl && name === 'c') return finish(undefined, cancel);
      if (ctrl && name === 'd') {
        if (filter === '') finish(undefined, cancel);
        return;
      }
      if (name === 'return' || name === 'enter') {
        if (multiple) {
          if (picked.size < min) {
            notice = `Pick at least ${plural(min, 'choice')}.`;
            return draw();
          }
          const answer = [...picked].sort((a, b) => a - b);
          const labels = answer.map((index) => choices[index]?.label ?? '').join(', ');
          return finish(labels, () => resolve(answer));
        }
        const index = visible[cursor];
        // Nothing matches the filter, so there is nothing to pick.
        if (index === undefined) return;
        return finish(choices[index]?.label, () => resolve([index]));
      }
      if (name === 'up' || (ctrl && name === 'p')) {
        cursor = visible.length === 0 ? 0 : (cursor - 1 + visible.length) % visible.length;
        return draw();
      }
      if (name === 'down' || (ctrl && name === 'n')) {
        cursor = visible.length === 0 ? 0 : (cursor + 1) % visible.length;
        return draw();
      }

      if (multiple) {
        const index = visible[cursor];
        if (name !== 'space' || index === undefined) return;
        if (!picked.delete(index)) picked.add(index);
        return draw();
      }

      if (name === 'backspace') {
        if (filter !== '') refilter(Array.from(filter).slice(0, -1).join(''));
        return;
      }
      if (ctrl && name === 'u') return refilter('');
      // Escape sequences (other arrows, function keys) arrive without a character.
      if (character === undefined || ctrl || key?.meta === true || /\p{Cc}/u.test(character)) return;
      refilter(filter + character);
    };

    emitKeypressEvents(input);
    input.on('keypress', onKeypress);
    input.resume();
    draw();
  });
}
