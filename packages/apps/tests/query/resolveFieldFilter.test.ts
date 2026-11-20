import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { FILTER_OPERATORS } from '../../src/query/filterOperators.js';
import { resolveFieldFilter } from '../../src/query/resolveFieldFilter.js';

it('selects text operators for a string field', () => {
  const schema = z.string().min(1);
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind: 'text', operators: FILTER_OPERATORS.text });
  expect(resolveFieldFilter({ schema, cap: ['$ilike'] })).toEqual({ kind: 'text', operators: ['$ilike'] });
});

it('selects enum operators for string options supplied as a list or object', () => {
  const values: string[] = ['DRAFT', 'LIVE'];
  const expected = { kind: 'enum', operators: FILTER_OPERATORS.enum };
  expect(resolveFieldFilter({ schema: z.enum(values), cap: true })).toEqual(expected);
  expect(resolveFieldFilter({ schema: z.enum({ Draft: 'draft', Live: 'live' }), cap: true })).toEqual(expected);
  expect(resolveFieldFilter({ schema: z.enum(values), cap: ['$in'] })).toEqual({ kind: 'enum', operators: ['$in'] });
});

it('rejects a text-only operator on a string enum at definition time', () => {
  const schema = z.enum(['DRAFT', 'LIVE']);
  // @ts-expect-error String enums only support their membership and equality operators.
  expect(() => resolveFieldFilter({ schema, cap: ['$ilike'] })).toThrow(/\$ilike.*enum/);
});

it.each([
  ['literal union', z.union([z.literal('draft'), z.literal('live')])],
  ['multi-value literal', z.literal(['draft', 'live'])],
  ['nested union', z.literal('draft').or(z.literal('live')).or(z.enum(['archived']))],
] as const)('selects enum operators for a %s', (_name, schema) => {
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind: 'enum', operators: FILTER_OPERATORS.enum });
  expect(resolveFieldFilter({ schema, cap: ['$in'] })).toEqual({ kind: 'enum', operators: ['$in'] });
  // @ts-expect-error String choices cannot select a text pattern operator.
  expect(() => resolveFieldFilter({ schema, cap: ['$ilike'] })).toThrow(/\$ilike.*enum/);

  const nullable = z.nullable(schema);
  expect(resolveFieldFilter({ schema: nullable, cap: true })).toEqual({ kind: 'enum', operators: [...FILTER_OPERATORS.enum, '$exists'] });
});

it.each([
  ['an unrestricted string', z.literal('draft').or(z.literal('live').or(z.string()))],
  ['a numeric literal', z.union([z.literal('draft'), z.literal(1)])],
  ['mixed literal values', z.literal(['draft', 1])],
  ['a null literal branch', z.union([z.literal('draft'), z.literal(null)])],
  ['a nullable branch', z.union([z.literal('draft'), z.literal('live').nullable()])],
] as const)('rejects a string choice declaration containing %s', (_name, schema) => {
  // @ts-expect-error Every option must be a finite string choice.
  expect(() => resolveFieldFilter({ schema, cap: true })).toThrow(ApiDefinitionError);
});

it('selects only equality and inequality for a boolean field', () => {
  const schema = z.boolean();
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind: 'boolean', operators: FILTER_OPERATORS.boolean });
  expect(resolveFieldFilter({ schema, cap: ['$ne'] })).toEqual({ kind: 'boolean', operators: ['$ne'] });
  // @ts-expect-error Membership is unavailable on booleans.
  expect(() => resolveFieldFilter({ schema, cap: ['$in'] })).toThrow(/\$in.*boolean/);
  // @ts-expect-error Range comparisons are unavailable on booleans.
  expect(() => resolveFieldFilter({ schema, cap: ['$gte'] })).toThrow(/\$gte.*boolean/);
});

it.each([
  ['number', z.number().positive()],
  ['bigint', z.bigint()],
  ['Date', z.date()],
] as const)('selects range comparisons for a %s field', (_name, schema) => {
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind: 'range', operators: FILTER_OPERATORS.range });
  expect(resolveFieldFilter({ schema, cap: ['$gte', '$lt'] })).toEqual({ kind: 'range', operators: ['$gte', '$lt'] });
  // @ts-expect-error Pattern matching is unavailable on range fields.
  expect(() => resolveFieldFilter({ schema, cap: ['$ilike'] })).toThrow(/\$ilike.*range/);
});

it('selects containment and overlap for arrays', () => {
  const schema = z.array(z.number()).min(1);
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind: 'array', operators: FILTER_OPERATORS.array });
  expect(resolveFieldFilter({ schema, cap: ['$overlap'] })).toEqual({ kind: 'array', operators: ['$overlap'] });
  // @ts-expect-error A comparison on numeric elements is unavailable on their array.
  expect(() => resolveFieldFilter({ schema, cap: ['$gte'] })).toThrow(/\$gte.*array/);
  // @ts-expect-error Equality is unavailable on a non-nullable array.
  expect(() => resolveFieldFilter({ schema, cap: ['$eq'] })).toThrow(/\$eq.*array/);
});

it('adds existence and null equality to a nullable array', () => {
  const elementsCanBeNull = z.array(z.string().nullable());
  const schema = elementsCanBeNull.nullable().nullable();
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({
    kind: 'array', operators: ['$contains', '$overlap', '$exists', '$eq'],
  });
  expect(resolveFieldFilter({ schema, cap: ['$eq', '$overlap', '$exists'] }).operators).toEqual(['$eq', '$overlap', '$exists']);
  // @ts-expect-error Nullable array elements do not make the field nullable.
  expect(() => resolveFieldFilter({ schema: elementsCanBeNull, cap: ['$exists'] })).toThrow(/\$exists.*array/);
  // @ts-expect-error Range comparisons remain unavailable on nullable arrays.
  expect(() => resolveFieldFilter({ schema, cap: ['$gte'] })).toThrow(/\$gte.*array/);
});

it.each([
  ['text', z.string()], ['enum', z.enum(['draft', 'live'])], ['boolean', z.boolean()],
  ['range', z.number()], ['range', z.bigint()], ['range', z.date()],
] as const)('retains the %s group and adds existence when nullable', (kind, inner) => {
  const schema = z.nullable(inner);
  expect(resolveFieldFilter({ schema, cap: true })).toEqual({ kind, operators: [...FILTER_OPERATORS[kind], '$exists'] });
  expect(resolveFieldFilter({ schema, cap: ['$exists'] }).operators).toEqual(['$exists']);
});

it('rejects other schemas and enums with numeric values', () => {
  // @ts-expect-error Objects have no filter group.
  expect(() => resolveFieldFilter({ schema: z.object({}), cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error Every enum value must be a string.
  expect(() => resolveFieldFilter({ schema: z.enum({ Draft: 'draft', Live: 1 }), cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error A nullable object still has no filter group.
  expect(() => resolveFieldFilter({ schema: z.object({}).nullable(), cap: true })).toThrow(ApiDefinitionError);
});
