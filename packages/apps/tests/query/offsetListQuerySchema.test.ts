import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { offsetListQuerySchema, type OffsetListQueryOptions } from '../../src/query/offsetListQuerySchema.js';

const searchable = offsetListQuerySchema({ perPage: { default: 5 }, search: { fields: ['name'], mode: 'text' } });

it('enables an optional q from the list declaration and applies the paging defaults', () => {
  expect(searchable.decode({})).toEqual({ page: 0, perPage: 5 });
  expectTypeOf<z.output<typeof searchable>>().toEqualTypeOf<{ page: number; perPage: number; q?: string | undefined }>();
  expectTypeOf<z.input<typeof searchable>['q']>().toEqualTypeOf<string | undefined>();
});

it('accepts 200 characters, preserves their text on the wire, and reports the 201st on q', () => {
  const q = ' ' + 'a'.repeat(198) + ' ';
  const wire = { page: '2', perPage: '5', q };
  const decoded = { page: 2, perPage: 5, q };
  expect(searchable.decode(wire)).toEqual(decoded);
  expect(searchable.encode(decoded)).toEqual(wire);
  expect(searchable.safeParse({ q: q + 'a' }).error?.issues).toMatchObject([{ path: ['q'], maximum: 200 }]);
  expect(searchable.safeEncode({ ...decoded, q: q + 'a' }).success).toBe(false);
});

it('rejects q when search is omitted and keeps undeclared fields out of searchable lists', () => {
  const pagingOnly = offsetListQuerySchema({ perPage: { max: 5 } });
  expectTypeOf<z.output<typeof pagingOnly>>().toEqualTypeOf<{ page: number; perPage: number }>();
  expect(pagingOnly.safeParse({ q: '' }).success).toBe(false);
  expect(offsetListQuerySchema().safeParse({ q: 'catalog' }).success).toBe(false);
  expect(searchable.safeParse({ fields: ['name'] }).success).toBe(false);
});

it('accepts an optional list declaration with optional search', () => {
  const schemaFor = (list?: OffsetListQueryOptions) => offsetListQuerySchema(list);
  expect(schemaFor({ search: { fields: ['name'] } }).parse({ q: 'x' })).toEqual({ page: 0, perPage: 20, q: 'x' });
  expect(schemaFor(undefined).safeParse({ q: 'x' }).success).toBe(false);
});

it.each([null, false, {}, { fields: 'name' }, { fields: [1] }, { fields: ['name'], mode: 'other' }])(
  'rejects a malformed search declaration %j at definition time',
  search => {
    // @ts-expect-error Invalid application declarations are also checked at runtime.
    expect(() => offsetListQuerySchema({ search })).toThrow(z.ZodError);
  },
);
