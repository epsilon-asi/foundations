import type { BaseCommandContext, CommandDefinition, CommandResult } from '../types.js';
import { commandChain } from './binding.js';
import type { AnyMiddleware } from './types.js';

/** Everything one run of a command's chain needs. */
export interface ChainInput {
  readonly chain: readonly AnyMiddleware[];
  readonly base: BaseCommandContext;
  readonly instance: object;
  readonly definition: CommandDefinition;
  /** The parsed flags of one middleware. */
  readonly optionsFor: (middleware: AnyMiddleware) => Readonly<Record<string, unknown>>;
  /** Runs the command with its final context. */
  readonly run: (context: object) => CommandResult | Promise<CommandResult>;
}

export function runChain({ chain, base, instance, definition, optionsFor, run }: ChainInput): Promise<number> {
  return commandChain.run({
    chain, base,
    contextFor: middleware => ({ instance, definition, options: optionsFor(middleware) }),
    run: async context => {
      const result = await run(context);
      return typeof result === 'number' ? result : 0;
    },
    warn: message => base.logger.warn(message),
  });
}
