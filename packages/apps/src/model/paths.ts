import type { Constructor } from '@epsilon-asi/foundation';
import type { Fields } from './types.js';

// A data model declaring name and message can structurally match Error without its stack member.
type Leaf<Value> = string | number | boolean | bigint | symbol | Date | RegExp | Function
  | ('stack' extends keyof Value ? Error : never)
  | readonly unknown[] | ArrayBufferLike | ArrayBufferView | PromiseLike<unknown>
  | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown> | WeakMap<object, unknown> | WeakSet<object>;

// Index signatures have no required key, including template signatures such as `tag_${string}`.
type OpenIndex<Key> = Key extends string | number ? {} extends Record<Key, unknown> ? Key : never : never;
type Segment<Model> = Exclude<Extract<keyof Model, string>, '' | `${string}.${string}`>;

type FieldPaths<Model, Remaining extends unknown[]> = {
  [Key in Segment<Model>]: Key | `${Key}.${DataPaths<Model[Key], Remaining>}`;
}[Segment<Model>];

type DataPaths<Value, Depth extends unknown[]> = Depth extends [unknown, ...infer Remaining]
  ? 0 extends (1 & Value) ? never
    : Value extends Leaf<Value> ? never
    : Value extends object ? [OpenIndex<keyof Value>] extends [never] ? FieldPaths<Fields<Value>, Remaining> : never
    : never
  : never;

/** Declared resource field paths of up to three segments, before operation-specific access checks. */
export type Paths<C> = DataPaths<C extends Constructor<infer Instance> ? Instance : C, [1, 1, 1]>;
