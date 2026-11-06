import { MiddlewareError } from '../errors.js';
import type { BaseCommandContext, CommandDefinition, CommandResult } from '../types.js';
import type { AnyMiddleware, ChainResult, Cleanup, MiddlewareContext, Next } from './types.js';

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

type Values = Readonly<Record<string, unknown>>;
type Providers = ReadonlyMap<string, string>;

/** Keys only middleware contexts have. Together with the base context's keys, nothing can be provided under them. */
const MIDDLEWARE_KEYS = ['instance', 'definition', 'options', 'defer'] as const;

/**
 * Runs the chain around the command and resolves to the exit code. Each
 * middleware and the command get a new frozen context. Cleanups registered
 * with `defer()` run afterwards, last first, whatever happened.
 */
export async function runChain(input: ChainInput): Promise<number> {
  const { chain, base, instance, definition, optionsFor, run } = input;
  const reserved: ReadonlySet<string> = new Set([...Object.keys(base), ...MIDDLEWARE_KEYS]);
  const results = new WeakSet<object>();
  const cleanups: { readonly middleware: string; readonly cleanup: Cleanup }[] = [];
  let finished = false;

  const dispatch = async (index: number, provided: Values, providers: Providers): Promise<number> => {
    const middleware = chain[index];
    if (middleware === undefined) {
      const result = await run(Object.freeze({ ...base, ...provided }));
      return typeof result === 'number' ? result : 0;
    }

    const { name } = middleware;
    const context = Object.freeze({
      ...base,
      ...provided,
      instance,
      definition,
      options: optionsFor(middleware),
      defer: (cleanup: Cleanup): void => {
        if (typeof cleanup !== 'function') {
          throw new MiddlewareError(name, 'passed defer() something that is not a function.');
        }
        if (finished) throw new MiddlewareError(name, 'called defer() after the command had finished.');
        cleanups.push({ middleware: name, cleanup });
      },
    });

    let called = false;
    let settled = false;
    let returned = false;
    let misuse: MiddlewareError | undefined;
    let pending: Promise<unknown> | undefined;

    const next = (provide?: unknown): Promise<ChainResult> => {
      if (returned) {
        return Promise.reject(new MiddlewareError(name, 'called next() after its handler had returned.'));
      }
      if (called) {
        // Kept so the misuse is reported even when this call's promise is ignored.
        misuse ??= new MiddlewareError(name, 'called next() more than once.');
        const rejected = Promise.reject(misuse);
        rejected.catch(() => undefined);
        return rejected;
      }
      called = true;

      const result = (async (): Promise<ChainResult> => {
        try {
          const merged = merge(name, provided, providers, provide, reserved);
          const exitCode = await dispatch(index + 1, merged.values, merged.providers);
          const outcome = Object.freeze({ exitCode });
          results.add(outcome);
          return outcome;
        } finally {
          settled = true;
        }
      })();
      // A handler that does not await next() is reported below, with this error as the cause.
      result.catch(() => undefined);
      pending = result;
      return result;
    };

    let outcome: unknown;
    let failure: unknown;
    let failed = false;
    try {
      // The context and next() are typed by the middleware's own definition; checked at runtime here.
      outcome = await middleware.handle(context as MiddlewareContext<any, any>, next as Next);
    } catch (error: unknown) {
      failed = true;
      failure = error;
    }
    returned = true;

    if (called && !settled) {
      // Wait for the rest of the chain, so nothing downstream is still running once this returns.
      const downstreamError = await pending?.then(
        () => undefined,
        (error: unknown) => error,
      );
      if (!failed) {
        throw new MiddlewareError(
          name,
          'returned before next() had finished; return or await next().',
          downstreamError === undefined ? undefined : { cause: downstreamError },
        );
      }
    }
    if (misuse !== undefined) throw misuse;
    if (failed) throw failure;

    if (typeof outcome === 'number') {
      if (!Number.isInteger(outcome) || outcome < 0) {
        throw new MiddlewareError(name, `returned ${outcome}, which is not an exit code.`);
      }
      return outcome;
    }
    if (typeof outcome === 'object' && outcome !== null && results.has(outcome)) {
      return (outcome as ChainResult).exitCode;
    }
    if (!called) {
      throw new MiddlewareError(
        name,
        'neither called next() nor returned an exit code; return next() to continue or a number to stop.',
      );
    }
    throw new MiddlewareError(name, 'must return what next() returned, or an exit code.');
  };

  let exitCode = 0;
  let error: unknown;
  let failed = false;
  try {
    exitCode = await dispatch(0, Object.freeze({}), new Map());
  } catch (thrown: unknown) {
    failed = true;
    error = thrown;
  }
  finished = true;

  const failures: { readonly middleware: string; readonly error: unknown }[] = [];
  for (const { middleware, cleanup } of cleanups.reverse()) {
    try {
      await cleanup();
    } catch (thrown: unknown) {
      failures.push({ middleware, error: thrown });
    }
  }

  if (failures.length > 0) {
    // A failed or non-zero run keeps its own outcome; cleanup failures after a successful one fail the run.
    if (!failed && exitCode === 0) throw cleanupFailure(failures);
    for (const failure of failures) {
      base.logger.warn(`cleanup from middleware "${failure.middleware}" failed: ${messageOf(failure.error)}`);
    }
  }

  if (failed) throw error;
  return exitCode;
}

/** Adds the values passed to `next()` to those already provided. */
function merge(
  name: string,
  provided: Values,
  providers: Providers,
  provide: unknown,
  reserved: ReadonlySet<string>,
): { values: Values; providers: Providers } {
  if (provide === undefined) return { values: provided, providers };
  if (typeof provide !== 'object' || provide === null || Array.isArray(provide)) {
    throw new MiddlewareError(name, 'passed next() something other than an object of values.');
  }
  if (Object.getOwnPropertySymbols(provide).length > 0) {
    throw new MiddlewareError(name, 'passed next() symbol keys; only string keys can be provided.');
  }

  const values: Record<string, unknown> = { ...provided };
  const owners = new Map(providers);

  for (const [key, value] of Object.entries(provide)) {
    if (reserved.has(key)) {
      throw new MiddlewareError(name, `cannot provide "${key}": the command context already has it.`);
    }
    const owner = owners.get(key);
    if (owner !== undefined) {
      throw new MiddlewareError(name, `cannot provide "${key}": middleware "${owner}" already provides it.`);
    }
    // defineProperty, so a key such as "__proto__" is stored as a value rather than changing the prototype.
    Object.defineProperty(values, key, { value, enumerable: true, writable: true, configurable: true });
    owners.set(key, name);
  }

  return { values: Object.freeze(values), providers: owners };
}

function cleanupFailure(failures: readonly { readonly middleware: string; readonly error: unknown }[]): Error {
  const [only] = failures;
  if (failures.length === 1 && only !== undefined) {
    return new MiddlewareError(only.middleware, `cleanup failed: ${messageOf(only.error)}`, { cause: only.error });
  }

  const summary = failures.map((failure) => `middleware "${failure.middleware}": ${messageOf(failure.error)}`);
  return new AggregateError(
    failures.map((failure) => failure.error),
    `${failures.length} cleanups failed: ${summary.join('; ')}`,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
