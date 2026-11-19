import { expect, expectTypeOf, it } from 'vitest';
import { domainErrorMessageKey } from '../../src/i18n/domainErrorMessageKey.js';

it('preserves the domain and error type from the wire', () => {
  const key = domainErrorMessageKey('OrgBilling.UNPAID');
  expect(key).toBe('errors.OrgBilling.UNPAID');
  expectTypeOf(key).toEqualTypeOf<'errors.OrgBilling.UNPAID'>();
  expectTypeOf<'UNPAID'>().not.toExtend<Parameters<typeof domainErrorMessageKey>[0]>();
});

it('preserves underscores in the error type', () => {
  expect(domainErrorMessageKey('Auth.TOKEN_EXPIRED')).toBe('errors.Auth.TOKEN_EXPIRED');
});
