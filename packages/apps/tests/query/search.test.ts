import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { DEFAULT_MAX_SEARCH_LENGTH, searchQuerySchema } from '../../src/query/search.js';

const listQuery = z.object({ q: searchQuerySchema.optional() });

it.each(['a', '🔎'])('accepts 200 copies of %s and reports the 201st on q', character => {
  expect(DEFAULT_MAX_SEARCH_LENGTH).toBe(200);
  const q = character.repeat(DEFAULT_MAX_SEARCH_LENGTH);
  expect(listQuery.parse({ q })).toEqual({ q });
  expect(listQuery.safeParse({ q: q + character }).error?.issues).toMatchObject([
    { code: 'too_big', maximum: DEFAULT_MAX_SEARCH_LENGTH, path: ['q'] },
  ]);
});

it('preserves the supplied search text and allows an omitted q', () => {
  expect(listQuery.parse({ q: '  Road Map  ' })).toEqual({ q: '  Road Map  ' });
  expect(listQuery.parse({ q: '' })).toEqual({ q: '' });
  expect(listQuery.parse({})).toEqual({});
});

it('rejects a non-string search term', () => {
  expect(listQuery.safeParse({ q: 123 }).success).toBe(false);
});
