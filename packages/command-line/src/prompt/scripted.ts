import { PromptCancelledError } from '../errors.js';
import type {
  AskedPrompt,
  MultiselectOptions,
  Prompter,
  PromptKind,
  ScriptedAnswer,
  ScriptedPrompter,
  SelectOptions,
} from '../types.js';
import { choiceList, editedText, inChoiceOrder, plural, rejection, type ListChoice } from './shared.js';

interface AnswerValues {
  readonly confirm: boolean;
  readonly text: string;
  readonly secret: string;
  readonly editor: string;
  readonly select: string;
  readonly multiselect: readonly string[];
}

const ANSWER_KEYS = ['confirm', 'text', 'secret', 'editor', 'select', 'multiselect', 'cancel'] as const;

/** How a run that used a scripted prompter ended. */
export interface RunOutcome {
  readonly exitCode: number;
  /** What ended the run, when something threw. */
  readonly error: unknown;
}

/** The end-of-run check of each scripted prompter. */
const scriptChecks = new WeakMap<Prompter, (outcome: RunOutcome) => void>();

/**
 * Throws when `prompter` is a scripted prompter with answers left unused: the
 * command stopped asking before the script ran out. Other prompters pass.
 */
export function finishScript(prompter: Prompter, outcome: RunOutcome): void {
  scriptChecks.get(prompter)?.(outcome);
}

/**
 * A prompter that answers from `answers`, in order, for tests: pass it to
 * `buildCli` / `runCli` as `prompter`. Each answer names the kind of prompt it
 * answers, and may name the question too. A prompt of another kind, another
 * question or with no answer left throws, and so does an answer `validate`
 * rejects or one that is not among a list prompt's choices, so a test fails
 * where the conversation went differently. Answers still left when the run
 * ends make `run()` reject.
 *
 * Text defaults apply to an empty answer and editor comment lines are
 * removed, as on a terminal.
 */
export function scriptedPrompter(answers: readonly ScriptedAnswer[]): ScriptedPrompter {
  const script = [...answers];
  const asked: AskedPrompt[] = [];

  const take = <K extends PromptKind>(kind: K, message: string | undefined): AnswerValues[K] => {
    asked.push(Object.freeze({ kind, message }));
    const what = describeAsked(kind, message);
    const answer = script.shift();

    if (answer === undefined) throw new Error(`scripted prompter has no answer left for ${what}.`);
    const answered = answerKind(answer);
    if (answered !== kind && answered !== 'cancel') {
      throw new Error(`scripted prompter has a ${String(answered)} answer next, but was asked ${what}.`);
    }
    const expected = answer.message;
    if (expected !== undefined && (message === undefined || !matches(expected, message))) {
      throw new Error(`scripted prompter expected to be asked ${describeQuestion(expected)}, but was asked ${what}.`);
    }
    if (answered === 'cancel') throw new PromptCancelledError();

    return (answer as unknown as Readonly<Record<K, AnswerValues[K]>>)[kind];
  };

  const prompter: ScriptedPrompter = {
    get asked() {
      return Object.freeze([...asked]);
    },
    get remaining() {
      return script.length;
    },

    confirm: async (message) => take('confirm', message),

    text: async (message, { default: fallback, validate } = {}) => {
      const value = take('text', message);
      if (value === '' && fallback !== undefined) return fallback;
      const problem = await rejection(validate, value);
      if (problem !== undefined) {
        throw new Error(`scripted answer "${value}" to "${message}" was rejected: ${problem}`);
      }
      return value;
    },

    secret: async (message, { validate } = {}) => {
      const value = take('secret', message);
      const problem = await rejection(validate, value);
      // The value is a secret, even in a test, so it is left out.
      if (problem !== undefined) throw new Error(`scripted answer to secret "${message}" was rejected: ${problem}`);
      return value;
    },

    editor: async (options = {}) => editedText(take('editor', undefined), options),

    select: async <T extends string>(message: string, options: SelectOptions<T>): Promise<T> => {
      const defaults = options.default === undefined ? undefined : [options.default];
      const list = choiceList({ kind: 'select', message, choices: options.choices, defaults, min: 0 });
      const value = take('select', message);
      assertChoices(list, message, [value]);
      return value as T;
    },

    multiselect: async <T extends string>(message: string, options: MultiselectOptions<T>): Promise<T[]> => {
      const min = options.min ?? 0;
      const list = choiceList({ kind: 'multiselect', message, choices: options.choices, defaults: options.default, min });
      const values = take('multiselect', message);
      assertChoices(list, message, values);

      const picked = inChoiceOrder(list, values);
      if (picked.length < min) {
        throw new Error(`scripted answer to "${message}" picks ${plural(picked.length, 'choice')}, fewer than its min of ${min}.`);
      }
      return picked as T[];
    },
  };

  scriptChecks.set(prompter, ({ exitCode, error }) => {
    if (script.length === 0) return;

    const left = script.map(describeAnswer).join(', ');
    const seen = asked.length === 0 ? 'nothing' : `for ${asked.map((it) => describeAsked(it.kind, it.message)).join(', ')}`;
    const reason = error instanceof Error && exitCode !== 0 ? `: ${error.message.replace(/\.$/, '')}` : '';
    const ended = exitCode === 0 ? '' : ` The run exited with code ${exitCode}${reason}.`;
    throw new Error(
      `scripted prompter has ${plural(script.length, 'answer')} left that ${script.length === 1 ? 'was' : 'were'} ` +
        `never asked for: ${left}. It was asked ${seen}.${ended}`,
      { cause: error },
    );
  });

  return Object.freeze(prompter);
}

/** Throws unless every one of `values` is among the choices. */
function assertChoices(list: readonly ListChoice[], message: string, values: readonly string[]): void {
  const unknown = values.find((value) => !list.some((choice) => choice.value === value));
  if (unknown === undefined) return;
  const choices = list.map((choice) => choice.value).join(', ');
  throw new Error(`scripted answer "${unknown}" to "${message}" is not one of its choices: ${choices}.`);
}

function answerKind(answer: ScriptedAnswer): (typeof ANSWER_KEYS)[number] | undefined {
  return ANSWER_KEYS.find((key) => key in answer);
}

/** `text "Name"`, or `the editor prompt` for a prompt without a question. */
function describeAsked(kind: PromptKind, message: string | undefined): string {
  return message === undefined ? `the ${kind} prompt` : `${kind} "${message}"`;
}

/** `confirm "Go?"`, `text /name/`, or `secret` for an answer that names no question. */
function describeAnswer(answer: ScriptedAnswer): string {
  const kind = String(answerKind(answer));
  return answer.message === undefined ? kind : `${kind} ${describeQuestion(answer.message)}`;
}

function describeQuestion(expected: string | RegExp): string {
  return typeof expected === 'string' ? `"${expected}"` : String(expected);
}

function matches(expected: string | RegExp, message: string): boolean {
  return typeof expected === 'string' ? expected === message : expected.test(message);
}
