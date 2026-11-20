import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import type { ArrayOperator, BooleanOperator, EnumOperator, FILTER_OPERATORS, FilterOperator, RangeOperator, TextOperator } from './filterOperators.js';
import { resolveFilterOperators, type FilterFieldKind, type ResolveFilterOperatorsOptions } from './resolveFilterOperators.js';

type StringChoice = z.ZodEnum<Readonly<Record<string, string>>> | z.core.$ZodLiteral<string> | StringChoiceUnion;

// Chained .or() calls nest unions. Only their options need recursive inspection.
interface StringChoiceUnion extends z.core.$ZodUnion {
  _zod: z.core.$ZodUnion['_zod'] & { def: z.core.$ZodUnionDef<readonly StringChoice[]> };
}

interface SchemaByKind {
  text: z.core.$ZodString;
  enum: StringChoice;
  boolean: z.core.$ZodBoolean;
  range: z.core.$ZodNumber | z.core.$ZodBigInt | z.core.$ZodDate;
  array: z.core.$ZodArray;
}

type SchemaKind = keyof SchemaByKind;
type NullableOperator = (typeof FILTER_OPERATORS.nullable)[number];

// Constrain the inner schema without recursively instantiating Zod's input and output types.
interface NullableSchema<Kind extends SchemaKind> extends z.core.$ZodNullable {
  _zod: z.core.$ZodNullable['_zod'] & { def: z.core.$ZodNullableDef<SchemaByKind[Kind] | NullableSchema<Kind>> };
}

type FieldFilterOptions<Kind extends SchemaKind, Operator> =
  | { schema: SchemaByKind[Kind] | NullableSchema<Kind>; cap: true | readonly Operator[] }
  | { schema: NullableSchema<Kind>; cap: true | readonly (Operator | NullableOperator)[] };

/** A field schema and its list.filter entry. A union of field schemas accepts their shared operators. */
export type ResolveFieldFilterOptions =
  | FieldFilterOptions<'array', ArrayOperator>
  | FieldFilterOptions<'text', TextOperator>
  | FieldFilterOptions<'range', RangeOperator>
  | FieldFilterOptions<'text' | 'enum' | 'range', EnumOperator>
  | FieldFilterOptions<Exclude<SchemaKind, 'array'>, BooleanOperator>
  // A scalar and a nullable array share equality.
  | {
    schema: SchemaByKind[Exclude<SchemaKind, 'array'>] | NullableSchema<SchemaKind>;
    cap: true | readonly Extract<BooleanOperator, NullableOperator>[];
  }
  // Every field supports `true` and an empty list.
  | FieldFilterOptions<SchemaKind, never>;

// Exclude the recurring wrapper when the caller supplies a widened NullableSchema.
type BaseSchema<Schema> = Schema extends z.core.$ZodNullable
  ? BaseSchema<Exclude<Schema['_zod']['def']['innerType'], Schema>>
  : Schema;

type SelectedOperators<Schema, Kind extends SchemaKind, Cap> = readonly (Cap extends readonly (infer Operator)[]
  ? Operator
  : (typeof FILTER_OPERATORS)[Kind][number] | (Schema extends z.core.$ZodNullable ? NullableOperator : never))[];

type ResolvedSchemaFilter<Schema, Cap, Base = BaseSchema<Schema>> = {
  [Kind in SchemaKind]: Base extends SchemaByKind[Kind]
    ? { kind: Kind; operators: SelectedOperators<Schema, Kind, Cap> }
    : never;
}[SchemaKind];

/** The inferred field kind and the operator literals enabled by its declaration. */
export type ResolvedFieldFilter<Options extends ResolveFieldFilterOptions> =
  Options extends { schema: infer Schema; cap: infer Cap }
    ? Schema extends unknown ? ResolvedSchemaFilter<Schema, Cap> : never
    : never;

function isStringChoice(schema: z.core.$ZodType): boolean {
  if (schema instanceof z.ZodEnum) return schema.options.every(value => typeof value === 'string');
  if (schema instanceof z.core.$ZodLiteral) return schema._zod.def.values.every(value => typeof value === 'string');
  return schema instanceof z.core.$ZodUnion && schema._zod.def.options.every(isStringChoice);
}

function filterKind(schema: z.core.$ZodType): SchemaKind {
  if (schema instanceof z.core.$ZodArray) return 'array';
  if (schema instanceof z.core.$ZodString) return 'text';
  if (schema instanceof z.core.$ZodBoolean) return 'boolean';
  if (schema instanceof z.core.$ZodNumber || schema instanceof z.core.$ZodBigInt || schema instanceof z.core.$ZodDate) {
    return 'range';
  }
  if (isStringChoice(schema)) return 'enum';
  throw new ApiDefinitionError('Expected a string, string enum or string literal union, boolean, number, bigint, Date, or array schema for the filter declaration.');
}

/** Checks a resolved schema and its operator list after the registry's wrappers have been inspected. */
export function resolveBaseFieldFilter({ schema, cap, nullable, primaryKey }: {
  schema: z.core.$ZodType; cap: true | readonly FilterOperator[]; nullable: boolean; primaryKey?: boolean;
}): { kind: FilterFieldKind; operators: readonly FilterOperator[] } {
  const baseKind = filterKind(schema);
  const kind = primaryKey ? 'id' : baseKind;
  // Runtime model metadata erases the static pairing. The resolver checks it against the operator table.
  return { kind, operators: resolveFilterOperators({ kind, nullable, cap } as ResolveFilterOperatorsOptions) };
}

/** Infers the filter group from the Zod schema and validates the declared operators. */
export function resolveFieldFilter<const Options extends ResolveFieldFilterOptions>(options: Options): ResolvedFieldFilter<Options>;
export function resolveFieldFilter({ schema, cap }: ResolveFieldFilterOptions) {
  let nullable = false;
  while (schema instanceof z.core.$ZodNullable) {
    nullable = true;
    schema = schema._zod.def.innerType;
  }
  return resolveBaseFieldFilter({ schema, cap, nullable });
}
