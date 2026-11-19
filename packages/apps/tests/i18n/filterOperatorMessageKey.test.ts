import { expect, expectTypeOf, it } from 'vitest';
import { filterOperatorMessageKey } from '../../src/i18n/filterOperatorMessageKey.js';
import { FilterOperator } from '../../src/query/filterOperators.js';

const expected = {
  $eq: 'filters.operator.Eq',
  $ne: 'filters.operator.Ne',
  $in: 'filters.operator.In',
  $nin: 'filters.operator.Nin',
  $like: 'filters.operator.Like',
  $ilike: 'filters.operator.ILike',
  $gt: 'filters.operator.Gt',
  $gte: 'filters.operator.Gte',
  $lt: 'filters.operator.Lt',
  $lte: 'filters.operator.Lte',
  $contains: 'filters.operator.Contains',
  $overlap: 'filters.operator.Overlap',
  $exists: 'filters.operator.Exists',
} satisfies Record<FilterOperator, string>;

it.each(Object.values(FilterOperator))('derives the label key for %s', operator => {
  expect(filterOperatorMessageKey(operator)).toBe(expected[operator]);
});

it('preserves the exact message key for named operators and wire literals', () => {
  expectTypeOf(filterOperatorMessageKey(FilterOperator.Gte)).toEqualTypeOf<'filters.operator.Gte'>();
  expectTypeOf(filterOperatorMessageKey('$ilike')).toEqualTypeOf<'filters.operator.ILike'>();
  expectTypeOf(filterOperatorMessageKey).parameter(0).toEqualTypeOf<FilterOperator>();
});
