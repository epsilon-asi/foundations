import { expect, it } from 'vitest';
import { CLIENT_FAILURE_CODES } from '../../src/responses/clientFailureCodes.js';
import { failure, isFailure } from '../../src/responses/failure.js';

it('returns a frozen not-found failure before the HTTP adapter supplies envelope fields', () => {
  const missing = failure.notFound();
  expect(isFailure(missing)).toBe(true);
  expect(missing.code).toBe(CLIENT_FAILURE_CODES.NotFound);
  expect(Object.isFrozen(missing)).toBe(true);
  expect(missing).not.toHaveProperty('traceId');
  expect(missing).not.toHaveProperty('error');
});

it('distinguishes ordinary handler data, wire responses and malformed copies', () => {
  for (const result of [
    undefined, null, 404, { code: 404 }, { kind: 'failure', code: 404 },
    { code: 404, error: 'Resource.NOT_FOUND', traceId: 'request-1' },
    { ...failure.notFound(), code: 200 }, Object.create(failure.notFound()),
  ]) {
    expect(isFailure(result)).toBe(false);
  }
});
