import type {
  BaseCommandContext,
  CommandContext,
  CommandDefinition,
  OptionMetadata,
  OptionValue,
} from '../types.js';

/** Type-only markers. They are never set at runtime. */
declare const providesMarker: unique symbol;
declare const resultMarker: unique symbol;

/**
 * Flags a middleware owns, keyed by the name its handler reads them under in
 * `ctx.options`. Each entry is the same metadata `@Option` takes, with `type`
 * spelled out: `{ type: 'string', short: 'e', env: 'APP_ENDPOINT' }`.
 */
export type MiddlewareOptionsSpec = Readonly<Record<string, OptionMetadata>>;

type OptionBaseValue<TMetadata> = TMetadata extends { type: 'string' }
  ? string
  : TMetadata extends { type: 'number' }
    ? number
    : TMetadata extends { type: 'boolean' }
      ? boolean
      : TMetadata extends { type: 'choice'; choices: readonly (infer TChoice extends string)[] }
        ? TChoice
        : never;

/** The parsed values of a middleware's flags: `T` with a default or `required: true`, otherwise `T | undefined`. */
export type MiddlewareOptionValues<TOptions> = {
  readonly [K in keyof TOptions]: OptionValue<OptionBaseValue<TOptions[K]>, TOptions[K]>;
};

/** Rejects a choice option whose default is not one of its choices. */
export type CheckedMiddlewareOptions<TOptions> = {
  readonly [K in keyof TOptions]: TOptions[K] extends { type: 'choice'; choices: infer TChoices extends readonly string[] }
    ? { readonly default?: TChoices[number] }
    : unknown;
};

/** Context keys the system owns. Middleware can never provide a value under one of them. */
export type ReservedContextKey = keyof BaseCommandContext | 'instance' | 'definition' | 'options' | 'defer';

/** A cleanup registered with `ctx.defer()`. */
export type Cleanup = () => unknown;

/**
 * What a middleware handler receives: the command context, everything provided
 * by the middleware before it, and its own `options`.
 */
export type MiddlewareContext<
  TIn extends object = {},
  TOptions extends MiddlewareOptionsSpec = {},
> = CommandContext<object, TIn> & {
  /** The populated command instance that is about to run. */
  readonly instance: object;
  /** The definition of the command that is about to run. */
  readonly definition: CommandDefinition;
  /** This middleware's own flags, parsed. Not passed on to anything downstream. */
  readonly options: MiddlewareOptionValues<TOptions>;
  /**
   * Registers a cleanup that runs after the whole chain and the command have
   * finished, even when they threw. Cleanups run last registered first.
   */
  readonly defer: (cleanup: Cleanup) => void;
};

/** What `next()` resolves to: the outcome of the rest of the chain. */
export interface ChainResult<TProvided extends object = {}> {
  /** The exit code the rest of the chain produced. */
  readonly exitCode: number;
  /** Type-only: the values passed to the `next()` call that produced this result. */
  readonly [resultMarker]?: TProvided;
}

/** Rejects values under a key the system owns. */
export type NoReservedKeys<T> = { readonly [K in keyof T & ReservedContextKey]: never };

/**
 * Runs the rest of the chain, then the command. The values passed to it are
 * added to the context of everything downstream. Call it at most once and
 * return or await what it returns.
 */
export type Next = <TProvided extends object = {}>(
  provide?: TProvided & NoReservedKeys<TProvided>,
) => Promise<ChainResult<TProvided>>;

/** A handler returns what `next()` gave it, or an exit code. Returning a number before calling `next()` stops the chain. */
export type MiddlewareReturn<TProvided extends object = {}> = ChainResult<TProvided> | number;

export type MiddlewareHandler<
  TIn extends object = {},
  TOptions extends MiddlewareOptionsSpec = {},
  TProvided extends object = {},
> = (
  ctx: MiddlewareContext<TIn, TOptions>,
  next: Next,
) => MiddlewareReturn<TProvided> | Promise<MiddlewareReturn<TProvided>>;

/** A middleware made by `defineMiddleware()`. Frozen; define it once at module level and reuse it. */
export interface Middleware<TProvides extends object = {}> {
  readonly name: string;
  /** Middleware this one depends on. They run before it. */
  readonly use: readonly AnyMiddleware[];
  /** The flags this middleware owns. */
  readonly options: MiddlewareOptionsSpec;
  readonly handle: MiddlewareHandler<any, any, any>;
  /** Type-only: what this middleware and its dependencies provide. */
  readonly [providesMarker]?: TProvides;
}

export type AnyMiddleware = Middleware<any>;

export interface MiddlewareSpec<
  TUse extends readonly AnyMiddleware[],
  TOptions extends MiddlewareOptionsSpec,
  TProvided extends object,
> {
  /** Used in error messages and by `Cli.middleware()`. */
  readonly name: string;
  /** Middleware that must run before this one. Their values are typed on `ctx`. */
  readonly use?: TUse;
  /** Flags this middleware owns. They are added to the command where it first appears in the chain. */
  readonly options?: TOptions & CheckedMiddlewareOptions<TOptions>;
  readonly handle: MiddlewareHandler<ProvidedBy<TUse>, TOptions, TProvided>;
}

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer I) => void
  ? I
  : never;

type Simplify<T> = { [K in keyof T]: T[K] };

/** What one middleware provides, including its dependencies. */
export type ProvidesOf<TMiddleware> = TMiddleware extends Middleware<infer TProvides> ? TProvides : never;

/** What a list of middleware provides together. */
export type ProvidedBy<TList extends readonly AnyMiddleware[]> = Simplify<
  UnionToIntersection<ProvidesOf<TList[number]>>
>;

/**
 * The values a middleware, or a list of them, adds to the command context.
 * Use it as the second parameter of `CommandContext`:
 * `CommandContext<App, Provided<typeof client>>` or
 * `CommandContext<App, Provided<[typeof client, typeof session]>>`.
 */
export type Provided<T extends AnyMiddleware | readonly AnyMiddleware[]> = T extends readonly AnyMiddleware[]
  ? ProvidedBy<T>
  : Simplify<ProvidesOf<T>>;
