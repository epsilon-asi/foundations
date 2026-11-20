import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import { defaultFailureCodes } from '../../src/endpoints/defaultFailureCodes.js';
import type { ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import { responseTypeUnion, type ResponseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import type { AuthenticationFailureResponse } from '../../src/responses/authenticationFailure.js';
import type { ClientFailureResponse } from '../../src/responses/clientFailure.js';
import type { ValidationFailureResponse } from '../../src/responses/validationFailure.js';
import { dateWireCodec } from '../../src/wire/date.js';

const created = z.strictObject({ code: z.literal(201), data: z.object({ published: dateWireCodec }) });
const schema = responseTypeUnion({ response: created, failures: [401, 418, 422, 429] });
type Response = z.output<typeof schema>;
type Wire = z.input<typeof schema>;
expectTypeOf(schema).toEqualTypeOf<ResponseTypeUnion<typeof created, 401 | 418 | 422 | 429>>();
expectTypeOf<Response['code']>().toEqualTypeOf<201 | 401 | 418 | 422 | 429>();
expectTypeOf<Extract<Response, { code: 201 }>['data']>().toEqualTypeOf<{ published: Date }>();
expectTypeOf<Extract<Wire, { code: 201 }>['data']>().toEqualTypeOf<{ published: string }>();
expectTypeOf<Extract<Response, { code: 401 }>>().toEqualTypeOf<AuthenticationFailureResponse>();
expectTypeOf<Extract<Response, { code: 418 }>>().toEqualTypeOf<ClientFailureResponse<418>>();
declare const result: Response;
if (result.code === 422) expectTypeOf(result).toEqualTypeOf<ValidationFailureResponse>();

const deleted = z.strictObject({ code: z.literal(200), message: z.string().optional() });
const successOnly = responseTypeUnion({ response: deleted, failures: [] });
expectTypeOf<z.input<typeof successOnly>>().toEqualTypeOf<z.input<typeof deleted>>();
expectTypeOf<z.output<typeof successOnly>>().toEqualTypeOf<z.output<typeof deleted>>();

const publicDefaults = defaultFailureCodes({ path: '/reports/:id', scope: 'public' });
const publicEndpoint = { ResponseTypeUnion: responseTypeUnion({ response: created, failures: publicDefaults }) };
type PublicResponse = ResponseTypeUnionOf<typeof publicEndpoint>;
expectTypeOf<PublicResponse['code']>().toEqualTypeOf<201 | 402 | 404 | 409 | 422 | 429 | 500>();
expectTypeOf<Extract<PublicResponse, { code: 201 }>>().toEqualTypeOf<z.output<typeof created>>();
expectTypeOf<Extract<PublicResponse, { code: 422 }>>().toEqualTypeOf<ValidationFailureResponse>();
expectTypeOf<Extract<PublicResponse, { code: 400 | 401 | 403 | 503 }>>().toBeNever();
// @ts-expect-error A public endpoint must explicitly add a 401 to its derived failures.
publicEndpoint.ResponseTypeUnion.encode({ code: 401, error: 'Auth.UNAUTHENTICATED', traceId: 'request-1' });
const publicRefresh = responseTypeUnion({ response: created, failures: [...publicDefaults, 401] });
expectTypeOf<Extract<z.output<typeof publicRefresh>, { code: 401 }>>().toEqualTypeOf<AuthenticationFailureResponse>();

// @ts-expect-error A decoded success holds a Date.
schema.encode({ code: 201, data: { published: '2026-01-02T12:00:00Z' } });
// @ts-expect-error Only the selected failure codes belong to this endpoint.
schema.decode({ code: 403, error: 'Auth.FORBIDDEN', traceId: 'request-1' });
// @ts-expect-error A 422 requires its flat field issues.
schema.encode({ code: 422, error: 'Resource.INVALID', traceId: 'request-1' });
// @ts-expect-error The success schema must describe a success envelope.
responseTypeUnion({ response: z.object({ code: z.literal(404) }), failures: [] });
