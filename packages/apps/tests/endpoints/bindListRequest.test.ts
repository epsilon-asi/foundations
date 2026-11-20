import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { bindListRequest, type BindListRequestOptions, type BoundListRequest } from '../../src/endpoints/bindListRequest.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { ListQueryOf, RequestContentOf, RequestOf } from '../../src/endpoints/endpointTypes.js';
import type { Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { listQuerySchema } from '../../src/query/listQuerySchema.js';
import { numberWireCodec } from '../../src/wire/number.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Chapter {
  @Prop.string({ crud: 'id' }) key!: Id<string>;
  @Prop.date({ crud: 'readable' }) opens!: Readable<Date>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
}
const model = resolve(Chapter);
const list = { paging: 'cursor', perPage: { default: 7, max: 15 }, filter: { opens: ['$gte'] }, sort: ['title'], search: { fields: ['title'] } } as const;
const route = crudRouteMetadata({ ...model, name: 'Chapter', parent: { name: 'Book' }, list }).find(route => route.operation === 'List')!;
const top = crudRouteMetadata({ name: 'Chapter' }).find(route => route.operation === 'List')!;
const query = listQuerySchema({ model, ...list });
const bound = bindListRequest({ route, query, params: { bookId: numberWireCodec } });
const stamp = '2026-11-19T12:00:00.000Z';
const wire = {
  params: { bookId: '27' },
  query: { cursor: ' next:+/== ', where: { opens: { $gte: stamp } }, q: 'intro', orderBy: { title: 'asc' } },
  body: {}, headers: {},
} as const;
const request = {
  bookId: 27, perPage: 7, cursor: ' next:+/== ', where: { opens: { $gte: new Date(stamp) } }, q: 'intro', orderBy: { title: 'asc' },
} as const;

it('round-trips an opaque cursor and date filter with a parent parameter and the declared page-size default', () => {
  expect(bound.fromContent(wire)).toEqual(request);
  const encoded = { ...wire, query: { ...wire.query, perPage: '7' } };
  expect(bound.toContent(request)).toEqual(encoded);
  const { bookId, ...decodedQuery } = request;
  expect(bound.RequestContent.decode(wire)).toEqual({ params: { bookId }, query: decodedQuery, body: {}, headers: {} });
  expect(bound.Request.decode({ bookId: '27', ...wire.query })).toEqual(request);
  expect(bound.Request.encode(request)).toEqual({ bookId: '27', ...encoded.query });
  expectTypeOf<RequestOf<typeof bound>['bookId']>().toEqualTypeOf<number>();
  expectTypeOf<RequestContentOf<typeof bound>['params']>().toEqualTypeOf<{ bookId: string }>();
  expectTypeOf<ListQueryOf<typeof bound>>().toEqualTypeOf<z.output<typeof query>>();
  expectTypeOf(bound.Request.shape.bookId.decode('27')).toBeNumber();
  expectTypeOf(bound.Request.shape.where).toEqualTypeOf<typeof query.shape.where>();
});

it('uses the top-level offset query directly and resolves generated and aliased string parent fields', () => {
  const offset = listQuerySchema();
  const topLevel = bindListRequest({ route: top, query: offset });
  expect(topLevel.Request).toBe(offset);
  expect(topLevel.fromContent({ params: {}, query: {}, body: {}, headers: {} })).toEqual({ page: 0, perPage: 20 });
  expect(topLevel.toContent({ page: 3, perPage: 11 })).toEqual({ params: {}, query: { page: '3', perPage: '11' }, body: {}, headers: {} });
  expectTypeOf(topLevel.toContent({ page: 0, perPage: 5 }).params).toEqualTypeOf<Record<string, never>>();
  const alias = bindListRequest({ route: { ...route, paramFields: { bookId: 'parentKey' } }, query });
  expect(alias.fromContent({ ...wire, query: {} })).toEqual({ parentKey: '27', perPage: 7 });
  expect(alias.toContent({ parentKey: '27', perPage: 5 }).params).toEqual({ bookId: '27' });
  expectTypeOf<RequestOf<typeof alias>['parentKey']>().toBeString();
  // @ts-expect-error The wire spelling is replaced by the declared alias in the flat request.
  expect(() => alias.toContent({ bookId: '27', perPage: 5 })).toThrow('parentKey');
});

it('allows an indexed alias map to omit the generated parent name', () => {
  const aliases: Record<string, 'parentKey'> = {};
  const indexed = bindListRequest({ route: { ...route, paramFields: aliases }, query });
  const flat = indexed.fromContent({ ...wire, query: {} });
  expect(flat).toEqual({ bookId: '27', perPage: 7 });
  expectTypeOf(flat.perPage).toBeNumber();
  expectTypeOf(flat.bookId).toBeUnknown();
  expectTypeOf(flat.parentKey).toBeUnknown();
});

