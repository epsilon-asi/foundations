import { PromptCancelledError } from '../errors.js';
import { toScreamingSnakeCase } from '../naming.js';
import type { EditorOptions, PromptChoices, PromptValidator } from '../types.js';

export const DEFAULT_YES_FLAGS = '-y, --yes';
export const DEFAULT_YES_DESCRIPTION = 'answer yes to every confirmation';
export const DEFAULT_NO_INPUT_FLAGS = '--no-input';
export const DEFAULT_NO_INPUT_DESCRIPTION = 'never prompt: use defaults, or fail where there are none';

/** The environment variable that turns a CLI's prompts off: `agent-engineer` → `AGENT_ENGINEER_NO_INPUT`. */
export function noInputEnvName(cliName: string): string {
  return `${toScreamingSnakeCase(cliName)}_NO_INPUT`;
}

/** The environment variable naming a CLI's editor: `agent-engineer` → `AGENT_ENGINEER_EDITOR`. */
export function editorEnvName(cliName: string): string {
  return `${toScreamingSnakeCase(cliName)}_EDITOR`;
}

/** Runs tasks one at a time, in the order they were given, whether or not earlier ones failed. */
export type Serial = <T>(task: () => Promise<T>) => Promise<T>;

export function serial(): Serial {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/**
 * The question as drawn, ready for the answer: `Branch name (main): `, or
 * `Which branch? (main) ` when the message already ends in punctuation.
 */
export function questionLine(message: string, hint?: string): string {
  const base = message.trimEnd();
  const suffix = hint === undefined || hint === '' ? '' : ` (${hint})`;
  return `${base}${suffix}${/[?:!.]$/.test(base) ? ' ' : ': '}`;
}

/** Why `validate` rejects `value`, or undefined when it accepts it. */
export async function rejection(validate: PromptValidator | undefined, value: string): Promise<string | undefined> {
  if (validate === undefined) return undefined;
  const verdict = await validate(value);
  if (verdict === true) return undefined;
  return typeof verdict === 'string' && verdict !== '' ? verdict : 'That answer is not valid.';
}

/** `extension` as a file name suffix: `md` and `.md` both become `.md`. */
export function extensionOf(extension: string | undefined): string {
  if (extension === undefined || extension === '') return '';
  if (/[\\/]/.test(extension)) {
    throw new Error(`An editor file extension cannot contain a path separator, as "${extension}" does.`);
  }
  return extension.startsWith('.') ? extension : `.${extension}`;
}

/**
 * What an editor session resolves to: what was left in the file, without
 * comment lines, blank lines at the start and whitespace at the end. An empty
 * result cancels unless `allowEmpty` is set.
 */
export function editedText(text: string, options: EditorOptions): string {
  const { comment } = options;
  const lines = text.split(/\r?\n/);
  const kept = comment === undefined || comment === '' ? lines : lines.filter((line) => !line.startsWith(comment));
  const result = kept
    .join('\n')
    .replace(/^(?:[ \t]*\n)+/, '')
    .trimEnd();

  if (result === '' && options.allowEmpty !== true) {
    throw new PromptCancelledError('Cancelled: nothing was left in the editor.');
  }
  return result;
}

/** A choice of a list prompt, with its label filled in. */
export interface ListChoice {
  readonly value: string;
  readonly label: string;
}

export interface ChoiceSpec {
  readonly kind: 'select' | 'multiselect';
  readonly message: string;
  readonly choices: PromptChoices;
  /** The default value, or values, which must be among the choices. */
  readonly defaults: readonly string[] | undefined;
  /** How many must be picked. */
  readonly min: number;
}

/**
 * The choices of a list prompt, checked: at least one, no value twice, the
 * defaults among them and `min` within reach. A mistake is the command's, so
 * it throws whether or not anyone could be asked.
 */
export function choiceList(spec: ChoiceSpec): readonly ListChoice[] {
  const what = `${spec.kind} "${spec.message}"`;
  if (spec.choices.length === 0) throw new Error(`${what} has no choices to pick from.`);

  const list = spec.choices.map((choice) =>
    typeof choice === 'string' ? { value: choice, label: choice } : { value: choice.value, label: choice.label ?? choice.value },
  );
  const values = new Set<string>();
  for (const { value } of list) {
    if (values.has(value)) throw new Error(`${what} has the choice "${value}" more than once.`);
    values.add(value);
  }

  for (const value of spec.defaults ?? []) {
    if (!values.has(value)) throw new Error(`${what} has the default "${value}", which is not one of its choices.`);
  }
  if (!Number.isInteger(spec.min) || spec.min < 0 || spec.min > list.length) {
    throw new Error(`${what} has a min of ${spec.min}; it must be a whole number from 0 to ${list.length}, the number of choices.`);
  }
  if (spec.defaults !== undefined && new Set(spec.defaults).size < spec.min) {
    throw new Error(`${what} has ${plural(new Set(spec.defaults).size, 'default')}, fewer than its min of ${spec.min}.`);
  }

  return list;
}

/** `picked` in the order of `list`, each once. */
export function inChoiceOrder(list: readonly ListChoice[], picked: readonly string[]): string[] {
  return list.filter(({ value }) => picked.includes(value)).map(({ value }) => value);
}

/** `1 answer`, `2 answers`. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
