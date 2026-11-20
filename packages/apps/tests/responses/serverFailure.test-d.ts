import { expectTypeOf } from 'vitest';
import { SERVER_FAILURE_CODES, type ServerFailureResponse } from '../../src/index.js';

const failure: ServerFailureResponse = {
  code: SERVER_FAILURE_CODES.InternalServerError,
  error: 'Server.INTERNAL',
  traceId: 'request-1',
};

expectTypeOf(failure.code).toEqualTypeOf<500>();
expectTypeOf(failure.traceId).toEqualTypeOf<string>();
expectTypeOf<keyof ServerFailureResponse>().toEqualTypeOf<'code' | 'error' | 'traceId'>();

// @ts-expect-error A 503 uses its own response type.
const unavailable: ServerFailureResponse = { ...failure, code: SERVER_FAILURE_CODES.ServiceUnavailable };
// @ts-expect-error A server failure carries the request's trace ID.
const withoutTrace: ServerFailureResponse = { code: 500, error: failure.error };
// @ts-expect-error Wire error identifiers include a domain.
const unqualified: ServerFailureResponse = { ...failure, error: 'INTERNAL' };
// @ts-expect-error Exception messages stay in the server logs.
const withMessage: ServerFailureResponse = { ...failure, message: 'connection failed' };
// @ts-expect-error Stack traces stay in the server logs.
const withStack: ServerFailureResponse = { ...failure, stack: 'at handler' };
// @ts-expect-error Database details stay in the server logs.
const withDetail: ServerFailureResponse = { ...failure, detail: 'constraint failed' };
