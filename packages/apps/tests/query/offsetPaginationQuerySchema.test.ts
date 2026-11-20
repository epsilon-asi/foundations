import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { offsetPaginationQuerySchema } from '../../src/query/pagination.js';
import { searchQuerySchema } from '../../src/query/search.js';

const paging = offsetPaginationQuerySchema();

it('defaults omitted fields independently and returns numbers', () => {
  expect(paging.parse({})).toEqual({ page: 0, perPage: 20 });
  expect(paging.parse({ page: '3' })).toEqual({ page: 3, perPage: 20 });
  expect(paging.parse({ perPage: '1' })).toEqual({ page: 0, perPage: 1 });
  expectTypeOf<z.output<typeof paging>>().toEqualTypeOf<{ page: number; perPage: number }>();
  expectTypeOf<z.input<typeof paging>>().toEqualTypeOf<{ page?: string | undefined; perPage?: string | undefined }>();
});

it('accepts the configured maximum and rejects the next value on perPage', () => {
  const small = offsetPaginationQuerySchema({ perPage: { default: 2, max: 5 } });
  expect(small.parse({})).toEqual({ page: 0, perPage: 2 });
  expect(small.parse({ page: '0', perPage: '5' })).toEqual({ page: 0, perPage: 5 });
  expect(small.safeParse({ perPage: '6' }).error?.issues).toMatchObject([
    { path: ['perPage'], code: 'too_big', maximum: 5 },
  ]);
  expect(offsetPaginationQuerySchema({ perPage: { max: 4 } }).parse({})).toEqual({ page: 0, perPage: 4 });
});

it.each([
  ['page', '-1'], ['page', '0.5'], ['page', ''], ['page', ' 1'], ['page', '01'],
  ['page', '9007199254740992'], ['page', ['2']], ['perPage', '0'], ['perPage', '101'], ['perPage', '2.5'],
])('reports invalid %s value %j on the query field', (field, value) => {
  expect(paging.safeParse({ [field]: value }).error?.issues[0].path).toEqual([field]);
});

it('encodes decoded fields back to query strings and validates the bounds in both directions', () => {
  expect(paging.encode(paging.decode({ page: '2', perPage: '100' }))).toEqual({ page: '2', perPage: '100' });
  expect(paging.safeEncode({ page: 0, perPage: 101 }).success).toBe(false);
});

it('only accepts extra list fields declared by the endpoint', () => {
  const query = { q: 'catalog' };
  expect(paging.safeParse(query).success).toBe(false);
  const searchable = paging.extend({ q: searchQuerySchema.optional() });
  expect(searchable.parse(query)).toEqual({ page: 0, perPage: 20, q: 'catalog' });
});
