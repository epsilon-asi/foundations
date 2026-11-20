import { expectTypeOf } from 'vitest';
import type { ServerFailureResponse } from '../../src/responses/serverFailure.js';
import { SERVER_FAILURE_CODES } from '../../src/responses/serverFailureCodes.js';
import type { UnavailableFailureHttpResponse, UnavailableFailureResponse } from '../../src/responses/unavailableFailure.js';

const body: UnavailableFailureResponse = {
  code: SERVER_FAILURE_CODES.ServiceUnavailable,
  error: 'Session.UNAVAILABLE',
  traceId: 'request-1',
};

expectTypeOf(body.code).toEqualTypeOf<503>();
expectTypeOf(body.traceId).toEqualTypeOf<string>();
expectTypeOf<keyof UnavailableFailureResponse>().toEqualTypeOf<'code' | 'error' | 'traceId'>();
expectTypeOf<Extract<ServerFailureResponse | UnavailableFailureResponse, { code: 503 }>>().toEqualTypeOf<UnavailableFailureResponse>();

const withHeader: UnavailableFailureHttpResponse = { body, headers: { 'Retry-After': '30', 'Content-Type': 'application/json' } };
expectTypeOf(withHeader.headers['Retry-After']).toEqualTypeOf<string>();

// @ts-expect-error An unexpected server error belongs to the 500 response type.
const wrongCode: UnavailableFailureResponse = { ...body, code: 500 };
// @ts-expect-error The response carries the request's trace ID.
const withoutTrace: UnavailableFailureResponse = { code: 503, error: 'Session.UNAVAILABLE' };
// @ts-expect-error A wire error identifier includes its domain.
const unqualified: UnavailableFailureResponse = { ...body, error: 'UNAVAILABLE' };
// @ts-expect-error The retry header belongs to the HTTP response.
const retryInBody: UnavailableFailureResponse = { ...body, 'Retry-After': '30' };
// @ts-expect-error The transport must supply the retry header.
const withoutRetry: UnavailableFailureHttpResponse = { body, headers: {} };
// @ts-expect-error A body alone cannot describe the complete HTTP response.
const withoutHeaders: UnavailableFailureHttpResponse = { body };
