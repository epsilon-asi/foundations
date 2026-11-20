import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import type { ArrayOperator, BooleanOperator, EnumOperator, RangeOperator, TextOperator } from '../../src/query/filterOperators.js';
import { resolveFieldFilter, type ResolveFieldFilterOptions } from '../../src/query/resolveFieldFilter.js';

const text = resolveFieldFilter({ schema: z.string(), cap: true });
expectTypeOf(text.kind).toEqualTypeOf<'text'>();
expectTypeOf(text.operators).toEqualTypeOf<readonly TextOperator[]>();
const subset = resolveFieldFilter({ schema: z.string(), cap: ['$ilike'] });
expectTypeOf(subset.operators).toEqualTypeOf<readonly '$ilike'[]>();

const values: string[] = ['DRAFT', 'LIVE'];
const schema = z.enum(values);
const status = resolveFieldFilter({ schema, cap: true });
expectTypeOf<z.output<typeof schema>>().toEqualTypeOf<string>();
expectTypeOf(status.kind).toEqualTypeOf<'enum'>();
expectTypeOf(status.operators).toEqualTypeOf<readonly EnumOperator[]>();
// @ts-expect-error Even a widened enum field cannot select text matching.
const invalid: ResolveFieldFilterOptions = { schema, cap: ['$ilike'] };

const statusUnion = z.union([z.literal('draft'), z.literal('live')]);
const literalChoices = resolveFieldFilter({ schema: statusUnion, cap: true });
expectTypeOf(literalChoices).toEqualTypeOf<{ kind: 'enum'; operators: readonly EnumOperator[] }>();
const nestedChoices = statusUnion.or(z.literal(['archived', 'deleted'])).nullable();
const allChoices = resolveFieldFilter({ schema: nestedChoices, cap: true });
expectTypeOf(allChoices).toEqualTypeOf<{ kind: 'enum'; operators: readonly (EnumOperator | '$exists')[] }>();
const included = resolveFieldFilter({ schema: nestedChoices, cap: ['$in', '$exists'] });
expectTypeOf(included.operators).toEqualTypeOf<readonly ('$in' | '$exists')[]>();
// @ts-expect-error Adding nullability to a string literal union does not enable text matching.
resolveFieldFilter({ schema: nestedChoices, cap: ['$ilike'] });
const fromValues = z.union(values.map(value => z.literal(value)));
expectTypeOf(resolveFieldFilter({ schema: fromValues, cap: ['$in'] })).toEqualTypeOf<{
  kind: 'enum'; operators: readonly '$in'[];
}>();
// @ts-expect-error A union that contains unrestricted text is not a finite set of string choices.
resolveFieldFilter({ schema: statusUnion.or(z.string()), cap: true });
// @ts-expect-error A numeric branch does not belong to the string enum group.
resolveFieldFilter({ schema: statusUnion.or(z.literal(1)).nullable(), cap: true });
// @ts-expect-error The compact literal form also requires every value to be a string.
resolveFieldFilter({ schema: z.literal(['draft', 1]), cap: true });

function inspectTextOrLiteral(field: z.ZodString | typeof statusUnion) {
  const shared = resolveFieldFilter({ schema: field, cap: ['$in'] });
  expectTypeOf(shared.kind).toEqualTypeOf<'text' | 'enum'>();
  // @ts-expect-error Only an unrestricted text schema can select pattern matching.
  resolveFieldFilter({ schema: field, cap: ['$ilike'] });
}

const enabled = resolveFieldFilter({ schema: z.boolean(), cap: true });
expectTypeOf(enabled.kind).toEqualTypeOf<'boolean'>();
expectTypeOf(enabled.operators).toEqualTypeOf<readonly BooleanOperator[]>();
const equality = resolveFieldFilter({ schema: z.boolean(), cap: ['$eq'] });
expectTypeOf(equality.operators).toEqualTypeOf<readonly '$eq'[]>();

for (const field of [z.number(), z.bigint(), z.date()]) {
  const range = resolveFieldFilter({ schema: field, cap: true });
  expectTypeOf(range.kind).toEqualTypeOf<'range'>();
  expectTypeOf(range.operators).toEqualTypeOf<readonly RangeOperator[]>();
  const bounded = resolveFieldFilter({ schema: field, cap: ['$gte', '$lt'] });
  expectTypeOf(bounded.operators).toEqualTypeOf<readonly ('$gte' | '$lt')[]>();
}

