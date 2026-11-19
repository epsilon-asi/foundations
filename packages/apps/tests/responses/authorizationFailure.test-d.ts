import { expectTypeOf } from 'vitest';
import type { AuthorizationFailureResponse } from '../../src/index.js';

const forbidden: AuthorizationFailureResponse = {
  code: 403,
  error: 'Offering.PERMISSION_REQUIRED',
  traceId: 'request-1',
};

expectTypeOf(forbidden.code).toEqualTypeOf<403>();
expectTypeOf<AuthorizationFailureResponse['error']>().toEqualTypeOf<`${string}.${string}`>();

// @ts-expect-error Every authorization failure carries a trace ID.
const missingTrace: AuthorizationFailureResponse = { code: 403, error: forbidden.error };
// @ts-expect-error A cross-tenant lookup returns 404.
const crossTenant: AuthorizationFailureResponse = { ...forbidden, code: 404 };
// @ts-expect-error Wire error identifiers include a domain.
const unqualified: AuthorizationFailureResponse = { ...forbidden, error: 'PERMISSION_REQUIRED' };
