import type { Constructor } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import type { ReadModel } from '../model/types.js';
import { booleanWireCodec } from '../wire/boolean.js';
import { arrayOperand, ownArrayValues } from './arrayOperand.js';
import { equalityOperand } from './equalityOperand.js';
import { FILTER_OPERATORS, FilterOperator } from './filterOperators.js';
import { reservedQueryFields, type OptionalQueryFields, type QueryFieldName } from './queryFieldNames.js';
import type { OperatorsByKind } from './resolveFilterOperators.js';
import type { FilterDescriptor, FilterValue, ResolvedFilters, ResolveFiltersOptions } from './resolveFilters.js';

type Scalar = string | number | boolean | bigint | Date | null;
const scalarComparisons = [
  FilterOperator.Eq, FilterOperator.Ne, FilterOperator.Like, FilterOperator.ILike,
  FilterOperator.Gt, FilterOperator.Gte, FilterOperator.Lt, FilterOperator.Lte,
] as const;
type ScalarComparison = (typeof scalarComparisons)[number];
type ArrayComparison = (typeof FILTER_OPERATORS.array)[number];
const patternOperand = z.string();
const nullOperand = z.null();
function isPattern(operator: ScalarComparison) {
  return operator === FilterOperator.Like || operator === FilterOperator.ILike;
}
type ComparedValue<Model, Path, Value = FilterValue<Model, Path>> = unknown extends Value ? Scalar : Value;
type NullableComparisons<Kind> = Kind extends 'array' ? (typeof FILTER_OPERATORS.nullable)[number] : '$exists';
type DeclaredComparisons<Descriptor, Value> = Descriptor extends FilterDescriptor
  ? Extract<Descriptor['operators'][number],
    ([Value] extends [Scalar] ? ScalarComparison & OperatorsByKind[Descriptor['kind']] : never) |
    (Descriptor['kind'] extends 'array' ? ArrayComparison : never) |
    (null extends Value ? NullableComparisons<Descriptor['kind']> : never)> : never;
type EqualityValue<Value, Descriptor> = NonNullable<Descriptor> extends { kind: 'array' } ? null : Extract<Value, Scalar>;
type ArrayItems<Model, Path> = Model extends { target: Constructor<infer Instance> } ? Path extends keyof ReadModel<Instance>
  ? NonNullable<ReadModel<Instance>[Path]> extends readonly (infer Item)[] ? Item[] : unknown[] : unknown[] : unknown[];
type Operand<Value, Operator, Descriptor, Model, Path> = Operator extends ArrayComparison ? ArrayItems<Model, Path> :
  Operator extends '$exists' ? boolean : Operator extends '$like' | '$ilike' ? string :
  Operator extends '$eq' ? EqualityValue<Value, Descriptor> : Operator extends '$ne' ? Exclude<Value, null> : Extract<Value, number | bigint | Date>;
type ComparisonFields<Model, Declaration, Filters = ResolvedFilters<Model, Declaration>> = {
  [Path in QueryFieldName<keyof Filters> as [DeclaredComparisons<Filters[Path], ComparedValue<Model, Path>>] extends [never] ? never : Path]: {
    [Op in DeclaredComparisons<Filters[Path], ComparedValue<Model, Path>>]: Operand<ComparedValue<Model, Path>, Op, Filters[Path], Model, Path>;
  };
};
type WireValue<Value> = unknown extends Value ? unknown : Value extends string | null | undefined ? Value :
  Value extends number | bigint | boolean | Date ? string :
  Value extends object ? QueryWireFields<Value> : never;
/** The bracket-wire shape of a structured comparison, including recursive readable fields and array elements. */
export type QueryWireFields<Value extends object> = { [Key in keyof Value]: WireValue<Value[Key]> };
type AtLeastOne<Fields> = Partial<Fields> & { [Key in keyof Fields]: Pick<Fields, Key> }[keyof Fields];
type Conditions<Fields, Side> = OptionalQueryFields<{
  [Key in keyof Fields]: AtLeastOne<{
    [Op in keyof Fields[Key]]: Side extends 'input' ? WireValue<Fields[Key][Op]> : Fields[Key][Op];
  }>;
}>;

export type WhereComparisonSchema<Model, Declaration, Fields = ComparisonFields<Model, Declaration>> =
  [keyof Fields] extends [never] ? never : z.ZodType<Conditions<Fields, 'output'>, Conditions<Fields, 'input'>>;

