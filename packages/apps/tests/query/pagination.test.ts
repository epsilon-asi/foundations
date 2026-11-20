import { expect, it } from 'vitest';
import { offsetPaginationDefaults } from '../../src/query/pagination.js';

it('starts an unconfigured list at page zero with size 20 and maximum 100', () => {
  expect(offsetPaginationDefaults()).toEqual({ page: 0, perPage: 20, maxPerPage: 100 });
});

it.each([
  [{ default: 12 }, 12, 100],
  [{ max: 150 }, 20, 150],
  [{ max: 8 }, 8, 8],
  [{ default: 32, max: 32 }, 32, 32],
  [{ default: 120, max: 200 }, 120, 200],
] as const)('resolves the page size settings %j', (perPage, defaultSize, maximum) => {
  expect(offsetPaginationDefaults({ perPage })).toEqual({ page: 0, perPage: defaultSize, maxPerPage: maximum });
});

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid size %s in either setting', size => {
  expect(() => offsetPaginationDefaults({ perPage: { default: size } })).toThrow('perPage.default');
  expect(() => offsetPaginationDefaults({ perPage: { max: size } })).toThrow('perPage.max');
});

it('rejects a declared default above the effective maximum', () => {
  expect(() => offsetPaginationDefaults({ perPage: { default: 101 } })).toThrow('perPage.max');
  expect(() => offsetPaginationDefaults({ perPage: { default: 20, max: 8 } })).toThrow('perPage.max');
});

it('requires an options object for perPage and numeric values for its settings', () => {
  // @ts-expect-error A list declaration configures page sizes through an object.
  expect(() => offsetPaginationDefaults({ perPage: 10 })).toThrow('settings object');
  // @ts-expect-error String page sizes are invalid in a declaration.
  expect(() => offsetPaginationDefaults({ perPage: { default: '10' } })).toThrow('positive safe integer');
});
