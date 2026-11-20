import { expect, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { domainErrorMessageKey } from '../../src/i18n/domainErrorMessageKey.js';
import { defineErrors, DomainError } from '../../src/responses/defineErrors.js';

it('creates one named throwable class per error and a namespaced table shared with workers', () => {
  const OrgBillingError = defineErrors('OrgBilling', { UNPAID: { code: 402 }, FEATURE_RESTRICTED: { code: 403 } });
  expect(OrgBillingError.Types).toEqual({ UNPAID: 'OrgBilling.UNPAID', FEATURE_RESTRICTED: 'OrgBilling.FEATURE_RESTRICTED' });
  const denied = new OrgBillingError.FeatureRestricted();
  expect(denied).toBeInstanceOf(Error);
  expect(denied).toBeInstanceOf(DomainError);
  expect(denied).toBeInstanceOf(OrgBillingError.FeatureRestricted);
  expect(denied).not.toBeInstanceOf(OrgBillingError.Unpaid);
  expect(denied.name).toBe('FeatureRestricted');
  expect(denied.code).toBe(403);
  expect(denied.error).toBe(OrgBillingError.Types.FEATURE_RESTRICTED);
  expect(denied.type).toBe(denied.error);
  expect(domainErrorMessageKey(denied.error)).toBe('errors.OrgBilling.FEATURE_RESTRICTED');
  expect(() => { throw new OrgBillingError.Unpaid(); }).toThrow(OrgBillingError.Unpaid);
});

it('keeps domains and the captured declarations independent', () => {
  const declaration: { UNPAID: { code: 402 | 409 } } = { UNPAID: { code: 402 } };
  const OrgBillingError = defineErrors('OrgBilling', declaration);
  declaration.UNPAID.code = 409;
  const InvoiceError = defineErrors('Invoice', declaration);
  expect(Object.isFrozen(OrgBillingError)).toBe(true);
  expect(Object.isFrozen(OrgBillingError.Types)).toBe(true);
  expect(new OrgBillingError.Unpaid()).toMatchObject({ type: 'OrgBilling.UNPAID', code: 402 });
  expect(new InvoiceError.Unpaid()).toMatchObject({ type: 'Invoice.UNPAID', code: 409 });
  expect(new InvoiceError.Unpaid()).not.toBeInstanceOf(OrgBillingError.Unpaid);
});

it('keeps the declared spelling on the wire when deriving constructor names', () => {
  const errors = defineErrors('Api', { expiredToken: { code: 409 }, HTTP2_LIMIT: { code: 429 }, X2FA: { code: 499 } });
  expect(new errors.ExpiredToken().error).toBe('Api.expiredToken');
  expect(new errors.Http2Limit().type).toBe('Api.HTTP2_LIMIT');
  expect(new errors.X2fa().type).toBe('Api.X2FA');
});

it('accepts each supported failure boundary and both server statuses', () => {
  const errors = defineErrors('Network', { BAD: { code: 400 }, CLOSED: { code: 499 }, INTERNAL: { code: 500 }, BUSY: { code: 503 } });
  expect([new errors.Bad().code, new errors.Closed().code, new errors.Internal().code, new errors.Busy().code]).toEqual([400, 499, 500, 503]);
});

it.each([200, 399, 400.5, 502, 600, undefined, '402'])('rejects an invalid status %j at definition time', code => {
  // @ts-expect-error Runtime declarations also validate unsupported status values.
  expect(() => defineErrors('Billing', { UNPAID: { code } })).toThrow(/Billing\.UNPAID.*failure status/);
});

it('rejects ambiguous identifiers and constructor collisions at definition time', () => {
  expect(() => defineErrors('Bad.Domain', { BAD: { code: 402 } })).toThrow(ApiDefinitionError);
  expect(() => defineErrors('Billing', { 'BAD.KEY': { code: 402 } })).toThrow(/BAD\.KEY.*Billing/);
  expect(() => defineErrors('Billing', { [Symbol('BAD')]: { code: 402 } })).toThrow(/Symbol\(BAD\).*Billing/);
  expect(() => defineErrors('Billing', { TYPES: { code: 402 } })).toThrow(/Billing\.TYPES.*"Types"/);
  expect(() => defineErrors('Billing', { UNPAID: { code: 402 }, Unpaid: { code: 409 } })).toThrow(/Billing\.Unpaid.*"Unpaid"/);
  // @ts-expect-error JavaScript can supply a malformed declaration map.
  expect(() => defineErrors('Billing', null)).toThrow(ApiDefinitionError);
});