// Zod objects consult inherited fields, including toString. Pass only supplied keys to the object in either direction.
function strictQueryFields({ shape, requireOne = false }: { shape: Record<string, z.ZodType>; requireOne?: boolean }) {
  const schema: z.ZodType = z.strictObject(shape);
  const ownFields = z.unknown().check(payload => {
    const input = payload.value;
    if (!z.core.util.isPlainObject(input)) {
      payload.issues.push({ code: 'invalid_type', expected: 'object', input });
      return;
    }
    const fields: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(input)) {
      if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
      if (typeof key !== 'string' || !Object.hasOwn(shape, key)) {
        payload.issues.push({ code: 'custom', path: [key], input, message: `Unrecognized query key "${String(key)}".` });
        continue;
      }
      const value = input[key];
      fields[key] = (key === FilterOperator.Contains || key === FilterOperator.Overlap) && Array.isArray(value)
        ? ownArrayValues(value, payload, key) : value;
    }
    if (requireOne && !payload.issues.length && !Object.keys(fields).length) {
      payload.issues.push({ code: 'custom', input, message: 'A field condition requires at least one declared comparison.' });
    }
    payload.value = fields;
  });
  // Describe the validated object within the caller's document so recursive elements share its JSON Schema definitions.
  ownFields._zod.processJSONSchema = (ctx, json, params) => {
    schema._zod.processJSONSchema!(ctx, json, params);
    if (requireOne) json.minProperties = 1;
  };
  return ownFields.pipe(schema).pipe(ownFields);
}

function nonNullOperand(operand: z.ZodType) {
  const { $schema, ...wire } = z.toJSONSchema(operand, { io: 'input' });
  // A nullable codec can map null to a concrete value or a string to null. Check both sides.
  const nonNullWire: z.ZodType = z.string().meta({ ...wire, type: 'string' });
  return nonNullWire.pipe(operand).refine(value => value !== null, 'The comparison requires a non-null value.');
}

function conditionSchema(comparisons: Record<string, z.ZodType>) {
  const entries = Object.entries(comparisons);
  if (!entries.length) return;
  const multiple = entries.length > 1;
  for (const [operator, value] of entries) comparisons[operator] = multiple ? value.exactOptional() : value.nonoptional();
  return strictQueryFields({ shape: comparisons, requireOne: multiple }).exactOptional();
}

export interface WhereComparisonOptions {
  model?: ResolveFiltersOptions['model'];
  filters: Readonly<Record<string, FilterDescriptor | undefined>>;
}

/** Builds the comparisons enabled by the List declaration. */
export function whereComparisonSchema({ model, filters }: WhereComparisonOptions) {
  if (!model) return;
  const shape: Record<string, z.ZodType> = Object.create(null);
  for (const field of Object.values(filters)) {
    if (!field || reservedQueryFields.has(field.path)) continue;
    const group: readonly FilterOperator[] = FILTER_OPERATORS[field.kind];
    const operators = scalarComparisons.filter(operator => group.includes(operator) && field.operators.includes(operator));
    const operand = operators.some(operator => !isPattern(operator)) ? equalityOperand(model.fields.get(field.path)!.schema) : undefined;
    const comparisons: Record<string, z.ZodType> = Object.create(null);
    let nonNull: z.ZodType | undefined;
    for (const operator of operators) {
      if (isPattern(operator)) comparisons[operator] = patternOperand;
      else if (operand) comparisons[operator] = operator === FilterOperator.Eq ? operand : (nonNull ??= nonNullOperand(operand));
    }
    if (field.kind === 'array') {
      if (field.operators.includes(FilterOperator.Eq)) comparisons[FilterOperator.Eq] = nullOperand;
      const enabled = FILTER_OPERATORS.array.filter(operator => field.operators.includes(operator));
      if (enabled.length) {
        const items = arrayOperand({ schema: model.fields.get(field.path)!.schema, path: field.path });
        for (const operator of enabled) comparisons[operator] = items;
      }
    }
    if (field.operators.includes(FilterOperator.Exists)) comparisons[FilterOperator.Exists] = booleanWireCodec;
    const condition = conditionSchema(comparisons);
    if (condition) shape[field.path] = condition;
  }
  if (Object.keys(shape).length) return strictQueryFields({ shape });
}
