import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Id } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { numberWireCodec } from '../../src/wire/number.js';
import { bindItemRequest } from '../../src/endpoints/bindItemRequest.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { RequestContentOf, RequestOf } from '../../src/endpoints/endpointTypes.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Base {
  @Prop.number({ crud: 'id' }) key!: Id<number>;
}
class Chapter extends Base {}
const routes = crudRouteMetadata({ ...resolve(Chapter), name: 'Chapter', parent: { name: 'Book' } });
const itemRoutes = routes.filter(route => route.operation === 'Get' || route.operation === 'Delete');
const request = z.strictObject({ bookId: numberWireCodec, key: numberWireCodec }).refine(data => data.key > 0, 'Chapter ID must be positive');
const empty = { params: {}, query: {}, body: {}, headers: {} };
const content = { ...empty, params: { bookId: '3', chapterId: '7' } };
const flat = { bookId: 3, key: 7 };

it.each(itemRoutes)('round-trips $operation for a nested item with an inherited custom ID', route => {
  const bound = bindItemRequest({ route, request });
  expect(bound.toContent(flat)).toStrictEqual(content);
  expect(bound.fromContent(content)).toStrictEqual(flat);
  expect(bound.RequestContent.decode(content)).toStrictEqual({ ...empty, params: { bookId: 3, chapterId: 7 } });
  expect(bound.RequestContent.encode(bound.RequestContent.decode(content))).toStrictEqual(content);
  expectTypeOf<RequestOf<typeof bound>>().toEqualTypeOf<typeof flat>();
  expectTypeOf<RequestContentOf<typeof bound>['params']>().toEqualTypeOf<typeof content.params>();
  expectTypeOf<RequestContentOf<typeof bound>['body']>().toEqualTypeOf<Record<string, never>>();
  expect(() => bound.fromContent({ ...empty, params: { bookId: '3', chapterId: '0' } })).toThrow('Chapter ID must be positive');
});

it('uses the empty request for both self routes', () => {
  const self = crudRouteMetadata({ name: 'Organization', tenancy: 'self' }).filter(route => route.operation === 'Get' || route.operation === 'Delete');
  for (const route of self) {
    const bound = bindItemRequest({ route, request: z.strictObject({}) });
    expect(bound.toContent({})).toStrictEqual(empty);
    expect(bound.fromContent(empty)).toStrictEqual({});
    expectTypeOf<RequestContentOf<typeof bound>['params']>().toEqualTypeOf<Record<string, never>>();
    expect(() => bindItemRequest({ route, request: z.strictObject({ id: z.string().optional() }) })).toThrow(/no path parameter.*id/);
  }
});

it('rejects missing, extra and misplaced fields at declaration or conversion', () => {
  const route = itemRoutes[0];
  expect(() => bindItemRequest({ route, request: z.object({ bookId: numberWireCodec }) })).toThrow(/chapterId.*key/);
  expect(() => bindItemRequest({ route, request: z.object({ ...request.shape, title: z.string() }) })).toThrow(/no path parameter.*title/);
  const item = bindItemRequest({ route, request: z.looseObject(request.shape) });
  expect(item.Request.safeParse({ bookId: '3', key: '7', title: 'extra' }).success).toBe(false);
  const withBody = { ...content, body: { key: 7 } };
  // @ts-expect-error Get and Delete have no body fields.
  expect(() => item.fromContent(withBody)).toThrow();
  expect(item.RequestContent.safeParse(withBody).success).toBe(false);
  for (const section of ['query', 'headers'] as const) {
    const misplaced = { ...content, [section]: { another: 'field' } };
    expect(() => item.fromContent(misplaced)).toThrow();
  }
  // @ts-expect-error The nested route requires the book ID.
  expect(() => item.toContent({ key: 7 })).toThrow();
  // @ts-expect-error The path parameter uses the route name, not the flat model key.
  expect(() => item.fromContent({ ...empty, params: { bookId: '3', key: '7' } })).toThrow(/no path parameter/);
  expect(() => item.fromContent({ ...content, params: { ...content.params, another: 'extra' } } as typeof content)).toThrow(/no path parameter/);
});

it('accepts an explicit parent alias and optional groups on an external route', () => {
  const route = { kind: 'crud', operation: 'Get', path: '/books{/:bookId}/chapters/:chapterId', paramFields: { bookId: 'parent', chapterId: 'key' } } as const;
  const item = bindItemRequest({ route, request: z.strictObject({ parent: numberWireCodec.optional(), key: z.string() }) });
  expect(item.toContent({ key: 'a' })).toStrictEqual({ ...empty, params: { chapterId: 'a' } });
  expect(item.fromContent({ ...empty, params: { bookId: '2', chapterId: 'a' } })).toStrictEqual({ parent: 2, key: 'a' });
});
