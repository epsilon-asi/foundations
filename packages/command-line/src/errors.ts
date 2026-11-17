import type { PromptKind } from './types.js';

/** A mistake in how a command class is declared. Thrown when the tree is described or built, never at parse time. */
export class CliDefinitionError extends Error {
  public readonly className: string;

  public constructor(target: Function, message: string) {
    const className = target.name === '' ? '<anonymous class>' : target.name;
    super(`${className}: ${message}`);
    this.name = 'CliDefinitionError';
    this.className = className;
  }
}

/**
 * A middleware that is defined or used wrongly: calling `next()` twice, not
 * awaiting it, providing a value someone else already provides, and so on.
 */
export class MiddlewareError extends Error {
  public readonly middlewareName: string;

  public constructor(middlewareName: string, message: string, options?: ErrorOptions) {
    super(`middleware "${middlewareName}" ${message}`, options);
    this.name = 'MiddlewareError';
    this.middlewareName = middlewareName;
  }
}

/**
 * The person cancelled a prompt: Ctrl+C, Ctrl+D on an empty answer, or an
 * editor left with no text. One a command does not catch ends the run with
 * exit code 130, the code a shell gives a program stopped with Ctrl+C.
 */
export class PromptCancelledError extends Error {
  public constructor(message = 'Cancelled.') {
    super(message);
    this.name = 'PromptCancelledError';
  }
}

/** Why a prompt could not be shown. */
export type PromptUnavailableReason = 'no-terminal' | 'disabled';

/**
 * A prompt that needed an answer but could not ask for one: there is no
 * terminal (a pipe, CI, a captured io), or prompts were turned off with
 * `--no-input`, and the prompt has no `default` to fall back on.
 */
export class PromptUnavailableError extends Error {
  public readonly kind: PromptKind;
  /** The question that could not be asked. Undefined for `editor`. */
  public readonly prompt: string | undefined;
  public readonly reason: PromptUnavailableReason;

  public constructor(kind: PromptKind, prompt: string | undefined, reason: PromptUnavailableReason, hint?: string) {
    const what = prompt === undefined ? 'cannot open an editor' : `cannot ask "${prompt}"`;
    const why = reason === 'disabled' ? 'prompts are turned off' : 'there is no terminal to ask on';
    super(`${what}: ${why}.${hint === undefined ? '' : ` ${hint}`}`);
    this.name = 'PromptUnavailableError';
    this.kind = kind;
    this.prompt = prompt;
    this.reason = reason;
  }
}
