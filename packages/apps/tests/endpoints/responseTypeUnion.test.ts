import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { defaultFailureCodes } from '../../src/endpoints/defaultFailureCodes.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import { AUTHENTICATION_ERRORS } from '../../src/responses/authenticationFailure.js';
import { SUCCESS_CODES } from '../../src/responses/success.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const created = z.strictObject({ code: z.literal(SUCCESS_CODES.Created), data: dateWireCodec, message: z.string().optional() });
const removed = z.strictObject({ code: z.literal(SUCCESS_CODES.Ok), message: z.string().optional() });
const failures = [400, 401, 402, 403, 404, 409, 418, 422, 429, 499, 500, 503] as const;
const responses = responseTypeUnion({ response: created, failures });
const traceId = 'request-1';

it('retains the success payload codec and the endpoint’s selected success code', () => {
  const instant = new Date('2026-01-02T12:00:00Z');
  const success = { code: SUCCESS_CODES.Created, data: instant, message: 'Saved' };
  expect(responses.decode({ ...success, data: '2026-01-02T13:00:00+01:00' })).toEqual(success);
  expect(responses.encode(success)).toEqual({ ...success, data: instant.toISOString() });
  expect(responses.safeParse({ code: 200, data: instant.toISOString() }).success).toBe(false);
  expect(responses.safeDecode({ code: 201, data: 'tomorrow' }).success).toBe(false);
  expect(responses.safeEncode({ code: 201, data: new Date(NaN) }).success).toBe(false);
});

it('handles a failure without invoking the success payload codec', () => {
  const decode = vi.fn((value: unknown) => value);
  const encode = vi.fn((value: unknown) => value);
  const response = z.strictObject({ code: z.literal(200), data: z.codec(z.unknown(), z.unknown(), { decode, encode }) });
  const union = responseTypeUnion({ response, failures: [404, 500] });
  const body = { code: 404, error: 'Resource.MISSING', traceId } as const;
  expect(union.decode(body)).toEqual(body);
  expect(union.encode(body)).toEqual(body);
  expect(decode).not.toHaveBeenCalled();
  expect(encode).not.toHaveBeenCalled();
});

it.each([400, 402, 403, 404, 409, 418, 429, 499, 500, 503] as const)('round-trips the declared %i failure body', code => {
  const body = { code, error: 'Resource.FAILED', traceId } as const;
  expect(responses.decode(body)).toEqual(body);
  expect(responses.encode(body)).toEqual(body);
});

it.each(Object.values(AUTHENTICATION_ERRORS))('accepts the 401 discriminator %s', error => {
  const body = { code: 401, error, traceId } as const;
  expect(responses.decode(body)).toEqual(body);
  expect(responses.encode(body)).toEqual(body);
});

it('round-trips the 422 issues with their flat field paths', () => {
  const body = {
    code: 422 as const, error: 'Resource.INVALID' as const, traceId,
    issues: [{ path: 'price', code: 'too_small', message: 'Price must be positive' }],
  };
  expect(responses.decode(body)).toEqual(body);
  expect(responses.encode(body)).toEqual(body);
});

it.each([
  { code: 401, error: 'Auth.GET_TOKEN', traceId },
  { code: 403, error: 'FORBIDDEN', traceId },
  { code: 404, error: '.MISSING', traceId },
  { code: 404, error: 'Resource.', traceId },
  { code: 409, error: 'Conflict.INVALID' },
  { code: 418, error: 'Resource.FAILED', traceId: 7 },
  { code: 422, error: 'Resource.INVALID', traceId },
  { code: 422, error: 'Resource.INVALID', traceId, issues: [{ path: ['price'], code: 'bad', message: 'Invalid price' }] },
  { code: 422, error: 'Resource.INVALID', traceId, issues: [{ path: 'price' }] },
  { code: 500, error: 'Server.INTERNAL', traceId, stack: 'private detail' },
  { code: 503, error: 'Server.UNAVAILABLE', traceId, 'Retry-After': '30' },
  { code: 402.5, error: 'Resource.FAILED', traceId },
  { code: 410, error: 'Resource.GONE', traceId },
  { code: 502, error: 'Server.BAD_GATEWAY', traceId },
])('rejects an invalid or unlisted envelope in either direction: %j', body => {
  const boundary: z.ZodType = responses;
  expect(boundary.safeDecode(body).success).toBe(false);
  expect(boundary.safeEncode(body).success).toBe(false);
});

it('keeps Delete empty and accepts the resolved failure list for a public endpoint', () => {
  const deletion = responseTypeUnion({ response: removed, failures: defaultFailureCodes({ path: '/archive', scope: 'public' }) });
  expect(deletion.decode({ code: 200 })).toEqual({ code: 200 });
  expect(deletion.encode({ code: 200, message: 'Removed' })).toEqual({ code: 200, message: 'Removed' });
  expect(deletion.safeParse({ code: 200, data: {} }).success).toBe(false);
  for (const code of [400, 401, 403, 503]) {
    expect(deletion.safeParse({ code, error: 'Auth.UNAUTHENTICATED', traceId }).success).toBe(false);
  }
  expect(deletion.safeParse({ code: 429, error: 'Quota.TOO_MANY', traceId }).success).toBe(true);
  const onlySuccess = responseTypeUnion({ response: removed, failures: [] });
  expect(onlySuccess.safeParse({ code: 429, error: 'Quota.TOO_MANY', traceId }).success).toBe(false);
});

it('describes the success wire format and includes each selected failure only once in JSON Schema', () => {
  const schema = responseTypeUnion({ response: created, failures: [422, 422] });
  expect(wireInputJsonSchema(schema)).toMatchObject({ anyOf: [
    { properties: { code: { const: 422 }, issues: { type: 'array' } }, required: expect.arrayContaining(['issues']) },
    { properties: { code: { const: 201 }, data: { type: 'string', format: 'date-time' } } },
  ] });
});

it.each([200, 399, 400.5, 501, 502, 504, '422', undefined])('rejects an unsupported declaration status %j', code => {
  // @ts-expect-error Untyped callers must also supply a supported integer failure status.
  expect(() => responseTypeUnion({ response: removed, failures: [code] })).toThrow(ApiDefinitionError);
});

it('requires a list of resolved statuses in untyped declarations', () => {
  // @ts-expect-error Failures are resolved before building the endpoint's response union.
  expect(() => responseTypeUnion({ response: removed })).toThrow(ApiDefinitionError);
});
