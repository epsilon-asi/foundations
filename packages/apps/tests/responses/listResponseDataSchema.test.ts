import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import type { Readable } from '../../src/model/access.js';
import type { ListPaging } from '../../src/query/listQuerySchema.js';
import type { CursorListResponseData } from '../../src/responses/cursorListResponseData.js';
import { listResponseDataSchema, type ListResponseDataSchemaOptions } from '../../src/responses/listResponseDataSchema.js';
import type { OffsetListResponseData } from '../../src/responses/offsetListResponseData.js';
import { successResponseSchema } from '../../src/responses/success.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const row = z.strictObject({ joinedAt: dateWireCodec });
type Person = { joinedAt: Readable<Date> };
const people = { name: 'Person', plural: 'People', row } as const;
const offset = listResponseDataSchema(people);
const cursor = listResponseDataSchema({ ...people, paging: 'cursor' });
const instant = '2026-11-19T12:30:00.000Z';

it('derives the collection key, requires the count and round-trips each offset row codec', () => {
  const wire = { people: [{ joinedAt: instant }], count: 150 };
  const decoded = offset.decode(wire);
  expect(decoded).toEqual({ people: [{ joinedAt: new Date(instant) }], count: 150 });
  expect(offset.encode(decoded)).toEqual(wire);
  expectTypeOf<z.output<typeof offset>>().toEqualTypeOf<OffsetListResponseData<Person, typeof people>>();
  expectTypeOf<z.input<typeof offset>['people']>().toEqualTypeOf<{ joinedAt: string }[]>();
  expect(offset.decode({ people: [], count: 0 })).toEqual({ people: [], count: 0 });
  const defaults = listResponseDataSchema({ name: 'ApiKey', row });
  expect(defaults.parse({ apiKeys: [], count: Number.MAX_SAFE_INTEGER })).toEqual({ apiKeys: [], count: Number.MAX_SAFE_INTEGER });
  expectTypeOf<keyof z.output<typeof defaults>>().toEqualTypeOf<'apiKeys' | 'count'>();
});

it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, '1', null])('rejects invalid totals in either direction', count => {
  const boundary: z.ZodType = offset;
  const payload = { people: [], count };
  expect(boundary.safeDecode(payload).error?.issues[0].path).toEqual(['count']);
  expect(boundary.safeEncode(payload).error?.issues[0].path).toEqual(['count']);
});

it.each(['', ' next:+/%2F== ', null])('round-trips the exact cursor or the final-page null', nextCursor => {
  const wire = { people: [{ joinedAt: instant }], nextCursor };
  const decoded = cursor.decode(wire);
  expect(decoded).toEqual({ people: [{ joinedAt: new Date(instant) }], nextCursor });
  expect(cursor.encode(decoded)).toEqual(wire);
  expectTypeOf<z.output<typeof cursor>>().toEqualTypeOf<CursorListResponseData<Person, typeof people>>();
  expectTypeOf<z.input<typeof cursor>['nextCursor']>().toEqualTypeOf<string | null>();
});

it('requires the declared collection and paging field and rejects extra fields', () => {
  for (const [schema, paging, other] of [[offset, { count: 0 }, { nextCursor: null }], [cursor, { nextCursor: null }, { count: 0 }]] as const) {
    for (const payload of [paging, { people: [] }, { people: 'none', ...paging }, { persons: [], ...paging },
      { people: [], ...other }, { people: [], ...paging, ...other }, { people: [], ...paging, extra: true }]) {
      expect(schema.safeParse(payload).success).toBe(false);
    }
    expect(schema.safeParse({ people: [{ joinedAt: 4 }], ...paging }).error?.issues[0].path).toEqual(['people', 0, 'joinedAt']);
  }
  expect(cursor.safeParse({ people: [], nextCursor: false }).success).toBe(false);
});

