import { expectTypeOf } from 'vitest';
import type { AuthenticationFailureResponse } from '../../src/index.js';

const unauthenticated: AuthenticationFailureResponse = {
  code: 401,
  error: 'Auth.UNAUTHENTICATED',
  traceId: 'request-1',
};
const expired: AuthenticationFailureResponse = { ...unauthenticated, error: 'Auth.TOKEN_EXPIRED' };

expectTypeOf<AuthenticationFailureResponse['error']>().toEqualTypeOf<'Auth.UNAUTHENTICATED' | 'Auth.TOKEN_EXPIRED'>();
expectTypeOf(expired.code).toEqualTypeOf<401>();

// @ts-expect-error Every authentication failure carries a trace ID.
const missingTrace: AuthenticationFailureResponse = { code: 401, error: 'Auth.TOKEN_EXPIRED' };
// @ts-expect-error A 403 is an authorization failure.
const wrongStatus: AuthenticationFailureResponse = { ...unauthenticated, code: 403 };
// @ts-expect-error Only the two authentication error codes are accepted.
const unrelatedError: AuthenticationFailureResponse = { ...unauthenticated, error: 'OrgBilling.UNPAID' };
