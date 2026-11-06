import { describe, expectTypeOf, it } from 'vitest';
import {
  CliCommand,
  Command,
  defineMiddleware,
  type ChainResult,
  type CommandContext,
  type Provided,
  type RunnableCommand,
} from '../src/index.js';

// What defineMiddleware infers, and what @Command accepts. Every expected
// type error below fails the run if the rejection ever stops happening.

interface Client {
  readonly id: number;
}

const client = defineMiddleware({
  name: 'client',
  async handle(_ctx, next) {
    return next({ client: { id: 1 } as Client });
  },
});

const session = defineMiddleware({
  name: 'session',
  use: [client],
  handle: (ctx, next) => {
    expectTypeOf(ctx.client).toEqualTypeOf<Client>();
    return next({ user: 'someone' });
  },
});

const timing = defineMiddleware({
  name: 'timing',
  async handle(_ctx, next) {
    const result = await next();
    expectTypeOf(result).toEqualTypeOf<ChainResult<{}>>();
    expectTypeOf(result.exitCode).toEqualTypeOf<number>();
    return result;
  },
});

describe('defineMiddleware', () => {
  it('infers what a middleware provides from next()', () => {
    expectTypeOf<Provided<typeof client>>().toEqualTypeOf<{ client: Client }>();
    expectTypeOf<Provided<typeof timing>>().toEqualTypeOf<{}>();
  });

  it('includes what its dependencies provide', () => {
    expectTypeOf<Provided<typeof session>>().toEqualTypeOf<{ user: string; client: Client }>();
    expectTypeOf<Provided<[typeof timing, typeof session]>>().toEqualTypeOf<{ user: string; client: Client }>();
    expectTypeOf<Provided<[]>>().toEqualTypeOf<{}>();
  });

  it('provides nothing when it only stops the chain', () => {
    const gate = defineMiddleware({ name: 'gate', handle: () => 2 });
    expectTypeOf<Provided<typeof gate>>().toEqualTypeOf<{}>();
  });

  it('only claims values every path provides', () => {
    const sometimes = defineMiddleware({
      name: 'sometimes',
      handle: (ctx, next) => (ctx.argv.length > 0 ? next({ extra: 1 }) : next()),
    });
    expectTypeOf<Provided<typeof sometimes>>().toEqualTypeOf<{}>();
  });

  it('types the context its handler gets', () => {
    defineMiddleware({
      name: 'context',
      handle: (ctx, next) => {
        expectTypeOf(ctx.instance).toEqualTypeOf<object>();
        expectTypeOf(ctx.options).toEqualTypeOf<{}>();
        expectTypeOf(ctx.defer).parameter(0).toEqualTypeOf<() => unknown>();
        // @ts-expect-error nothing upstream provides it
        void ctx.client;
        return next();
      },
    });
  });

  it('rejects values under keys the context already has', () => {
    defineMiddleware({
      name: 'reserved',
      handle: (_ctx, next) =>
        // @ts-expect-error logger belongs to the command context
        next({ logger: 1 }),
    });

    defineMiddleware({
      name: 'not-an-object',
      handle: (_ctx, next) =>
        // @ts-expect-error next() takes an object of values
        next(5),
    });

    defineMiddleware({
      name: 'bad-return',
      // @ts-expect-error a handler returns next()'s result or an exit code
      handle: () => 'done',
    });
  });

  it('types its own flags', () => {
    defineMiddleware({
      name: 'flags',
      options: {
        endpoint: { type: 'string' },
        retries: { type: 'number', default: 3 },
        verbose: { type: 'boolean' },
        token: { type: 'string', required: true },
        mode: { type: 'choice', choices: ['fast', 'safe'], default: 'safe' },
        level: { type: 'choice', choices: ['low', 'high'] },
      },
      handle: (ctx, next) => {
        expectTypeOf(ctx.options.endpoint).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.options.retries).toEqualTypeOf<number>();
        expectTypeOf(ctx.options.verbose).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(ctx.options.token).toEqualTypeOf<string>();
        expectTypeOf(ctx.options.mode).toEqualTypeOf<'fast' | 'safe'>();
        expectTypeOf(ctx.options.level).toEqualTypeOf<'low' | 'high' | undefined>();
        // @ts-expect-error not one of its flags
        void ctx.options.other;
        return next();
      },
    });
  });

  it('rejects a choice default that is not one of the choices', () => {
    defineMiddleware({
      name: 'bad-default',
      options: {
        // @ts-expect-error 'slow' is not a choice
        mode: { type: 'choice', choices: ['fast', 'safe'], default: 'slow' },
      },
      handle: (_ctx, next) => next(),
    });
  });
});

describe('@Command use', () => {
  it('accepts a run() that reads what its use provides', () => {
    @Command({ use: [client] })
    class Reads implements RunnableCommand<object, Provided<typeof client>> {
      run({ client: value, logger }: CommandContext<object, Provided<typeof client>>): void {
        expectTypeOf(value).toEqualTypeOf<Client>();
        void logger;
      }
    }

    @Command({ use: [session] })
    class Transitive {
      run({ client: value, user }: CommandContext<object, Provided<typeof session>>): void {
        expectTypeOf(value).toEqualTypeOf<Client>();
        expectTypeOf(user).toEqualTypeOf<string>();
      }
    }

    @Command({ use: [client] })
    class Extends extends CliCommand<object, Provided<typeof client>> {
      run({ client: value }: CommandContext<object, Provided<typeof client>>): void {
        void value;
      }
    }

    void Reads;
    void Transitive;
    void Extends;
  });

  it('rejects a run() that reads what its use does not provide', () => {
    // @ts-expect-error nothing in use provides client
    @Command()
    class Missing {
      run(_context: CommandContext<object, Provided<typeof client>>): void {}
    }

    // @ts-expect-error timing provides nothing
    @Command({ use: [timing] })
    class Wrong {
      run(_context: CommandContext<object, Provided<typeof client>>): void {}
    }

    // @ts-expect-error nothing in use provides client
    @Command()
    class MissingBase extends CliCommand<object, Provided<typeof client>> {
      run(_context: CommandContext<object, Provided<typeof client>>): void {}
    }

    void Missing;
    void Wrong;
    void MissingBase;
  });

  it('keeps CommandContext usable without middleware', () => {
    class Plain implements RunnableCommand {
      run({ io }: CommandContext): void {
        void io;
      }
    }

    expectTypeOf<Plain>().toHaveProperty('run');
  });
});
