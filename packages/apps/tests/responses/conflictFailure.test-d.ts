import { expectTypeOf } from 'vitest';
import type { ConflictFailureResponse } from '../../src/index.js';

const conflict: ConflictFailureResponse = {
  code: 409,
  error: 'Idempotency.IN_PROGRESS',
  traceId: 'request-1',
};

expectTypeOf(conflict.code).toEqualTypeOf<409>();
expectTypeOf(conflict.traceId).toEqualTypeOf<string>();

// @ts-expect-error A missing resource uses its own response type.
const missing: ConflictFailureResponse = { ...conflict, code: 404 };
// @ts-expect-error A conflict carries the request's trace ID.
const withoutTrace: ConflictFailureResponse = { code: 409, error: conflict.error };
// @ts-expect-error Wire error identifiers include a domain.
const unqualified: ConflictFailureResponse = { ...conflict, error: 'IN_PROGRESS' };
