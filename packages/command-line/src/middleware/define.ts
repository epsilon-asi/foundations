import { Option as CommanderOption } from 'commander';
import { commandChain } from './binding.js';
import { MiddlewareError } from '../errors.js';
import { optionFlags } from '../naming.js';
import type { OptionMetadata } from '../types.js';
import type {
  AnyMiddleware,
  Middleware,
  MiddlewareOptionsSpec,
  MiddlewareSpec,
  ProvidedBy,
} from './types.js';

const OPTION_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'boolean', 'choice']);

/** Whether `value` was made by the CLI's middleware binding. */
export const isMiddleware = commandChain.isMiddleware;

/**
 * Defines a middleware: a named step that runs around every command it is
 * used on. `handle(ctx, next)` does its work, then returns `next()` to run the
 * rest of the chain and the command, or returns an exit code to stop there.
 * Values passed to `next({ ... })` are added to the context of everything
 * downstream.
 *
 * ```ts
 * export const client = defineMiddleware({
 *   name: 'client',
 *   options: { endpoint: { type: 'string', short: 'e', description: 'service endpoint' } },
 *   async handle(ctx, next) {
 *     const client = await connect(ctx.options.endpoint);
 *     ctx.defer(() => client.close());
 *     return next({ client });
 *   },
 * });
 * ```
 *
 * The result is frozen and keeps no state between runs. Define each middleware
 * once, at module level: middleware is matched by identity, so a second
 * definition is a different middleware.
 */
export function defineMiddleware<
  const TUse extends readonly AnyMiddleware[] = [],
  const TOptions extends MiddlewareOptionsSpec = {},
  TProvided extends object = {},
>(spec: MiddlewareSpec<TUse, TOptions, TProvided>): Middleware<ProvidedBy<[Middleware<TProvided>, ...TUse]>> {
  return commandChain.define({
    name: spec.name, use: spec.use, options: checkOptions(spec.name, spec.options), handle: spec.handle,
  }) as Middleware<ProvidedBy<[Middleware<TProvided>, ...TUse]>>;
}

function checkOptions(name: string, options: unknown): MiddlewareOptionsSpec {
  if (options === undefined) return Object.freeze({});
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new MiddlewareError(name, 'has "options" that are not an object of option metadata.');
  }

  const checked: Record<string, OptionMetadata> = {};
  for (const [key, metadata] of Object.entries(options)) {
    checked[key] = checkOption(name, key, metadata);
  }
  return Object.freeze(checked);
}

function checkOption(name: string, key: string, value: unknown): OptionMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MiddlewareError(name, `has option "${key}", which is not option metadata.`);
  }

  const metadata = value as OptionMetadata;
  if (!OPTION_TYPES.has(metadata.type)) {
    throw new MiddlewareError(
      name,
      `has option "${key}" of type "${String(metadata.type)}"; it must be string, number, boolean or choice.`,
    );
  }
  if (metadata.type === 'choice' && !Array.isArray(metadata.choices)) {
    throw new MiddlewareError(name, `has choice option "${key}" without a "choices" array.`);
  }
  if (metadata.short !== undefined && !/^[A-Za-z0-9]$/.test(metadata.short)) {
    throw new MiddlewareError(
      name,
      `has option "${key}" with short flag "${metadata.short}"; it must be a single letter or digit.`,
    );
  }

  try {
    new CommanderOption(optionFlags(key, metadata));
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MiddlewareError(name, `has option "${key}" with unusable flags: ${reason}`, { cause: error });
  }

  return Object.freeze(
    metadata.type === 'choice' ? { ...metadata, choices: Object.freeze([...metadata.choices]) } : { ...metadata },
  );
}
