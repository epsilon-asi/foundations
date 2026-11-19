import { expect, expectTypeOf, it } from 'vitest';
import { listResponseKey } from '../../src/endpoints/listResponseKey.js';

it('camel-cases the default or explicit plural into an exact response key', () => {
  const apiKeys = listResponseKey({ name: 'ApiKey' });
  const companies = listResponseKey({ name: 'Company', plural: 'Companies' });
  expect(apiKeys).toBe('apiKeys');
  expect(companies).toBe('companies');
  expectTypeOf(apiKeys).toEqualTypeOf<'apiKeys'>();
  expectTypeOf(companies).toEqualTypeOf<'companies'>();
});

it('includes both possible keys when the plural override is optional', () => {
  function key(options: { name: 'Person'; plural?: 'People' }) {
    return listResponseKey(options);
  }
  expectTypeOf(key).returns.toEqualTypeOf<'persons' | 'people'>();
  expect(key({ name: 'Person' })).toBe('persons');
  expect(key({ name: 'Person', plural: 'People' })).toBe('people');
});

it('rejects a plural when camel-casing disagrees with its TypeScript spelling', () => {
  expect(() => listResponseKey({ name: 'ApiKey', plural: 'APIKeys' })).toThrow(/APIKeys.*ApiKey/);
});
