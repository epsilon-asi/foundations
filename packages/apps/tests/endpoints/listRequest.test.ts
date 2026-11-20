import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { reassembleListRequest, splitListRequest } from '../../src/endpoints/listRequest.js';
import type { Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Offering {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @Prop.date({ crud: 'readable' }) availableAt!: Readable<Date>;
}
const model = resolve(Offering);
const list = { filter: { availableAt: ['$gte'] }, search: { fields: ['title'] }, sort: ['title'] } as const;
const top = crudRouteMetadata(model).find(route => route.operation === 'List')!;
const nested = crudRouteMetadata({ ...model, parent: { name: 'Catalog' }, list }).find(route => route.operation === 'List')!;

it('keeps a top-level list entirely in the decoded query section', () => {
  const query = Object.freeze(offsetListQuerySchema().decode({ page: '2', perPage: '5' }));
  const sections = splitListRequest({ ...top, request: query });
  expect(sections).toEqual({ params: {}, query: { page: 2, perPage: 5 } });
  expect(sections.query).not.toBe(query);
  const flat = reassembleListRequest({ ...top, params: sections.params, query });
  expect(flat).toEqual(query);
  expectTypeOf(flat.page).toEqualTypeOf<number>();
});

it('round-trips a model-backed cursor list with a parent ID and decoded search, sort and date filters', () => {
  const schema = cursorListQuerySchema({ model, ...list });
  const date = '2026-11-19T12:30:00.000Z';
  const wire = { cursor: ' next:+/== ', perPage: '7', where: { availableAt: { $gte: date } }, q: 'clinic', orderBy: { title: 'asc' } } as const;
  const query = schema.decode(wire);
  const request = Object.freeze({ catalogId: 42, ...query });
  const sections = splitListRequest({ ...nested, request });
  expect(sections).toEqual({ params: { catalogId: 42 }, query });
  expect(sections.query.where).toBe(query.where);
  expect(sections.query.where?.availableAt?.$gte).toEqual(new Date(date));
  expectTypeOf(sections.query.where?.availableAt?.$gte).toEqualTypeOf<Date | undefined>();
  const content = { ...sections, body: {}, headers: { 'X-Request-Id': 'request' } };
  expect(reassembleListRequest({ ...nested, ...content })).toEqual(request);
  const { catalogId, ...restored } = reassembleListRequest({ ...nested, params: sections.params, query });
  expect(catalogId).toBe(42);
  expect(schema.encode(restored)).toEqual(wire);
});

it('resolves a parent alias in an optional path group and prevents it from appearing in the query', () => {
  const route = { path: '/catalogs{/:catalogId}/offerings', paramFields: { catalogId: 'parentKey' } };
  expect(splitListRequest({ ...route, request: { q: '' } })).toEqual({ params: {}, query: { q: '' } });
  const sections = splitListRequest({ ...route, request: { parentKey: 0, q: 'x' } });
  expect(sections).toEqual({ params: { catalogId: 0 }, query: { q: 'x' } });
  expect(reassembleListRequest({ ...route, ...sections })).toEqual({ parentKey: 0, q: 'x' });
  for (const params of [sections.params, {}]) {
    expect(() => reassembleListRequest({ ...route, params, query: { parentKey: 0 } })).toThrow('list field "parentKey" in path parameter "catalogId"');
  }
});

it('rejects missing or unexpected path parameters and non-object list sections', () => {
  expect(() => splitListRequest({ ...nested, request: { q: 'x' } })).toThrow('requires list field "catalogId"');
  expect(() => reassembleListRequest({ ...nested, params: {}, query: {} })).toThrow('requires path parameter "catalogId"');
  expect(() => reassembleListRequest({ ...top, params: { catalogId: 1 }, query: {} })).toThrow('no path parameter "catalogId"');
  expect(() => splitListRequest({ ...top, request: [] })).toThrow('List request must be an object');
  expect(() => reassembleListRequest({ ...top, params: [], query: {} })).toThrow('List params must be an object');
  expect(() => reassembleListRequest({ ...top, params: {}, query: [] })).toThrow('List query must be an object');
});

it.each([null, [], { title: 'update' }, Object.defineProperty({}, 'hidden', { value: undefined })])(
  'rejects invalid List body %j', body => {
    // @ts-expect-error Only an empty body can accompany a list query.
    expect(() => reassembleListRequest({ ...top, params: {}, query: {}, body })).toThrow('requires an empty list body');
  },
);
