import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import { SUCCESS_CODES, successResponseSchema } from '../../src/responses/success.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const record = z.strictObject({ published: dateWireCodec });
const created = successResponseSchema({ code: SUCCESS_CODES.Created, data: record });
const removed = successResponseSchema({ code: SUCCESS_CODES.Ok });

it('round-trips a Create payload and optional message through the endpoint response union', () => {
  const response = responseTypeUnion({ response: created, failures: [409] });
  const decoded = { code: SUCCESS_CODES.Created, data: { published: new Date('2026-01-02T12:00:00Z') }, message: 'Created' };
  const wire = { code: SUCCESS_CODES.Created, data: { published: '2026-01-02T13:00:00+01:00' }, message: 'Created' };
  expect(response.decode(wire)).toEqual(decoded);
  expect(response.encode(decoded)).toEqual({ ...wire, data: { published: '2026-01-02T12:00:00.000Z' } });
  expect(response.safeParse({ code: 201, data: wire.data }).success).toBe(true);
  expect(response.safeParse({ code: 201 }).success).toBe(false);
  expect(response.safeParse({ code: 200, data: wire.data }).success).toBe(false);
  expect(response.safeParse({ ...wire, message: 5 }).success).toBe(false);
  expect(response.safeParse({ ...wire, extra: true }).success).toBe(false);
  expect(response.safeParse({ code: 409, error: 'Record.CONFLICT', traceId: 'request-1' }).success).toBe(true);
  expect(wireInputJsonSchema(created)).toMatchObject({
    additionalProperties: false,
    required: expect.arrayContaining(['code', 'data']),
    properties: { code: { const: 201 }, data: { properties: { published: { type: 'string', format: 'date-time' } } } },
  });
});

it('accepts an empty Delete, including its optional message, and rejects any supplied data', () => {
  expect(removed.decode({ code: 200 })).toEqual({ code: 200 });
  expect(removed.encode({ code: 200, message: 'Removed' })).toEqual({ code: 200, message: 'Removed' });
  const boundary: z.ZodType = removed;
  for (const data of [undefined, null, {}]) {
    expect(boundary.safeDecode({ code: 200, data }).success).toBe(false);
    expect(boundary.safeEncode({ code: 200, data }).success).toBe(false);
  }
  expect(boundary.safeDecode({ code: 201 }).success).toBe(false);
  expect(wireInputJsonSchema(removed)).toMatchObject({ additionalProperties: false, required: ['code'] });
  expect(wireInputJsonSchema(removed).properties).not.toHaveProperty('data');
});

it('requires a declared payload even when its schema can accept or replace a missing value', () => {
  for (const data of [z.unknown(), z.string().nullable(), z.string().optional(), z.string().default('draft'), z.string().catch('draft'), z.coerce.string()]) {
    const boundary: z.ZodType = successResponseSchema({ code: 200, data });
    expect(boundary.safeDecode({ code: 200 }).success).toBe(false);
    expect(boundary.safeEncode({ code: 200 }).success).toBe(false);
    expect(wireInputJsonSchema(boundary).required).toContain('data');
  }
  const nullable = successResponseSchema({ code: 200, data: z.string().nullable() });
  expect(nullable.decode({ code: 200, data: null })).toEqual({ code: 200, data: null });
  expectTypeOf<z.output<typeof nullable>['data']>().toEqualTypeOf<string | null>();
});

it('rejects an unsupported code or an invalid payload schema at definition time', () => {
  // @ts-expect-error The resource framework supports 200 and 201 success envelopes.
  expect(() => successResponseSchema({ code: 204 })).toThrow(ApiDefinitionError);
  // @ts-expect-error A JavaScript caller can supply a value in place of a schema.
  expect(() => successResponseSchema({ code: 201, data: {} })).toThrow(/201.*schema for data/);
});