function inspect(field: Exclude<ResolveFieldFilterOptions['schema'], z.core.$ZodNullable>) {
  const choice = resolveFieldFilter({ schema: field, cap: true });
  if (choice.kind === 'array') expectTypeOf(choice.operators).toEqualTypeOf<readonly ArrayOperator[]>();
  else if (choice.kind === 'enum') expectTypeOf(choice.operators).toEqualTypeOf<readonly EnumOperator[]>();
  else if (choice.kind === 'range') expectTypeOf(choice.operators).toEqualTypeOf<readonly RangeOperator[]>();
  else if (choice.kind === 'boolean') expectTypeOf(choice.operators).toEqualTypeOf<readonly BooleanOperator[]>();
  else expectTypeOf(choice.operators).toEqualTypeOf<readonly TextOperator[]>();
  const empty = resolveFieldFilter({ schema: field, cap: [] });
  expectTypeOf(empty.operators).toEqualTypeOf<readonly never[]>();
  // @ts-expect-error Arrays and scalars have no shared operator.
  resolveFieldFilter({ schema: field, cap: ['$eq'] });
  if (field instanceof z.core.$ZodArray) {
    const contains = resolveFieldFilter({ schema: field, cap: ['$contains'] });
    expectTypeOf(contains.kind).toEqualTypeOf<'array'>();
    expectTypeOf(contains.operators).toEqualTypeOf<readonly '$contains'[]>();
  } else {
    const shared = resolveFieldFilter({ schema: field, cap: ['$eq'] });
    expectTypeOf(shared.operators).toEqualTypeOf<readonly '$eq'[]>();
  }
  // @ts-expect-error A field that might be an enum must be narrowed before allowing $ilike.
  resolveFieldFilter({ schema: field, cap: ['$ilike'] });
  // @ts-expect-error A field that might be a boolean must be narrowed before allowing membership.
  resolveFieldFilter({ schema: field, cap: ['$in'] });
}

function inspectRangeOrText(field: z.ZodDate | z.ZodString) {
  const shared = resolveFieldFilter({ schema: field, cap: ['$in'] });
  expectTypeOf(shared.kind).toEqualTypeOf<'range' | 'text'>();
  expectTypeOf(shared.operators).toEqualTypeOf<readonly '$in'[]>();
  // @ts-expect-error Text fields cannot select a range comparison.
  resolveFieldFilter({ schema: field, cap: ['$gte'] });
}

const tags = z.array(z.string());
const nullableTags = tags.nullable();
const allTags = resolveFieldFilter({ schema: nullableTags, cap: true });
expectTypeOf(allTags.kind).toEqualTypeOf<'array'>();
expectTypeOf(allTags.operators).toEqualTypeOf<readonly (ArrayOperator | '$exists' | '$eq')[]>();
const subsetTags = resolveFieldFilter({ schema: nullableTags.nullable(), cap: ['$eq', '$exists'] });
expectTypeOf(subsetTags.operators).toEqualTypeOf<readonly ('$eq' | '$exists')[]>();
// @ts-expect-error A nullable field still cannot select another group's operators.
const wrongNullable: ResolveFieldFilterOptions = { schema: nullableTags, cap: ['$gte'] };

function inspectNullability(field: typeof tags | typeof nullableTags) {
  const shared = resolveFieldFilter({ schema: field, cap: ['$overlap'] });
  expectTypeOf(shared.operators).toEqualTypeOf<readonly '$overlap'[]>();
  // @ts-expect-error The declaration must narrow the array to nullable before selecting equality.
  resolveFieldFilter({ schema: field, cap: ['$eq'] });
  // @ts-expect-error Presence testing is available only when the field is known to be nullable.
  resolveFieldFilter({ schema: field, cap: ['$exists'] });
}

function inspectMixedKinds(field: z.ZodNumber | typeof nullableTags) {
  const shared = resolveFieldFilter({ schema: field, cap: ['$eq'] });
  expectTypeOf(shared.kind).toEqualTypeOf<'array' | 'range'>();
  // @ts-expect-error The number schema may be non-nullable.
  resolveFieldFilter({ schema: field, cap: ['$exists'] });
}

function inspectWrappedUnion(inner: z.ZodString | z.ZodDate) {
  const field = z.nullable(inner);
  const choice = resolveFieldFilter({ schema: field, cap: true });
  if (choice.kind === 'range') expectTypeOf(choice.operators).toEqualTypeOf<readonly (RangeOperator | '$exists')[]>();
  else expectTypeOf(choice.operators).toEqualTypeOf<readonly (TextOperator | '$exists')[]>();
  // @ts-expect-error A nullable text field cannot select range comparisons.
  resolveFieldFilter({ schema: field, cap: ['$gte'] });
}

function inspectAll(field: ResolveFieldFilterOptions['schema']) {
  const all = resolveFieldFilter({ schema: field, cap: true });
  expectTypeOf(all.kind).toEqualTypeOf<'array' | 'boolean' | 'enum' | 'text' | 'range'>();
  // @ts-expect-error Plain arrays in the union exclude equality.
  resolveFieldFilter({ schema: field, cap: ['$eq'] });
  if (field instanceof z.core.$ZodNullable) {
    const exists = resolveFieldFilter({ schema: field, cap: ['$exists'] });
    expectTypeOf(exists.operators).toEqualTypeOf<readonly '$exists'[]>();
  }
}
