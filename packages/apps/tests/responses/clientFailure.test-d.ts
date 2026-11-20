import { expectTypeOf } from 'vitest';
import type { AuthenticationFailureResponse } from '../../src/responses/authenticationFailure.js';
import type { AuthorizationFailureResponse } from '../../src/responses/authorizationFailure.js';
import type { ClientFailureResponse } from '../../src/responses/clientFailure.js';
import type { ConflictFailureResponse } from '../../src/responses/conflictFailure.js';
import type { NotFoundFailureResponse } from '../../src/responses/notFoundFailure.js';
import type { ValidationFailureResponse } from '../../src/responses/validationFailure.js';

type GenericCode = ClientFailureResponse['code'];
expectTypeOf<400 | 402 | 418 | 429 | 499>().toExtend<GenericCode>();
expectTypeOf<Extract<399 | 400.5 | 500 | 503, GenericCode>>().toBeNever();
expectTypeOf<keyof ClientFailureResponse>().toEqualTypeOf<'code' | 'error' | 'traceId'>();

type Specialized = AuthenticationFailureResponse | AuthorizationFailureResponse | NotFoundFailureResponse
  | ConflictFailureResponse | ValidationFailureResponse<'name'>;
type Failure = ClientFailureResponse | Specialized;
expectTypeOf<Extract<GenericCode, Specialized['code']>>().toBeNever();
expectTypeOf<ClientFailureResponse<402>['code']>().toEqualTypeOf<402>();

declare const response: Failure;
if (response.code === 422) {
  expectTypeOf(response).toEqualTypeOf<ValidationFailureResponse<'name'>>();
} else if (response.code === 401) {
  expectTypeOf(response).toEqualTypeOf<AuthenticationFailureResponse>();
} else if (response.code === 429) {
  expectTypeOf(response.code).toEqualTypeOf<429>();
  expectTypeOf(response.error).toEqualTypeOf<`${string}.${string}`>();
  expectTypeOf(response.traceId).toEqualTypeOf<string>();
}

const payment: ClientFailureResponse = { code: 402, error: 'OrgBilling.UNPAID', traceId: 'request-1' };
declare const code: GenericCode;
const fromDeclaredCode: ClientFailureResponse = { ...payment, code };
// @ts-expect-error A validation failure has its own body with field issues.
const validation: ClientFailureResponse = { ...payment, code: 422 };
// @ts-expect-error A wire error identifier includes its domain.
const unqualified: ClientFailureResponse = { ...payment, error: 'UNPAID' };
// @ts-expect-error A client failure carries a public error identifier.
const withoutError: ClientFailureResponse = { code: 400, traceId: 'request-1' };
// @ts-expect-error A client failure carries a string trace ID.
const withoutTrace: ClientFailureResponse = { code: 499, error: 'Client.CLOSED' };
// @ts-expect-error A numeric identifier cannot be the request's trace ID.
const numericTrace: ClientFailureResponse = { ...payment, traceId: 42 };
