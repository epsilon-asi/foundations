import { describe, expect, it } from 'vitest';
import {
  CliDefinitionError,
  Command,
  MiddlewareError,
  buildCli,
  defineMiddleware,
  describeCommand,
  runCli,
  type AnyMiddleware,
  type ChainResult,
  type Cleanup,
  type CommandContext,
  type Provided,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

/** A middleware that records when it runs, before and after the rest of the chain. */
function tracer(events: string[], name: string): AnyMiddleware {
  return defineMiddleware({
    name,
    async handle(_ctx, next) {
      events.push(`${name}:before`);
      const result = await next();
      events.push(`${name}:after`);
      return result;
    },
  });
}

const names = (chain: readonly AnyMiddleware[]): string[] => chain.map((middleware) => middleware.name);

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

describe('defineMiddleware', () => {
  it('returns a frozen definition that keeps its own copies', () => {
    const options = { endpoint: { type: 'string' as const, description: 'where' } };
    const middleware = defineMiddleware({ name: 'client', options, handle: (_ctx, next) => next() });

    expect(Object.isFrozen(middleware)).toBe(true);
    expect(Object.isFrozen(middleware.options)).toBe(true);
    expect(Object.isFrozen(middleware.options['endpoint'])).toBe(true);
    expect(Object.isFrozen(middleware.use)).toBe(true);

    options.endpoint.description = 'changed';
    expect(middleware.options['endpoint']?.description).toBe('where');
  });

  it('rejects a definition without a name or handler', () => {
    expect(() => defineMiddleware({ name: ' ', handle: () => 0 })).toThrow(MiddlewareError);
    expect(() => defineMiddleware({ name: 'x', handle: undefined as never })).toThrow(
      'middleware "x" needs a handle(ctx, next) function.',
    );
  });

  it('only accepts middleware made by defineMiddleware in use', () => {
    expect(() => defineMiddleware({ name: 'x', use: [{} as AnyMiddleware], handle: () => 0 })).toThrow(
      'middleware "x" has use[0], which is not a middleware made by defineMiddleware().',
    );
    expect(() => defineMiddleware({ name: 'x', use: 'nope' as never, handle: () => 0 })).toThrow(MiddlewareError);
  });

  it('checks the metadata of its options', () => {
    const define = (options: unknown) => () => defineMiddleware({ name: 'x', options: options as never, handle: () => 0 });

    expect(define([])).toThrow('has "options" that are not an object');
    expect(define({ a: 'string' })).toThrow('has option "a", which is not option metadata.');
    expect(define({ a: { type: 'list' } })).toThrow('of type "list"; it must be string, number, boolean or choice.');
    expect(define({ a: { type: 'choice' } })).toThrow('has choice option "a" without a "choices" array.');
    expect(define({ a: { type: 'string', short: 'ab' } })).toThrow('short flag "ab"; it must be a single letter or digit.');
    expect(define({ a: { type: 'string', flags: 'nope' } })).toThrow('has option "a" with unusable flags');
  });
});

describe('middleware order', () => {
  it('runs buildCli, root, ancestor and leaf middleware around run(), outermost first', async () => {
    const events: string[] = [];

    @Command({ use: [tracer(events, 'leaf')] })
    class Leaf {
      run(): void {
        events.push('run');
      }
    }

    @Command({ use: [tracer(events, 'group')], commands: [Leaf] })
    class Group {}

    @Command({ use: [tracer(events, 'root')], commands: [Group] })
    class Root {}

    const { io } = captureIO();
    await expect(runCli(Root, ['group', 'leaf'], { io, use: [tracer(events, 'global')] })).resolves.toBe(0);

    expect(events).toEqual([
      'global:before',
      'root:before',
      'group:before',
      'leaf:before',
      'run',
      'leaf:after',
      'group:after',
      'root:after',
      'global:after',
    ]);
  });

  it('places dependencies first and runs each middleware once', async () => {
    const events: string[] = [];
    const base = tracer(events, 'base');
    const dependent = defineMiddleware({
      name: 'dependent',
      use: [base],
      handle: (_ctx, next) => {
        events.push('dependent');
        return next();
      },
    });

    @Command({ use: [dependent, base] })
    class Leaf {
      run(): void {
        events.push('run');
      }
    }

    @Command({ use: [base], commands: [Leaf] })
    class Root {}

    const { io } = captureIO();
    const cli = buildCli(Root, { io });

    expect(names(cli.middleware())).toEqual(['base']);
    expect(names(cli.middleware(['leaf']))).toEqual(['base', 'dependent']);
    await expect(cli.run(['leaf'])).resolves.toBe(0);
    expect(events).toEqual(['base:before', 'dependent', 'run', 'base:after']);
  });

  it('pulls in a dependency that is listed nowhere else', () => {
    const base = tracer([], 'base');
    const dependent = defineMiddleware({ name: 'dependent', use: [base], handle: (_ctx, next) => next() });

    @Command({ use: [dependent] })
    class Root {
      run(): void {}
    }

    expect(names(buildCli(Root).middleware())).toEqual(['base', 'dependent']);
  });

  it('runs the command directly when nothing is used', async () => {
    let ran = false;

    @Command()
    class Root {
      run(): number {
        ran = true;
        return 4;
      }
    }

    const cli = buildCli(Root, { io: captureIO().io });
    expect(cli.middleware()).toEqual([]);
    await expect(cli.run([])).resolves.toBe(4);
    expect(ran).toBe(true);
  });
});

describe('middleware results', () => {
  it('stops the chain when an exit code is returned before next()', async () => {
    let ran = false;
    const gate = defineMiddleware({ name: 'gate', handle: () => 3 });

    @Command({ use: [gate] })
    class Root {
      run(): void {
        ran = true;
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(3);
    expect(ran).toBe(false);
  });

  it('passes the command exit code back up, and lets a middleware replace it', async () => {
    const seen: number[] = [];
    const outer = defineMiddleware({
      name: 'outer',
      async handle(_ctx, next) {
        const result = await next();
        seen.push(result.exitCode);
        return 6;
      },
    });
    const inner = defineMiddleware({ name: 'inner', handle: (_ctx, next) => next() });

    @Command({ use: [outer, inner] })
    class Root {
      run(): number {
        return 5;
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(6);
    expect(seen).toEqual([5]);
  });
});

describe('middleware context', () => {
  it('adds what each middleware provides to the context of everything after it', async () => {
    const alpha = defineMiddleware({ name: 'alpha', handle: (_ctx, next) => next({ alpha: 1 }) });
    const beta = defineMiddleware({
      name: 'beta',
      use: [alpha],
      handle: (ctx, next) => next({ beta: ctx.alpha + 1 }),
    });
    let seen: Record<string, unknown> = {};

    @Command({ use: [beta] })
    class Root {
      run(context: CommandContext<object, Provided<typeof beta>>): void {
        seen = { alpha: context.alpha, beta: context.beta, frozen: Object.isFrozen(context), keys: Object.keys(context) };
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(0);
    expect(seen).toMatchObject({ alpha: 1, beta: 2, frozen: true });
    expect(seen['keys']).not.toContain('instance');
    expect(seen['keys']).not.toContain('definition');
    expect(seen['keys']).not.toContain('options');
    expect(seen['keys']).not.toContain('defer');
  });

  it('gives middleware the command instance, its definition and a frozen context', async () => {
    let seen: Record<string, unknown> = {};
    const inspect = defineMiddleware({
      name: 'inspect',
      handle: (ctx, next) => {
        seen = {
          instance: ctx.instance,
          target: ctx.definition.target,
          options: ctx.options,
          frozen: Object.isFrozen(ctx),
          logger: typeof ctx.logger.info,
        };
        return next();
      },
    });

    @Command({ use: [inspect] })
    class Root {
      run(): void {}
    }

    await runCli(Root, [], { io: captureIO().io });
    expect(seen['instance']).toBeInstanceOf(Root);
    expect(seen).toMatchObject({ target: Root, options: {}, frozen: true, logger: 'function' });
  });

  it('stores a "__proto__" key as a value', async () => {
    const odd = defineMiddleware({
      name: 'odd',
      handle: (_ctx, next) => next(JSON.parse('{"__proto__": 1}') as object),
    });
    let value: unknown;

    @Command({ use: [odd] })
    class Root {
      run(context: CommandContext): void {
        value = Object.getOwnPropertyDescriptor(context, '__proto__')?.value;
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(0);
    expect(value).toBe(1);
  });
});

describe('middleware guards', () => {
  async function failure(middleware: AnyMiddleware, run: () => unknown = () => undefined): Promise<string> {
    @Command({ use: [middleware] })
    class Root {
      async run(): Promise<void> {
        await run();
      }
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    return stderr();
  }

  it('rejects calling next() twice', async () => {
    let runs = 0;
    const twice = defineMiddleware({
      name: 'twice',
      async handle(_ctx, next) {
        await next();
        return next();
      },
    });

    expect(await failure(twice, () => (runs += 1))).toBe('error: middleware "twice" called next() more than once.\n');
    expect(runs).toBe(1);
  });

  it('reports a second next() even when its promise is ignored', async () => {
    const ignored = defineMiddleware({
      name: 'ignored',
      async handle(_ctx, next) {
        const result = await next();
        void next();
        return result;
      },
    });

    expect(await failure(ignored)).toContain('middleware "ignored" called next() more than once.');
  });

  it('rejects a handler that does not wait for next(), after the command has finished', async () => {
    const events: string[] = [];
    const hasty = defineMiddleware({
      name: 'hasty',
      handle: (_ctx, next) => {
        void next();
        return 0;
      },
    });

    const message = await failure(hasty, async () => {
      await tick();
      events.push('run finished');
    });

    expect(message).toBe('error: middleware "hasty" returned before next() had finished; return or await next().\n');
    expect(events).toEqual(['run finished']);
  });

  it('rejects a handler that neither continues nor returns an exit code', async () => {
    const silent = defineMiddleware({ name: 'silent', handle: () => undefined as unknown as number });

    expect(await failure(silent)).toContain(
      'middleware "silent" neither called next() nor returned an exit code; return next() to continue or a number to stop.',
    );
  });

  it('rejects an exit code that is not a non-negative integer', async () => {
    expect(await failure(defineMiddleware({ name: 'negative', handle: () => -1 }))).toContain(
      'middleware "negative" returned -1, which is not an exit code.',
    );
    expect(await failure(defineMiddleware({ name: 'fraction', handle: () => 1.5 }))).toContain('returned 1.5');
  });

  it('rejects a result that next() did not produce', async () => {
    const forged = defineMiddleware({
      name: 'forged',
      async handle(_ctx, next) {
        await next();
        return { exitCode: 0 } as ChainResult;
      },
    });

    expect(await failure(forged)).toContain('middleware "forged" must return what next() returned, or an exit code.');
  });

  it('rejects two middleware providing the same key', async () => {
    const first = defineMiddleware({ name: 'first', handle: (_ctx, next) => next({ shared: 1 }) });
    const second = defineMiddleware({ name: 'second', use: [first], handle: (_ctx, next) => next({ shared: 2 }) });

    expect(await failure(second)).toContain(
      'middleware "second" cannot provide "shared": middleware "first" already provides it.',
    );
  });

  it('rejects providing a key the command context already has', async () => {
    const shadow = defineMiddleware({ name: 'shadow', handle: (_ctx, next) => next({ logger: 1 } as object) });
    const options = defineMiddleware({ name: 'options', handle: (_ctx, next) => next({ options: 1 } as object) });

    expect(await failure(shadow)).toContain('middleware "shadow" cannot provide "logger": the command context already has it.');
    expect(await failure(options)).toContain('cannot provide "options"');
  });

  it('rejects next() values that are not an object with string keys', async () => {
    const number = defineMiddleware({ name: 'number', handle: (_ctx, next) => next(5 as unknown as object) });
    const symbol = defineMiddleware({ name: 'symbol', handle: (_ctx, next) => next({ [Symbol('s')]: 1 }) });

    expect(await failure(number)).toContain('middleware "number" passed next() something other than an object of values.');
    expect(await failure(symbol)).toContain('middleware "symbol" passed next() symbol keys');
  });

  it('rejects next() after the handler has returned', async () => {
    let late: (() => Promise<unknown>) | undefined;
    const keeper = defineMiddleware({
      name: 'keeper',
      handle: (_ctx, next) => {
        late = () => next();
        return 0;
      },
    });

    @Command({ use: [keeper] })
    class Root {
      run(): void {}
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(0);
    await expect(late?.()).rejects.toThrow('middleware "keeper" called next() after its handler had returned.');
  });
});

describe('middleware errors', () => {
  it('passes errors through unchanged to the CLI', async () => {
    const thrower = defineMiddleware({
      name: 'thrower',
      handle: () => {
        throw new Error('boom');
      },
    });

    @Command({ use: [thrower] })
    class Root {
      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    expect(stderr()).toBe('error: boom\n');
  });

  it('lets an outer middleware catch what the command throws', async () => {
    class NotFound extends Error {}
    let caught: unknown;
    const boundary = defineMiddleware({
      name: 'boundary',
      async handle(_ctx, next) {
        try {
          return await next();
        } catch (error: unknown) {
          caught = error;
          return 7;
        }
      },
    });

    @Command({ use: [boundary] })
    class Root {
      run(): void {
        throw new NotFound('missing');
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(7);
    expect(caught).toBeInstanceOf(NotFound);
  });
});

describe('ctx.defer', () => {
  function cleaning(events: string[], name: string, cleanup?: Cleanup): AnyMiddleware {
    return defineMiddleware({
      name,
      handle: (ctx, next) => {
        ctx.defer(cleanup ?? (() => void events.push(`cleanup:${name}`)));
        return next();
      },
    });
  }

  it('runs cleanups after the chain, last registered first', async () => {
    const events: string[] = [];
    const outer = cleaning(events, 'outer');
    const inner = cleaning(events, 'inner');

    @Command({ use: [tracer(events, 'trace'), outer, inner] })
    class Root {
      run(): void {
        events.push('run');
      }
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(0);
    expect(events).toEqual(['trace:before', 'run', 'trace:after', 'cleanup:inner', 'cleanup:outer']);
  });

  it('runs cleanups when the command throws, and keeps its error', async () => {
    const events: string[] = [];

    @Command({ use: [cleaning(events, 'one')] })
    class Root {
      run(): void {
        throw new Error('boom');
      }
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    expect(events).toEqual(['cleanup:one']);
    expect(stderr()).toBe('error: boom\n');
  });

  it('fails a successful run whose cleanup fails', async () => {
    const failing = cleaning([], 'pool', () => {
      throw new Error('close failed');
    });

    @Command({ use: [failing] })
    class Root {
      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    expect(stderr()).toBe('error: middleware "pool" cleanup failed: close failed\n');
  });

  it('reports every failed cleanup, and still runs the others', async () => {
    const events: string[] = [];
    const fail = (name: string) =>
      cleaning(events, name, () => {
        throw new Error(`${name} failed`);
      });

    @Command({ use: [fail('a'), cleaning(events, 'ok'), fail('b')] })
    class Root {
      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    expect(events).toEqual(['cleanup:ok']);
    expect(stderr()).toBe('error: 2 cleanups failed: middleware "b": b failed; middleware "a": a failed\n');
  });

  it('only warns about a failed cleanup when the run already failed or exited non-zero', async () => {
    const failing = cleaning([], 'pool', () => {
      throw new Error('close failed');
    });

    @Command({ use: [failing] })
    class Throws {
      run(): void {
        throw new Error('boom');
      }
    }

    @Command({ use: [failing] })
    class Exits {
      run(): number {
        return 3;
      }
    }

    const thrown = captureIO();
    await expect(runCli(Throws, [], { io: thrown.io })).resolves.toBe(1);
    expect(thrown.stderr()).toBe('[warn] cleanup from middleware "pool" failed: close failed\nerror: boom\n');

    const exited = captureIO();
    await expect(runCli(Exits, [], { io: exited.io })).resolves.toBe(3);
    expect(exited.stderr()).toBe('[warn] cleanup from middleware "pool" failed: close failed\n');
  });

  it('rejects a cleanup that is not a function, and defer() after the run', async () => {
    let defer: ((cleanup: Cleanup) => void) | undefined;
    const keeper = defineMiddleware({
      name: 'keeper',
      handle: (ctx, next) => {
        defer = ctx.defer;
        return next();
      },
    });
    const bad = defineMiddleware({
      name: 'bad',
      handle: (ctx, next) => {
        ctx.defer('nope' as never);
        return next();
      },
    });

    @Command({ use: [keeper] })
    class Root {
      run(): void {}
    }

    @Command({ use: [bad] })
    class Bad {
      run(): void {}
    }

    await expect(runCli(Root, [], { io: captureIO().io })).resolves.toBe(0);
    expect(() => defer?.(() => undefined)).toThrow('middleware "keeper" called defer() after the command had finished.');

    const { io, stderr } = captureIO();
    await expect(runCli(Bad, [], { io })).resolves.toBe(1);
    expect(stderr()).toContain('middleware "bad" passed defer() something that is not a function.');
  });
});

describe('describing and building', () => {
  it('records each command’s own use on its definition', () => {
    const one = tracer([], 'one');

    @Command({ use: [one] })
    class Leaf {
      run(): void {}
    }

    @Command({ commands: [Leaf] })
    class Root {}

    const definition = describeCommand(Root);
    expect(definition.use).toEqual([]);
    expect(definition.commands[0]?.use).toEqual([one]);
  });

  it('rejects use entries that are not middleware', () => {
    @Command({ use: [{} as AnyMiddleware] })
    class Root {
      run(): void {}
    }

    @Command()
    class Plain {
      run(): void {}
    }

    expect(() => describeCommand(Root)).toThrow(CliDefinitionError);
    expect(() => describeCommand(Root)).toThrow(
      'Root: has use[0], which is not a middleware made by defineMiddleware().',
    );
    expect(() => buildCli(Plain, { use: [{} as AnyMiddleware] })).toThrow(
      'Plain: buildCli option "use" has item 0, which is not a middleware made by defineMiddleware().',
    );
  });

  it('finds the chain of a command by name or alias, and rejects unknown paths', () => {
    @Command({ aliases: ['l'], use: [tracer([], 'leaf')] })
    class Leaf {
      run(): void {}
    }

    @Command({ name: 'root', commands: [Leaf] })
    class Root {}

    const cli = buildCli(Root);
    expect(names(cli.middleware(['l']))).toEqual(['leaf']);
    expect(() => cli.middleware(['leaf', 'nope'])).toThrow('No command "leaf nope" under root.');
  });
});
