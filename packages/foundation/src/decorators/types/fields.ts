import { z } from 'zod/v4';
import { TypeRegistryError } from './errors.js';
import type { ResolvedType, TypeShape } from './types.js';

type FieldName<T> = Extract<keyof TypeShape<T>, string>;

/** Selects decorated data fields by their declared names. */
export type FieldsOptions<T> =
  | { readonly pick: readonly FieldName<T>[]; readonly omit?: never }
  | { readonly omit: readonly FieldName<T>[]; readonly pick?: never };

// A variable-length array can be empty. A tuple guarantees only names fixed at a position.
type FixedNames<Keys extends readonly string[]> = number extends Keys['length'] ? never : {
  [Name in Keys[number]]: { [I in keyof Keys]: [Keys[I]] extends [Name] ? Name : never }[number];
}[Keys[number]];

type Selected<Model, Possible extends keyof Model, Fixed extends Possible> =
  Pick<Model, Fixed> & Partial<Pick<Model, Exclude<Possible, Fixed>>>;

// Decorators verify class field outputs. Inputs can differ (codecs) or be omitted (defaults).
type FieldObject<Values> = z.ZodObject<{
  [K in keyof Values]-?: z.ZodType<Values[K]> & {
    _zod: { optin: 'optional' } & (undefined extends Values[K] ? { optout: 'optional' } : {});
  };
}, z.core.$strict>;

/** A composable strict Zod object with the selected field outputs. */
export type FieldsSchema<T, Options extends FieldsOptions<T>> =
  Options extends { readonly pick: infer Keys extends readonly FieldName<T>[] }
    ? FieldObject<Selected<TypeShape<T>, Keys[number], FixedNames<Keys>>>
    : Options extends { readonly omit: infer Keys extends readonly FieldName<T>[] }
      ? FieldObject<Selected<TypeShape<T>, Exclude<FieldName<T>, FixedNames<Keys>>, Exclude<FieldName<T>, Keys[number]>>>
      : never;

/** Builds a strict request object from the selected fields of a resolved type. */
export function fields<T, const Options extends FieldsOptions<NoInfer<T>>>(
  model: ResolvedType<T>, options: Options,
): FieldsSchema<T, Options> {
  const { pick, omit } = options ?? {};
  const names = pick ?? omit;
  if (!Array.isArray(names) || (pick !== undefined && omit !== undefined)) {
    throw new TypeRegistryError(`Select fields of ${model.name} with exactly one pick or omit array.`, { typeName: model.name });
  }
  const requested = new Set<string>();
  for (const name of names) {
    if (typeof name !== 'string' || !model.fields.has(name)) {
      throw new TypeRegistryError(`Unknown field "${String(name)}" on ${model.name}.`, {
        typeName: model.name, field: String(name),
      });
    }
    requested.add(name);
  }
  const shape = Object.fromEntries(
    [...model.fields]
      .filter(([name]) => requested.has(name) === (pick !== undefined))
      .map(([name, field]) => [name, field.schema]),
  );
  return z.strictObject(shape) as FieldsSchema<T, Options>;
}
