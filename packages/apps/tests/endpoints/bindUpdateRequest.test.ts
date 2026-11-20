import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Id } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { dateWireCodec } from '../../src/wire/date.js';
import { numberWireCodec } from '../../src/wire/number.js';
import { bindUpdateRequest, type BindUpdateRequestOptions } from '../../src/endpoints/bindUpdateRequest.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { RequestContentOf, RequestOf } from '../../src/endpoints/endpointTypes.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Base {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
}
class Chapter extends Base {}
const route = crudRouteMetadata({ ...resolve(Chapter), name: 'Chapter', parent: { name: 'Book' } })
  .find(item => item.operation === 'Update')!;
const fallback = vi.fn(() => 'draft');
const source = z.strictObject({
  bookId: numberWireCodec, key: z.string().min(1),
  title: z.string().min(1).default(fallback), opens: dateWireCodec.nullable(), tags: z.array(z.string()).prefault(['default']),
  rank: z.int().min(1).catch(1),
}).refine(value => value.title !== 'reserved', 'Reserved title');
const bound = bindUpdateRequest({ route, request: source });
const ids = { bookId: 7, key: 'intro' };
const params = { bookId: '7', chapterId: 'intro' };
const empty = { params, query: {}, body: {}, headers: {} };
const instant = '2026-11-19T12:30:00.000Z';

it('maps the parent and inherited primary key to wire params and round-trips only the supplied PATCH fields', () => {
  const decoded = { ...ids, opens: new Date(instant), tags: [], rank: 3 };
  const wire = { ...empty, body: { opens: instant, tags: [], rank: 3 } };
  const output = bound.toContent(decoded);
  expect(output).toStrictEqual(wire);
  expect(bound.fromContent(wire)).toStrictEqual(decoded);
  expect(bound.RequestContent.decode(wire)).toEqual({ ...wire, params: { bookId: 7, chapterId: 'intro' }, body: { ...wire.body, opens: new Date(instant) } });
  expect(bound.RequestContent.encode(bound.RequestContent.decode(wire))).toStrictEqual(wire);
  expectTypeOf(output.params).toEqualTypeOf<{ bookId: string; chapterId: string }>();
  expectTypeOf<keyof typeof output.body>().toEqualTypeOf<'title' | 'opens' | 'tags' | 'rank'>();
  expectTypeOf<RequestOf<typeof bound>['opens']>().toEqualTypeOf<Date | null | undefined>();
  expectTypeOf<RequestContentOf<typeof bound>['body']['opens']>().toEqualTypeOf<string | null | undefined>();
});

it('never applies create fallbacks on an empty patch and keeps null distinct from omission', () => {
  fallback.mockClear();
  expect(bound.Request.decode({ bookId: '7', key: 'intro' })).toStrictEqual(ids);
  expect(bound.RequestContent.decode(empty)).toStrictEqual({ ...empty, params: { bookId: 7, chapterId: 'intro' } });
  expect(bound.fromContent(empty)).toStrictEqual(ids);
  expect(bound.toContent(ids)).toStrictEqual(empty);
  expect(bound.fromContent({ ...empty, body: { opens: null } })).toStrictEqual({ ...ids, opens: null });
  expect(fallback).not.toHaveBeenCalled();
  expect(source.parse({ bookId: '7', key: 'intro', opens: null })).toMatchObject({ title: 'draft', rank: 1, tags: ['default'] });
});

it('checks supplied fields, whole-patch refinements and the correct section for both IDs', () => {
  expect(() => bound.fromContent({ ...empty, body: { title: '' } })).toThrow();
  expect(() => bound.fromContent({ ...empty, body: { rank: 0 } })).toThrow();
  expect(() => bound.toContent({ ...ids, title: 'reserved' })).toThrow('Reserved title');
  const duplicate = { ...empty, body: { key: 'intro' } };
  // @ts-expect-error The mapped ID belongs only in its path parameter.
  expect(() => bound.fromContent(duplicate)).toThrow(/key.*chapterId/);
  // @ts-expect-error Both source IDs remain required in a decoded PATCH.
  expect(() => bound.toContent({ key: 'intro' })).toThrow();
  // @ts-expect-error Both parameter names remain required in wire content.
  expect(() => bound.fromContent({ ...empty, params: { bookId: '7' } })).toThrow(/chapterId/);
  expect(bound.Request.safeParse({ title: 'Missing IDs' }).success).toBe(false);
  expect(() => bindUpdateRequest({ route, request: z.strictObject({ bookId: numberWireCodec }) })).toThrow(/chapterId.*key/);
});

it('uses identity names on an ordinary route and allows an empty self-resource path', () => {
  const ordinary = crudRouteMetadata({ name: 'Chapter' }).find(item => item.operation === 'Update')!;
  const update = bindUpdateRequest({ route: ordinary, request: z.strictObject({ chapterId: numberWireCodec, title: z.string() }) });
  const wire = update.toContent({ chapterId: 2 });
  expect(wire).toStrictEqual({ params: { chapterId: '2' }, query: {}, body: {}, headers: {} });
  expectTypeOf(wire.params).toEqualTypeOf<{ chapterId: string }>();
  const self = crudRouteMetadata({ name: 'Organization', tenancy: 'self' }).find(item => item.operation === 'Update')!;
  const own = bindUpdateRequest({ route: self, request: z.strictObject({ title: z.string().default('draft') }) });
  const ownWire = own.toContent({});
  expect(ownWire).toStrictEqual({ params: {}, query: {}, body: {}, headers: {} });
  expectTypeOf(ownWire.params).toEqualTypeOf<Record<string, never>>();
  expect(own.fromContent(ownWire)).toStrictEqual({});
});

it('supports widened routes conservatively while validating the actual parent and ID at runtime', () => {
  const dynamic: BindUpdateRequestOptions['route'] = { ...route };
  const update = bindUpdateRequest({ route: dynamic, request: source });
  const wire = update.toContent(ids);
  expect(wire).toEqual(empty);
  expectTypeOf(wire.body.bookId).toEqualTypeOf<string | undefined>();
  expect(() => update.toContent({})).toThrow();
});

it('validates explicitly allowed extra PATCH fields without applying their catchall fallback', () => {
  const self = crudRouteMetadata({ name: 'Workspace', tenancy: 'self' }).find(item => item.operation === 'Update')!;
  const dynamic = bindUpdateRequest({ route: self, request: z.object({}).catchall(z.int().catch(9)) });
  expect(dynamic.fromContent({ params: {}, body: { score: 2 }, query: {}, headers: {} })).toEqual({ score: 2 });
  expect(dynamic.RequestContent.safeParse({ params: {}, body: { score: 'wrong' }, query: {}, headers: {} }).success).toBe(false);
});
