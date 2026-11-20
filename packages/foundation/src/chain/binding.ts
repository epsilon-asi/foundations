import { MiddlewareError } from './errors.js';
import { runChain } from './compose.js';
import type { ChainBindingOptions, ChainStep, RunChainOptions } from './types.js';

type Definition<Step extends ChainStep> = Omit<Step, 'use'> & { readonly use?: readonly Step[] | undefined };

export interface ChainBinding<Step extends ChainStep, Value> {
  /** Freezes a step and records its identity in this binding. */
  define(definition: Definition<Step>): Step;
  isMiddleware(value: unknown): value is Step;
  /** Orders dependencies first, removes repeated identities and checks declared provided keys. */
  resolve(steps: readonly Step[]): readonly Step[];
  /** Executes a resolved chain with fresh per-call context and cleanup state. */
  run<Base extends object>(input: RunChainOptions<Step, Base, Value>): Promise<Value>;
}

/** Creates the independent middleware identities, ordering rules and execution policy of one binding. */
export function createChainBinding<Step extends ChainStep, Value, Result extends object>(
  options: ChainBindingOptions<Value, Result>,
): ChainBinding<Step, Value> {
  const defined = new WeakSet<object>();
  const resolved = new WeakSet<readonly Step[]>();
  const reserved = new Set(['defer', ...options.reservedKeys ?? []]);

  function isMiddleware(value: unknown): value is Step {
    return typeof value === 'object' && value !== null && defined.has(value);
  }

  function define(definition: Definition<Step>): Step {
    const { name, use = [], provides } = definition;
    if (typeof name !== 'string' || name.trim() === '') {
      throw new MiddlewareError(String(name), 'needs a non-empty name.');
    }
    if (typeof definition.handle !== 'function') {
      throw new MiddlewareError(name, 'needs a handle(ctx, next) function.');
    }
    if (!Array.isArray(use)) throw new MiddlewareError(name, 'has a "use" that is not an array of middleware.');
    use.forEach((entry, index) => {
      if (!isMiddleware(entry)) {
        throw new MiddlewareError(name, `has use[${index}], which is not a middleware made by defineMiddleware().`);
      }
    });
    if (provides !== undefined && (!Array.isArray(provides) || provides.some(key => typeof key !== 'string' || !key.length))) {
      throw new MiddlewareError(name, 'must declare provides as an array of context key names.');
    }
    const step = Object.freeze({
      ...definition, use: Object.freeze([...use]),
      ...(provides === undefined ? {} : { provides: Object.freeze([...provides]) }),
    }) as Step;
    defined.add(step);
    return step;
  }

  function resolve(steps: readonly Step[]): readonly Step[] {
    const ordered = new Set<Step>();
    const providers = new Map<string, string>();
    const add = (step: ChainStep): void => {
      if (!isMiddleware(step)) throw new MiddlewareError(step?.name, 'belongs to a different middleware binding.');
      if (ordered.has(step)) return;
      // Dependencies already exist and each step is frozen before its identity escapes.
      for (const dependency of step.use ?? []) add(dependency);
      for (const key of step.provides ?? []) {
        if (reserved.has(key)) throw new MiddlewareError(step.name, `cannot provide "${key}": the ${options.subject} context already has it.`);
        const owner = providers.get(key);
        if (owner !== undefined) throw new MiddlewareError(step.name, `cannot provide "${key}": middleware "${owner}" already provides it.`);
        providers.set(key, step.name);
      }
      ordered.add(step);
    };
    steps.forEach(add);
    const chain = Object.freeze([...ordered]);
    resolved.add(chain);
    return chain;
  }

  return {
    define, isMiddleware, resolve,
    async run(input) {
      if (!resolved.has(input.chain)) throw new TypeError('Resolve the middleware with this binding before running its chain.');
      return runChain(options, input, reserved);
    },
  };
}