it('reports a collection key that would overwrite the active paging field', () => {
  const colliding = () => listResponseDataSchema({ ...people, plural: 'Count' });
  expect(colliding).toThrow(ApiDefinitionError);
  expect(colliding).toThrow(/Person.*count.*offset/);
  expectTypeOf<z.output<ReturnType<typeof colliding>>>().toBeNever();
  expect(() => listResponseDataSchema({ ...people, plural: 'NextCursor', paging: 'cursor' })).toThrow(/Person.*nextCursor.*cursor/);
  expect(listResponseDataSchema({ ...people, plural: 'Count', paging: 'cursor' }).decode({ count: [], nextCursor: null })).toEqual({ count: [], nextCursor: null });
  expect(listResponseDataSchema({ ...people, plural: 'NextCursor' }).decode({ nextCursor: [], count: 0 })).toEqual({ nextCursor: [], count: 0 });
  // @ts-expect-error Unchecked consumers get the same invalid-mode error as the list query selector.
  expect(() => listResponseDataSchema({ ...people, paging: 'pages' })).toThrow(/paging.*offset.*cursor/);
});

it('validates the List payload inside the 200 envelope and the endpoint response union', () => {
  const response = successResponseSchema({ code: 200, data: cursor });
  const schema = responseTypeUnion({ response, failures: [404] });
  const wire = { code: 200 as const, data: { people: [{ joinedAt: instant }], nextCursor: null } };
  const decoded = schema.decode(wire);
  expect(decoded).toEqual({ code: 200, data: { people: [{ joinedAt: new Date(instant) }], nextCursor: null } });
  expect(schema.encode(decoded)).toEqual(wire);
  expectTypeOf<Extract<z.output<typeof schema>, { code: 200 }>['data']>().toEqualTypeOf<z.output<typeof cursor>>();
  expect(schema.safeParse({ code: 200, data: { people: [], count: 0 } }).success).toBe(false);
  const failure = { code: 404, error: 'person.MISSING', traceId: 'request' } as const;
  expect(schema.decode(failure)).toEqual(failure);
  expect(wireInputJsonSchema(response)).toMatchObject({ properties: { data: {
    additionalProperties: false, required: expect.arrayContaining(['people', 'nextCursor']),
    properties: { people: { type: 'array', items: { properties: { joinedAt: { type: 'string', format: 'date-time' } } } } },
  } } });
});

it('requires the declared read-row schema even on an empty page', () => {
  // @ts-expect-error A runtime caller may omit the required schema.
  expect(() => listResponseDataSchema({ name: 'Person' })).toThrow(/Person.*row schema/);
});

it('preserves possible keys and paging fields on widened and generic declarations', () => {
  function fromOptions<const Options extends ListResponseDataSchemaOptions>(options: Options) {
    return listResponseDataSchema(options);
  }
  function withPaging(paging?: ListPaging) { return fromOptions({ ...people, paging }); }
  expectTypeOf<z.output<ReturnType<typeof withPaging>>>().toEqualTypeOf<z.output<typeof offset> | z.output<typeof cursor>>();
  expect(withPaging().parse({ people: [], count: 0 })).toEqual({ people: [], count: 0 });
  expect(withPaging('cursor').parse({ people: [], nextCursor: null })).toEqual({ people: [], nextCursor: null });
  function withPlural(plural?: 'People') { return fromOptions({ name: 'Person', plural, row }); }
  expectTypeOf<z.output<ReturnType<typeof withPlural>>>().toEqualTypeOf<OffsetListResponseData<Person, { name: 'Person'; plural?: 'People' }>>();
  expect(withPlural().parse({ persons: [], count: 4 })).toEqual({ persons: [], count: 4 });
  function dynamic(name: string, plural: string, paging: 'cursor') { return fromOptions({ name, plural, row, paging }); }
  expectTypeOf<z.output<ReturnType<typeof dynamic>>['nextCursor']>().toEqualTypeOf<string | null>();
});
