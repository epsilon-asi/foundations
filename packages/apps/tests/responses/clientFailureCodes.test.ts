import { expect, expectTypeOf, it } from 'vitest';
import {
  CLIENT_FAILURE_CODES, type AuthenticationFailureResponse, type AuthorizationFailureResponse, type ClientFailureResponse,
  type ConflictFailureResponse, type NotFoundFailureResponse, type ValidationFailureResponse,
} from '../../src/index.js';

it('exports the eight named client failure statuses as a frozen table', () => {
  expect(CLIENT_FAILURE_CODES).toEqual({
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    Conflict: 409,
    UnprocessableEntity: 422,
    TooManyRequests: 429,
  });
  expect(Object.isFrozen(CLIENT_FAILURE_CODES)).toBe(true);
  expectTypeOf<CLIENT_FAILURE_CODES>().toEqualTypeOf<400 | 401 | 402 | 403 | 404 | 409 | 422 | 429>();
  expectTypeOf(CLIENT_FAILURE_CODES.BadRequest).toEqualTypeOf<400>();
  expectTypeOf(CLIENT_FAILURE_CODES.TooManyRequests).toEqualTypeOf<429>();
});

expectTypeOf(CLIENT_FAILURE_CODES.Unauthorized).toEqualTypeOf<AuthenticationFailureResponse['code']>();
expectTypeOf(CLIENT_FAILURE_CODES.Forbidden).toEqualTypeOf<AuthorizationFailureResponse['code']>();
expectTypeOf(CLIENT_FAILURE_CODES.NotFound).toEqualTypeOf<NotFoundFailureResponse['code']>();
expectTypeOf(CLIENT_FAILURE_CODES.Conflict).toEqualTypeOf<ConflictFailureResponse['code']>();
expectTypeOf(CLIENT_FAILURE_CODES.UnprocessableEntity).toEqualTypeOf<ValidationFailureResponse['code']>();
expectTypeOf<Extract<CLIENT_FAILURE_CODES, ClientFailureResponse['code']>>().toEqualTypeOf<400 | 402 | 429>();
expectTypeOf<499>().toExtend<ClientFailureResponse['code']>();
expectTypeOf<499>().not.toExtend<CLIENT_FAILURE_CODES>();
