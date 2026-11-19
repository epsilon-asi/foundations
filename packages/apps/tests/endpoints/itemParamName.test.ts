import { expect, expectTypeOf, it } from 'vitest';
import { itemParamName } from '../../src/endpoints/itemParamName.js';

it('derives item parameters from simple and compound resource names', () => {
  const offering = itemParamName('Offering');
  const apiKey = itemParamName('ApiKey');
  expect(offering).toBe('offeringId');
  expect(apiKey).toBe('apiKeyId');
  expectTypeOf(offering).toEqualTypeOf<'offeringId'>();
  expectTypeOf(apiKey).toEqualTypeOf<'apiKeyId'>();
});

it('rejects a name when camel-casing would disagree with its TypeScript literal', () => {
  expect(() => itemParamName('APIKey')).toThrow(/APIKey.*ApiKey/);
});
