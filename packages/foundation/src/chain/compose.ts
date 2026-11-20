import { MiddlewareError } from './errors.js';
import type { ChainBindingOptions, ChainCleanup, ChainStep, RunChainOptions } from './types.js';

type Values = Readonly<Record<string, unknown>>;
type Providers = ReadonlyMap<string, string>;

/** Executes an already validated chain. All execution state belongs to this invocation. */
export async function runChain<Step extends ChainStep, Base extends object, Value, Result extends object>(
  policy: ChainBindingOptions<Value, Result>,
  { chain, base, run, contextFor, warn }: RunChainOptions<Step, Base, Value>,
  reservedKeys: ReadonlySet<string>,
): Promise<Value> {
  const reserved = new Set([...Object.keys(base), ...reservedKeys]);
  const results = new WeakMap<object, Value>();
  const cleanups: { readonly middleware: string; readonly cleanup: ChainCleanup }[] = [];
  let finished = false;

  const deferFor = (name: string) => (cleanup: ChainCleanup): void => {
    if (typeof cleanup !== 'function') throw new MiddlewareError(name, 'passed defer() something that is not a function.');
    if (finished) throw new MiddlewareError(name, `called defer() after the ${policy.subject} had finished.`);
    cleanups.push({ middleware: name, cleanup });
  };

  const dispatch = async (index: number, provided: Values, providers: Providers): Promise<Value> => {
    const middleware = chain[index];
    if (middleware === undefined) {
      return run(contextWith(base, provided), deferFor(policy.subject));
    }

    const { name } = middleware;
    const context = contextWith(base, provided, contextFor?.(middleware), { defer: deferFor(name) });

    let called = false;
    let settled = false;
    let returned = false;
    let misuse: MiddlewareError | undefined;
    let pending: Promise<unknown> | undefined;

    const next = (provide?: unknown): Promise<Result> => {
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

      const result = (async (): Promise<Result> => {
        try {
          const merged = merge(name, provided, providers, provide, reserved, policy.subject);
          const value = await dispatch(index + 1, merged.values, merged.providers);
          const outcome = Object.freeze(policy.wrap(value));
          results.set(outcome, value);
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
      outcome = await middleware.handle(context as never, next as never);
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

    if (typeof outcome === 'object' && outcome !== null && results.has(outcome)) {
      return results.get(outcome) as Value;
    }
    if (policy.isStop(outcome, name)) return outcome;
    throw new MiddlewareError(name, policy.invalidReturn?.(called) ?? 'must return the result of next() or a stop value.');
  };

  let value!: Value;
  let error: unknown;
  let failed = false;
  try {
    value = await dispatch(0, Object.freeze({}), new Map());
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
    if (!failed && policy.successful(value)) throw cleanupFailure(failures);
    for (const failure of failures) {
      warn?.(`cleanup from middleware "${failure.middleware}" failed: ${messageOf(failure.error)}`);
    }
  }

  if (failed) throw error;
  return value;
}

/** Copy enumerable values, including symbols and own "__proto__" data, without invoking inherited setters. */
function contextWith<Base extends object>(base: Base, ...parts: (object | undefined)[]): Readonly<Base> & Values {
  const copy = Object.assign(Object.create(null), base, ...parts) as Base & Values;
  Object.setPrototypeOf(copy, Object.prototype);
  return Object.freeze(copy);
}

/** Adds the values passed to `next()` to those already provided. */
function merge(
  name: string,
  provided: Values,
  providers: Providers,
  provide: unknown,
  reserved: ReadonlySet<string>,
  subject: string,
): { values: Values; providers: Providers } {
  if (provide === undefined) return { values: provided, providers };
  if (typeof provide !== 'object' || provide === null || Array.isArray(provide)) {
    throw new MiddlewareError(name, 'passed next() something other than an object of values.');
  }
  if (Object.getOwnPropertySymbols(provide).length > 0) {
    throw new MiddlewareError(name, 'passed next() symbol keys; only string keys can be provided.');
  }

  const values: Record<string, unknown> = Object.assign(Object.create(null), provided);
  const owners = new Map(providers);

  for (const [key, value] of Object.entries(provide)) {
    if (reserved.has(key)) {
      throw new MiddlewareError(name, `cannot provide "${key}": the ${subject} context already has it.`);
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
