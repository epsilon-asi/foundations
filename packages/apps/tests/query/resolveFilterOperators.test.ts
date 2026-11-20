import { expect, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { FILTER_OPERATORS, FilterOperator, type TextOperator } from '../../src/query/filterOperators.js';
import { resolveFilterOperators } from '../../src/query/resolveFilterOperators.js';

it.each(['text', 'enum', 'range', 'boolean', 'id', 'array'] as const)('expands true for a %s field', kind => {
  expect(resolveFilterOperators({ kind, cap: true })).toEqual(FILTER_OPERATORS[kind]);
  const nullable = resolveFilterOperators({ kind, nullable: true, cap: true });
  expect(nullable).toEqual([...new Set([...FILTER_OPERATORS[kind], ...FILTER_OPERATORS.nullable])]);
  expect(Object.isFrozen(nullable)).toBe(true);
});

it('snapshots an explicit subset in declaration order', () => {
  const cap: TextOperator[] = [FilterOperator.ILike, '$eq', '$ilike'];
  const operators = resolveFilterOperators({ kind: 'text', cap });
  cap.push('$ne');
  expect(operators).toEqual(['$ilike', '$eq']);
  expect(Object.isFrozen(operators)).toBe(true);
  expect(resolveFilterOperators({ kind: 'text', cap: [] })).toEqual([]);
});

it('checks operator declarations at definition time', () => {
  // @ts-expect-error The range operator is invalid for text even when a declaration arrives from JavaScript.
  expect(() => resolveFilterOperators({ kind: 'text', cap: ['$gt'] })).toThrow(ApiDefinitionError);
  // @ts-expect-error Enum fields do not support text matching.
  expect(() => resolveFilterOperators({ kind: 'enum', cap: ['$ilike'] })).toThrow(/\$ilike.*enum/);
});

it('adds null equality and existence for nullable arrays', () => {
  expect(resolveFilterOperators({ kind: 'array', nullable: true, cap: ['$exists', '$eq'] })).toEqual(['$exists', '$eq']);
  // @ts-expect-error Ordinary arrays support containment and overlap.
  expect(() => resolveFilterOperators({ kind: 'array', cap: ['$eq'] })).toThrow(/\$eq.*array/);
});

it('rejects malformed declarations instead of allowing them as filter groups', () => {
  // @ts-expect-error Objects have no operator group.
  expect(() => resolveFilterOperators({ kind: 'object', cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error Nullable is a modifier on a base kind.
  expect(() => resolveFilterOperators({ kind: 'nullable', cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error A field kind must be a string, even when an array would coerce to a table key.
  expect(() => resolveFilterOperators({ kind: ['text'], cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error A string is not a boolean nullability declaration.
  expect(() => resolveFilterOperators({ kind: 'array', nullable: 'false', cap: true })).toThrow(ApiDefinitionError);
  // @ts-expect-error A single operator must be wrapped in the list.
  expect(() => resolveFilterOperators({ kind: 'text', cap: '$eq' })).toThrow(ApiDefinitionError);
  // @ts-expect-error Every operator must be a named wire string.
  expect(() => resolveFilterOperators({ kind: 'text', cap: [Symbol()] })).toThrow(ApiDefinitionError);
});
