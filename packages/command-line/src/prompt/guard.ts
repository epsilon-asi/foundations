import { PromptUnavailableError, type PromptUnavailableReason } from '../errors.js';
import type { LiveOutput, Logger, MultiselectOptions, Prompter, PromptKind, SelectOptions } from '../types.js';
import { choiceList, inChoiceOrder, serial } from './shared.js';

export interface GuardSetup {
  /** Who answers prompts, or undefined when no one can: there is no terminal, or prompts are off. */
  readonly asker: Prompter | undefined;
  /** Why there is no asker, for the error when a prompt has no default. */
  readonly reason: PromptUnavailableReason;
  /** Whether every confirmation is answered yes without asking. */
  readonly yes: boolean;
  /** The flag that answers yes, suggested when a confirmation cannot be asked. */
  readonly yesFlag: string | undefined;
  /** Kept clear while a prompt is asked. */
  readonly live: LiveOutput;
  readonly logger: Logger;
}

/**
 * The prompter a command gets as `context.prompt`. It decides whether to ask
 * at all: `--yes` answers confirmations, and without an asker a prompt
 * resolves to its default or throws PromptUnavailableError. When it does ask,
 * prompts go one at a time, with the live line suspended meanwhile.
 */
export function guardPrompter(setup: GuardSetup): Prompter {
  const { asker, reason, live, logger } = setup;
  const queue = serial();
  const why = reason === 'disabled' ? 'prompts are turned off' : 'there is no terminal to ask on';

  const ask = <T>(question: (asker: Prompter) => Promise<T>): Promise<T> | undefined =>
    asker === undefined ? undefined : queue(() => live.suspend(() => question(asker)));

  const fallback = <T>(kind: PromptKind, message: string | undefined, value: T | undefined, hint?: string): T => {
    if (value === undefined) throw new PromptUnavailableError(kind, message, reason, hint);
    logger.debug(`using the default for ${message === undefined ? 'the editor' : `"${message}"`}: ${why}`);
    return value;
  };

  return Object.freeze({
    confirm: async (message, options = {}) => {
      if (setup.yes) {
        logger.debug(`answered yes to "${message}" (${setup.yesFlag ?? 'yes'})`);
        return true;
      }
      const hint = setup.yesFlag === undefined ? undefined : `Pass ${setup.yesFlag} to answer yes.`;
      return ask((it) => it.confirm(message, options)) ?? fallback('confirm', message, options.default, hint);
    },

    text: async (message, options = {}) =>
      ask((it) => it.text(message, options)) ?? fallback('text', message, options.default),

    // A secret has no default: there is nothing sensible to fall back on.
    secret: async (message, options = {}) =>
      ask((it) => it.secret(message, options)) ?? fallback<string>('secret', message, undefined),

    editor: async (options = {}) => ask((it) => it.editor(options)) ?? fallback('editor', undefined, options.default),

    select: async <T extends string>(message: string, options: SelectOptions<T>): Promise<T> => {
      // Checked before anything is asked, so a mistake in the choices shows whether or not there is a terminal.
      const defaults = options.default === undefined ? undefined : [options.default];
      choiceList({ kind: 'select', message, choices: options.choices, defaults, min: 0 });
      return ask((it) => it.select(message, options)) ?? fallback('select', message, options.default);
    },

    multiselect: async <T extends string>(message: string, options: MultiselectOptions<T>): Promise<T[]> => {
      const list = choiceList({
        kind: 'multiselect',
        message,
        choices: options.choices,
        defaults: options.default,
        min: options.min ?? 0,
      });
      const defaults = options.default === undefined ? undefined : (inChoiceOrder(list, options.default) as T[]);
      return ask((it) => it.multiselect(message, options)) ?? fallback('multiselect', message, defaults);
    },
  } satisfies Prompter);
}
