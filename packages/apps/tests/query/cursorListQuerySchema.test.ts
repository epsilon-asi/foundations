import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { cursorListQuerySchema, type CursorListQueryOptions } from '../../src/query/cursorListQuerySchema.js';
import { DEFAULT_MAX_SEARCH_LENGTH } from '../../src/query/search.js';

const paging = cursorListQuerySchema();

it('defaults the first cursor query to a numeric page size and an absent cursor', () => {
  expect(paging.decode({})).toEqual({ perPage: 20 });
  expect(paging.encode({ perPage: 20 })).toEqual({ perPage: '20' });
  expectTypeOf<z.input<typeof paging>>().toEqualTypeOf<{ cursor?: string | undefined; perPage?: string | undefined }>();
  expectTypeOf<z.output<typeof paging>>().toEqualTypeOf<{ cursor?: string | undefined; perPage: number }>();
});

it.each(['', ' next:+/%2F== '])('round-trips an opaque cursor %j exactly', cursor => {
  const wire = { cursor, perPage: '3' };
  const decoded = paging.decode(wire);
  expect(decoded).toEqual({ cursor, perPage: 3 });
  expect(paging.encode(decoded)).toEqual(wire);
});

it('uses the list size settings and checks the same bounds on input and output', () => {
  const small = cursorListQuerySchema({ perPage: { max: 3 } });
  expect(small.decode({})).toEqual({ perPage: 3 });
  expect(small.safeDecode({ perPage: '4' }).error?.issues).toMatchObject([{ path: ['perPage'], maximum: 3 }]);
  expect(small.safeDecode({ perPage: '0' }).error?.issues).toMatchObject([{ path: ['perPage'], minimum: 1 }]);
  expect(small.safeEncode({ perPage: 4 }).success).toBe(false);
});

it('rejects offset fields, undeclared search and non-string cursors', () => {
  expect(paging.safeParse({ page: '2' }).success).toBe(false);
  expect(paging.safeParse({ q: 'offers' }).success).toBe(false);
  expect(paging.safeParse({ cursor: ['next'] }).error?.issues[0].path).toEqual(['cursor']);
});

it('adds an optional search string to the cursor query when the list declares searchable fields', () => {
  const searchable = cursorListQuerySchema({ perPage: { default: 5 }, search: { fields: ['title'] } });
  const q = 'a'.repeat(DEFAULT_MAX_SEARCH_LENGTH);
  expect(searchable.decode({})).toEqual({ perPage: 5 });
  expect(searchable.encode(searchable.decode({ cursor: 'next', q }))).toEqual({ cursor: 'next', perPage: '5', q });
  expect(searchable.safeDecode({ q: q + 'x' }).error?.issues).toMatchObject([{ path: ['q'], maximum: DEFAULT_MAX_SEARCH_LENGTH }]);
  expectTypeOf<z.output<typeof searchable>>().toEqualTypeOf<{ cursor?: string | undefined; perPage: number; q?: string | undefined }>();
});

it('accepts a list declaration with optional search and validates it at definition time', () => {
  const schemaFor = (list?: CursorListQueryOptions) => cursorListQuerySchema(list);
  expect(schemaFor(undefined).safeParse({ q: 'x' }).success).toBe(false);
  expect(schemaFor({ search: { fields: ['title'] } }).decode({ q: 'x' })).toEqual({ perPage: 20, q: 'x' });
  // @ts-expect-error A search declaration requires a list of fields.
  expect(() => cursorListQuerySchema({ search: {} })).toThrow(z.ZodError);
});
