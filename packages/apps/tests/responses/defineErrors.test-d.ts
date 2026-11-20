import { expectTypeOf } from 'vitest';
import { CLIENT_FAILURE_CODES } from '../../src/responses/clientFailureCodes.js';
import { defineErrors, DomainError, type DomainErrorDefinitions, type DomainErrorsOf } from '../../src/responses/defineErrors.js';

const OrgBillingError = defineErrors('OrgBilling', {
  UNPAID: { code: CLIENT_FAILURE_CODES.PaymentRequired },
  FEATURE_RESTRICTED: { code: 403 },
});
type OrgBillingErrors = DomainErrorsOf<typeof OrgBillingError>;
expectTypeOf<keyof typeof OrgBillingError>().toEqualTypeOf<'Types' | 'Unpaid' | 'FeatureRestricted'>();
expectTypeOf(OrgBillingError.Types.UNPAID).toEqualTypeOf<'OrgBilling.UNPAID'>();
expectTypeOf<OrgBillingErrors['error']>().toEqualTypeOf<'OrgBilling.UNPAID' | 'OrgBilling.FEATURE_RESTRICTED'>();
expectTypeOf<OrgBillingErrors['code']>().toEqualTypeOf<402 | 403>();
expectTypeOf<OrgBillingErrors>().toExtend<DomainError>();

declare const failure: OrgBillingErrors;
if (failure.type === OrgBillingError.Types.UNPAID) {
  expectTypeOf(failure.code).toEqualTypeOf<402>();
  expectTypeOf(failure.error).toEqualTypeOf<'OrgBilling.UNPAID'>();
}
if (failure instanceof OrgBillingError.FeatureRestricted) {
  expectTypeOf(failure.code).toEqualTypeOf<403>();
}
if (failure.code === 403) {
  expectTypeOf(failure.type).toEqualTypeOf<'OrgBilling.FEATURE_RESTRICTED'>();
}

const declarations = { UNPAID: { code: 402 } } as const satisfies DomainErrorDefinitions;
const unpaid = new (defineErrors('Invoice', declarations).Unpaid)();
expectTypeOf(unpaid.error).toEqualTypeOf<'Invoice.UNPAID'>();
// @ts-expect-error A success status cannot declare a domain error.
defineErrors('Billing', { UNPAID: { code: 201 } });
// @ts-expect-error Each declaration supplies its HTTP status.
defineErrors('Billing', { UNPAID: {} });
// @ts-expect-error Only the declared error classes can be constructed.
new OrgBillingError.Unknown();
// @ts-expect-error The declaration fixes the HTTP code for every instance.
new OrgBillingError.Unpaid(403);
// @ts-expect-error The domain's type table is immutable.
OrgBillingError.Types.UNPAID = 'OrgBilling.UNPAID';
