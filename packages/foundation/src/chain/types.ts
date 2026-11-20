/** A binding adds its own options, context and handle signature to this definition. */
export interface ChainStep {
  readonly name: string;
  readonly use?: readonly ChainStep[];
  readonly provides?: readonly string[];
  readonly handle: (context: never, next: never) => unknown;
}

export type ChainCleanup = () => unknown;

declare const providesMarker: unique symbol;
declare const resultMarker: unique symbol;

/** Type-only contribution of a middleware and its dependencies. */
export interface ChainProvides<Values extends object> {
  readonly [providesMarker]?: Values;
}

export type ChainProvidesOf<Step> = Step extends ChainProvides<infer Values> ? Values : never;
type Intersection<T> = (T extends unknown ? (item: T) => void : never) extends (item: infer U) => void ? U : never;
type Simplify<T> = { [K in keyof T]: T[K] };

export type ChainProvidedBy<Steps extends readonly ChainProvides<object>[]> =
  Simplify<Intersection<ChainProvidesOf<Steps[number]>>>;

/** Carries the provided values through the type of a handler's return value. */
export interface ChainContribution<Values extends object> {
  readonly [resultMarker]?: Values;
}

export type ChainNext<Result extends object, Reserved extends PropertyKey = never> = <Values extends object = {}>(
  values?: Values & { readonly [K in keyof Values & Reserved]: never },
) => Promise<Result & ChainContribution<Values>>;

export interface ChainBindingOptions<Value, Result extends object> {
  /** Used in diagnostics, e.g. "command" or "request". */
  readonly subject: string;
  /** Context keys owned by the binding in addition to base context keys and defer. */
  readonly reservedKeys?: readonly string[];
  /** Wraps the downstream value returned by next(). */
  readonly wrap: (value: Value) => Result;
  /** A stop value ends the chain. May throw for malformed stop values. */
  readonly isStop: (value: unknown, name: string) => value is Value;
  /** A cleanup error takes precedence only after a successful outcome. */
  readonly successful: (value: Value) => boolean;
  /** Binding-specific guidance when a handler returns neither a stop value nor the result of next(). */
  readonly invalidReturn?: (called: boolean) => string;
}

export interface RunChainOptions<Step, Base extends object, Value> {
  readonly chain: readonly Step[];
  readonly base: Base;
  /** Context visible only to this step, e.g. its parsed command flags. */
  readonly contextFor?: (step: Step) => object;
  /** Called with the final frozen context and the chain's cleanup registrar. */
  readonly run: (context: Readonly<Base> & Readonly<Record<string, unknown>>, defer: (cleanup: ChainCleanup) => void) => Value | Promise<Value>;
  readonly warn?: (message: string) => void;
}
