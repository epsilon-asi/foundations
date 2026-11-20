import { expect, it } from 'vitest';
import type { UnavailableFailureHttpResponse } from '../../src/responses/unavailableFailure.js';

it.each(['30', 'Wed, 21 Oct 2015 07:28:00 GMT'])('carries Retry-After %s in the 503 response headers', async retryAfter => {
  const { body, headers }: UnavailableFailureHttpResponse = {
    body: { code: 503, error: 'Session.UNAVAILABLE', traceId: 'request-1' },
    headers: { 'Retry-After': retryAfter },
  };
  const response = Response.json(body, { status: body.code, headers });

  expect(response.status).toBe(503);
  expect(response.headers.get('Retry-After')).toBe(retryAfter);
  expect(await response.json()).toEqual({ code: 503, error: 'Session.UNAVAILABLE', traceId: 'request-1' });
});