it('preserves native codec calls and scopes whole-query refinements to query fields', () => {
  const decode = vi.fn((value: string) => Number(value) + 1);
  const encode = vi.fn((value: number) => String(value - 1));
  const threshold = z.codec(z.string(), z.number(), { decode, encode });
  const custom = listQuerySchema().safeExtend({ threshold }).refine(values =>
    !Object.hasOwn(values, 'bookId') && values.threshold > values.page, { message: 'threshold must exceed page' });
  const converted = bindListRequest({ route, query: custom, params: { bookId: numberWireCodec } });
  const wire = { params: { bookId: '2' }, query: { threshold: '8', page: '1', perPage: '4' }, body: {}, headers: {} };
  const decoded = { bookId: 2, threshold: 9, page: 1, perPage: 4 };
  // Zod prevalidates before encoding an object with a refinement.
  const { bookId, ...decodedQuery } = decoded;
  expect(custom.encode(decodedQuery)).toEqual(wire.query);
  const nativeEncodes = encode.mock.calls.length;
  encode.mockClear();
  expect(converted.fromContent(wire)).toEqual(decoded);
  expect(decode).toHaveBeenCalledTimes(1);
  expect(converted.toContent(decoded)).toEqual(wire);
  expect(encode).toHaveBeenCalledTimes(nativeEncodes);
  expect(converted.Request.decode({ bookId: '2', ...wire.query })).toEqual(decoded);
  expect(decode).toHaveBeenCalledTimes(2);
  expect(converted.Request.encode(decoded)).toEqual({ bookId: '2', ...wire.query });
  expect(encode).toHaveBeenCalledTimes(2 * nativeEncodes);
  expect(() => converted.fromContent({ ...wire, query: { ...wire.query, page: '12' } })).toThrow('threshold must exceed page');
  expect(() => converted.toContent({ ...decoded, page: 12 })).toThrow('threshold must exceed page');
  expect(converted.Request.safeEncode({ ...decoded, page: 12 }).success).toBe(false);
  expect(converted.Request.safeParse({ ...wire.query, bookId: 'bad' }).success).toBe(false);
  expect(converted.Request.safeParse(wire.query).success).toBe(false);
});

it('rejects missing, extra or misplaced fields in either direction and bad date operands', () => {
  const invalid = [
    { ...wire, params: {} }, { ...wire, params: { bookId: 'x' } },
    { ...wire, params: { bookId: '1', extra: '1' } }, { ...wire, query: { bookId: '2' } },
    { ...wire, query: { page: '2' } }, { ...wire, query: { perPage: '17' } },
    { ...wire, query: { where: { opens: { $gte: 'bad' } } } },
    { ...wire, body: { title: 'no' } }, { ...wire, headers: { extra: 'no' } },
    { ...wire, extra: {} }, { params: wire.params, query: {}, body: {} },
  ];
  for (const content of invalid) {
    // @ts-expect-error Malformed wire content can reach the binder from JavaScript.
    expect(() => bound.fromContent(content)).toThrow();
    expect(bound.RequestContent.safeParse(content).success).toBe(false);
  }
  const extra = { ...request, stray: 2 };
  expect(() => bound.toContent(extra)).toThrow();
  // @ts-expect-error The flat filter holds a decoded Date.
  expect(() => bound.toContent({ ...request, where: { opens: { $gte: stamp } } })).toThrow();
  // @ts-expect-error Declared wire dates are strings.
  expect(() => bound.fromContent({ ...wire, query: { where: { opens: { $gte: new Date() } } } })).toThrow();
  const header = { ...wire, headers: Object.defineProperty({}, 'bad', { value: 1 }) };
  expect(() => bound.fromContent(header)).toThrow('enumerable string fields');
});

it('rejects conflicting declarations and reserves parent fields even under an explicit query catchall', () => {
  expect(() => bindListRequest({ route, query, params: { typo: z.string() } })).toThrow('no List path parameter');
  expect(() => bindListRequest({ route, query: query.safeExtend({ bookId: z.string() }) })).toThrow(/bookId.*path parameter/);
  // @ts-expect-error Only the List operation can bind its query here.
  expect(() => bindListRequest({ route: { ...route, operation: 'Delete' }, query })).toThrow('CRUD List route');
  const open = bindListRequest({ route, query: z.object({}).catchall(z.string()) });
  const valid = { params: { bookId: '7' }, query: { note: 'ok' }, body: {}, headers: {} };
  expect(open.fromContent(valid)).toEqual({ bookId: '7', note: 'ok' });
  const conflict = { ...valid, query: { bookId: '8' } };
  expect(() => open.fromContent(conflict)).toThrow(/bookId.*path parameter/);
  expect(open.RequestContent.safeParse(conflict).success).toBe(false);
});

export function bindGenericList<O extends BindListRequestOptions>(options: O): BoundListRequest<O> {
  return bindListRequest(options);
}
