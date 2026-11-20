import { expect, expectTypeOf, it } from 'vitest';
import { domainErrorMessageKey } from '../../src/i18n/domainErrorMessageKey.js';
import { filterOperatorMessageKey } from '../../src/i18n/filterOperatorMessageKey.js';
import { FRAMEWORK_ENGLISH_MESSAGES } from '../../src/i18n/frameworkEnglishMessages.js';
import { FilterOperator } from '../../src/query/filterOperators.js';
import { AUTHENTICATION_ERRORS, type AuthenticationFailureResponse } from '../../src/responses/authenticationFailure.js';

const operators = Object.values(FilterOperator);
const keys = operators.map(filterOperatorMessageKey);

it('ships a distinct message for every authentication failure', () => {
  const authKeys = Object.values(AUTHENTICATION_ERRORS).map(domainErrorMessageKey);
  for (const key of authKeys) expect(FRAMEWORK_ENGLISH_MESSAGES[key]).toMatch(/\S/);
  const { 'errors.Auth.TOKEN_EXPIRED': expired, ...incomplete } = FRAMEWORK_ENGLISH_MESSAGES;
  expect(expired).toBe('Your access token has expired.');
  expect(incomplete['errors.Auth.UNAUTHENTICATED']).toBe('Sign in to continue.');
  expect(authKeys.filter(key => !Object.hasOwn(incomplete, key))).toEqual(['errors.Auth.TOKEN_EXPIRED']);
  expectTypeOf(incomplete).not.toExtend<typeof FRAMEWORK_ENGLISH_MESSAGES>();
  type AuthKeys = Extract<keyof typeof FRAMEWORK_ENGLISH_MESSAGES, `errors.Auth.${string}`>;
  expectTypeOf<AuthKeys>().toEqualTypeOf<`errors.${AuthenticationFailureResponse['error']}`>();
});

it.each(operators)('ships an English label for %s', operator => {
  const key = filterOperatorMessageKey(operator);
  expect(FRAMEWORK_ENGLISH_MESSAGES[key]).toMatch(/\S/);
});

it('uses a unique catalog key for every operator', () => {
  const filterKeys = Object.keys(FRAMEWORK_ENGLISH_MESSAGES).filter(key => key.startsWith('filters.operator.'));
  expect(new Set(keys).size).toBe(operators.length);
  expect(new Set(filterKeys)).toEqual(new Set(keys));
  expect(Object.isFrozen(FRAMEWORK_ENGLISH_MESSAGES)).toBe(true);
});

it('labels pattern matching and array membership precisely', () => {
  expect(FRAMEWORK_ENGLISH_MESSAGES[filterOperatorMessageKey('$like')]).toBe('Matches pattern (case-sensitive)');
  expect(FRAMEWORK_ENGLISH_MESSAGES[filterOperatorMessageKey('$ilike')]).toBe('Matches pattern (case-insensitive)');
  expect(FRAMEWORK_ENGLISH_MESSAGES[filterOperatorMessageKey('$contains')]).toBe('Contains all of');
  expect(FRAMEWORK_ENGLISH_MESSAGES[filterOperatorMessageKey('$overlap')]).toBe('Contains any of');
});

it('identifies the exact missing translation in an incomplete catalog', () => {
  const key = filterOperatorMessageKey(FilterOperator.Gte);
  const { [key]: label, ...incomplete } = FRAMEWORK_ENGLISH_MESSAGES;
  expect(label).toBe('Greater than or equal to');
  expect(keys.filter(key => !Object.hasOwn(incomplete, key))).toEqual(['filters.operator.Gte']);
  expectTypeOf(incomplete).not.toExtend<typeof FRAMEWORK_ENGLISH_MESSAGES>();
  const translated = { ...incomplete, [key]: 'Au moins' } satisfies typeof FRAMEWORK_ENGLISH_MESSAGES;
  expect(translated[key]).toBe('Au moins');
});
