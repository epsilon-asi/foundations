import { expectTypeOf } from 'vitest';
import type { NotFoundFailureResponse } from '../../src/index.js';

const missing: NotFoundFailureResponse = {
  code: 404,
  error: 'Offering.NOT_FOUND',
  traceId: 'request-1',
};

expectTypeOf(missing.code).toEqualTypeOf<404>();
expectTypeOf(missing.traceId).toEqualTypeOf<string>();

// @ts-expect-error A forbidden response has its own status and type.
const forbidden: NotFoundFailureResponse = { ...missing, code: 403 };
// @ts-expect-error A lookup failure carries the request's trace ID.
const withoutTrace: NotFoundFailureResponse = { code: 404, error: missing.error };
// @ts-expect-error Wire error identifiers include a domain.
const unqualified: NotFoundFailureResponse = { ...missing, error: 'NOT_FOUND' };
