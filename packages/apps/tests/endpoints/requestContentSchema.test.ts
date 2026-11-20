import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { ListQueryOf, RequestContentOf } from '../../src/endpoints/endpointTypes.js';
import { requestContentSchema } from '../../src/endpoints/requestContentSchema.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const params = z.strictObject({ reportId: z.string() });
const query = z.strictObject({ asOf: dateWireCodec });
const headers = z.strictObject({ 'X-Organization-Id': z.string() });
const get = { RequestContent: requestContentSchema({ params, query, headers }) };
const wire = { params: { reportId: 'report-1' }, query: { asOf: '2026-11-01T13:00:00+01:00' }, body: {}, headers: { 'X-Organization-Id': 'org-1' } };

it('decodes and re-encodes a Get query while carrying the declared params and headers', () => {
  const decoded = get.RequestContent.decode(wire);
  expect(decoded).toEqual({ ...wire, query: { asOf: new Date('2026-11-01T12:00:00Z') } });
  expect(get.RequestContent.encode(decoded)).toEqual({ ...wire, query: { asOf: '2026-11-01T12:00:00.000Z' } });
  expectTypeOf<RequestContentOf<typeof get>['query']>().toEqualTypeOf<{ asOf: string }>();
  expectTypeOf(decoded.query).toEqualTypeOf<{ asOf: Date }>();
  expectTypeOf<ListQueryOf<{ operation: 'List'; RequestContent: typeof get.RequestContent }>>().toEqualTypeOf<{ asOf: Date }>();
  expect(wireInputJsonSchema(get.RequestContent)).toMatchObject({
    additionalProperties: false,
    required: ['params', 'query', 'body', 'headers'],
    properties: { query: { properties: { asOf: { type: 'string', format: 'date-time' } } }, body: { additionalProperties: false } },
  });
});

it('rejects unexpected Get bodies and unknown top-level sections', () => {
  const result = get.RequestContent.safeParse({ ...wire, body: { note: 'unexpected' } });
  expect(result.error?.issues).toMatchObject([{ code: 'unrecognized_keys', path: ['body'], keys: ['note'] }]);
  // @ts-expect-error The undeclared body does not accept fields.
  expect(get.RequestContent.safeEncode({ ...get.RequestContent.decode(wire), body: { note: 'unexpected' } }).success).toBe(false);
  expect(get.RequestContent.safeParse({ ...wire, cookies: {} }).success).toBe(false);
});

it('requires all four sections and defaults each undeclared section to a strict empty object', () => {
  const empty = requestContentSchema();
  const content = { params: {}, query: {}, body: {}, headers: {} };
  expect(empty.decode(content)).toEqual(content);
  expectTypeOf<z.input<typeof empty>>().toEqualTypeOf<Record<keyof typeof content, Record<string, never>>>();
  for (const section of ['params', 'query', 'body', 'headers'] as const) {
    const { [section]: _, ...missing } = content;
    expect(empty.safeParse(missing).success).toBe(false);
    expect(empty.safeParse({ ...content, [section]: { extra: true } }).success).toBe(false);
    expect(empty.safeParse({ ...content, [section]: undefined }).success).toBe(false);
  }
});

it('requires a whole declared section even when its schema would supply a fallback', () => {
  const body = z.strictObject({ title: z.string() });
  for (const declared of [body.optional(), body.default({ title: 'Draft' }), body.catch({ title: 'Draft' })]) {
    const schema: z.ZodType = requestContentSchema({ body: declared });
    const missing = { params: {}, query: {}, headers: {} };
    expect(schema.safeDecode(missing).success).toBe(false);
    expect(schema.safeEncode(missing).success).toBe(false);
    expect(schema.decode({ ...missing, body: { title: 'Report' } })).toEqual({ ...missing, body: { title: 'Report' } });
  }
});

it('retains an optional declaration and uses the empty section when it is omitted', () => {
  const create = (sections?: { query?: typeof query }) => requestContentSchema(sections);
  type Content = z.input<ReturnType<typeof create>>;
  expectTypeOf<Content['query']>().toEqualTypeOf<{ asOf: string } | Record<string, never>>();
  expectTypeOf<Content['body']>().toEqualTypeOf<Record<string, never>>();
  expectTypeOf<Content>().toEqualTypeOf<Required<Content>>();
  const empty = { params: {}, query: {}, body: {}, headers: {} };
  expect(create().safeParse(empty).success).toBe(true);
  expect(create({ query }).safeParse(empty).success).toBe(false);
});

it.each(['params', 'query', 'body', 'headers'] as const)('identifies an invalid %s section at definition time', section => {
  const define = () => requestContentSchema({ [section]: 'invalid' });
  expect(define).toThrow(ApiDefinitionError);
  expect(define).toThrow(`Request content section "${section}" requires a Zod schema.`);
});
