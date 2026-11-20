import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { reassembleItemRequest, splitItemRequest } from '../../src/endpoints/itemRequest.js';
import type { Editable, Id } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class StoredRecord {
  @Prop.string({ crud: 'id' }) key!: Id<string>;
}
class CatalogItem extends StoredRecord {
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
}
class Organization extends StoredRecord {}
const nested = crudRouteMetadata({ ...resolve(CatalogItem), parent: { name: 'Catalog' } });
const tenant = crudRouteMetadata({ ...resolve(Organization), tenancy: 'self' });

describe.each(['Get', 'Delete'] as const)('%s item request', operation => {
  const route = nested.find(route => route.operation === operation)!;

  it('round-trips the parent ID and inherited item key without a body', () => {
    const request = Object.freeze({ catalogId: 42, key: 'item-a' });
    const content = splitItemRequest({ ...route, request });
    expect(content).toEqual({ params: { catalogId: 42, catalogItemId: 'item-a' }, body: {} });
    expectTypeOf(content.body).toEqualTypeOf<Record<string, never>>();
    expect(reassembleItemRequest({ ...route, ...content })).toEqual(request);
    expect(reassembleItemRequest({ ...route, params: Object.freeze(content.params) })).toEqual(request);
  });

  it('requires just the empty request for the tenant’s own route', () => {
    const self = tenant.find(route => route.operation === operation)!;
    expect(self.path).toBe('/organization');
    const content = splitItemRequest({ ...self, request: {} });
    expect(content).toEqual({ params: {}, body: {} });
    expect(reassembleItemRequest({ ...self, ...content })).toEqual({});
    expect(() => splitItemRequest({ ...self, request: { organizationId: 'other' } })).toThrow('item field "organizationId"');
    expect(() => reassembleItemRequest({ ...self, params: { organizationId: 'other' } })).toThrow('no path parameter "organizationId"');
  });

  it('rejects a write field in the flat request or body, and identifies missing or extra parameters', () => {
    const request = { catalogId: 42, key: 'item-a' };
    const params = { catalogId: 42, catalogItemId: 'item-a' };
    expect(() => splitItemRequest({ ...route, request: { ...request, title: 'Updated' } })).toThrow('item field "title"');
    expect(() => splitItemRequest({ ...route, request: { catalogId: 42 } })).toThrow('requires item field "key"');
    expect(() => reassembleItemRequest({ ...route, params: { catalogItemId: 'item-a' } })).toThrow('requires path parameter "catalogId"');
    expect(() => reassembleItemRequest({ ...route, params: { ...params, key: 'duplicate' } })).toThrow('no path parameter "key"');
    // @ts-expect-error Get and Delete accept no body fields.
    expect(() => reassembleItemRequest({ ...route, params, body: { title: 'Updated' } })).toThrow('requires an empty item body');
  });
});

it('supports matching parameter names and checks aliases for the same request field', () => {
  const route = { path: '/reports/:id{/:copy}', paramFields: { copy: 'id' } };
  expect(splitItemRequest({ ...route, request: { id: 0 } })).toEqual({ params: { id: 0, copy: 0 }, body: {} });
  expect(reassembleItemRequest({ ...route, params: { id: 0 } })).toEqual({ id: 0 });
  expect(() => reassembleItemRequest({ ...route, params: { id: 0, copy: 1 } })).toThrow('conflicting path values for item field "id"');
});

it.each([null, [], new Date(), 'payload', { key: undefined }, { [Symbol('hidden')]: true }])(
  'rejects invalid body %j even for an item without parameters', body => {
    // @ts-expect-error Dynamic wire sections must also be checked at runtime.
    expect(() => reassembleItemRequest({ path: '/organization', params: {}, body })).toThrow('requires an empty item body');
  },
);

it('requires object sections and rejects hidden extra fields', () => {
  const path = '/organization';
  expect(() => splitItemRequest({ path, request: [] })).toThrow('Item request must be an object');
  expect(() => reassembleItemRequest({ path, params: [] })).toThrow('Item params must be an object');
  const extra = Object.defineProperty({}, 'title', { value: 'hidden' });
  expect(() => splitItemRequest({ path, request: extra })).toThrow('item field "title"');
  expect(() => reassembleItemRequest({ path, params: extra })).toThrow('no path parameter "title"');
  expect(() => reassembleItemRequest({ path, params: {}, body: extra })).toThrow('requires an empty item body');
});
