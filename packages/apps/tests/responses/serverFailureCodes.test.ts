import { expect, expectTypeOf, it } from 'vitest';
import { SERVER_FAILURE_CODES } from '../../src/responses/serverFailureCodes.js';

it('exposes the two server failure codes as a frozen table', () => {
  expect(SERVER_FAILURE_CODES).toEqual({ InternalServerError: 500, ServiceUnavailable: 503 });
  expect(Object.isFrozen(SERVER_FAILURE_CODES)).toBe(true);
  expectTypeOf(SERVER_FAILURE_CODES.InternalServerError).toEqualTypeOf<500>();
  expectTypeOf(SERVER_FAILURE_CODES.ServiceUnavailable).toEqualTypeOf<503>();
  expectTypeOf<SERVER_FAILURE_CODES>().toEqualTypeOf<500 | 503>();
  expectTypeOf<409>().not.toExtend<SERVER_FAILURE_CODES>();
});
