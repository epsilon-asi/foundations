import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { reassembleCreateRequest, splitCreateRequest } from '../../src/endpoints/createRequest.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { CreateOnly, Editable, Id } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import type { CreateInput } from '../../src/model/types.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Offering {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  @Prop.date({ crud: 'createOnly' }) startsAt!: CreateOnly<Date>;
  @Prop.boolean({ crud: 'editable' }) enabled!: Editable<boolean>;
}
const model = resolve(Offering);
const top = crudRouteMetadata(model).find(route => route.operation === 'Create')!;
const nested = crudRouteMetadata({ ...model, parent: { name: 'Catalog' } }).find(route => route.operation === 'Create')!;
const input: CreateInput<Offering> = { title: 'Consultation', startsAt: new Date('2026-11-19'), enabled: false };

it('round-trips all decoded create fields in the body of a top-level collection', () => {
  expect(top.path).toBe('/offerings');
  const content = splitCreateRequest({ ...top, request: Object.freeze(input) });
  expect(content).toEqual({ params: {}, body: input });
  expect(content.body).not.toBe(input);
  expect(content.body.startsAt).toBe(input.startsAt);
  expectTypeOf(content.body.startsAt).toEqualTypeOf<Date | undefined>();
  expect(reassembleCreateRequest({ ...top, ...content })).toEqual(input);
  const decoded = reassembleCreateRequest({ ...top, params: {}, body: input });
  expect(decoded).not.toBe(input);
  expectTypeOf(decoded.startsAt).toEqualTypeOf<Date>();
});

it('moves the parent ID out of a nested collection body and restores it on reassembly', () => {
  expect(nested.path).toBe('/catalogs/:catalogId/offerings');
  const request = Object.freeze({ catalogId: 7, ...input });
  const content = splitCreateRequest({ ...nested, request });
  expect(content).toEqual({ params: { catalogId: 7 }, body: input });
  expect(Object.hasOwn(content.body, 'catalogId')).toBe(false);
  const decoded = reassembleCreateRequest({ ...nested, ...content });
  expect(decoded).toEqual(request);
  expect(decoded.startsAt).toBe(request.startsAt);
});

it('respects a custom parent field name and permits an empty create body', () => {
  const route = { ...nested, paramFields: { catalogId: 'parentKey' } };
  const content = splitCreateRequest({ ...route, request: { parentKey: 0 } });
  expect(content).toEqual({ params: { catalogId: 0 }, body: {} });
  expect(reassembleCreateRequest({ ...route, ...content })).toEqual({ parentKey: 0 });
  expect(() => reassembleCreateRequest({ ...route, ...content, body: { parentKey: 0 } })).toThrow('create field "parentKey" in path');
});

it('rejects missing, repeated and undeclared parent parameters', () => {
  expect(() => splitCreateRequest({ ...nested, request: input })).toThrow('requires create field "catalogId"');
  expect(() => reassembleCreateRequest({ ...nested, params: {}, body: input })).toThrow('requires path parameter "catalogId"');
  expect(() => reassembleCreateRequest({ ...nested, params: { catalogId: 7 }, body: { catalogId: 7, ...input } }))
    .toThrow('create field "catalogId" in path parameter "catalogId"');
  expect(() => reassembleCreateRequest({ ...top, params: { offeringId: 'item' }, body: input })).toThrow('no path parameter "offeringId"');
});

it('requires object sections and reads only own create fields', () => {
  expect(() => splitCreateRequest({ ...top, request: [] })).toThrow('Create request must be an object');
  expect(() => reassembleCreateRequest({ ...top, params: [], body: input })).toThrow('Create params must be an object');
  expect(() => reassembleCreateRequest({ ...top, params: {}, body: [] })).toThrow('Create body must be an object');
  const request = Object.assign(Object.create({ catalogId: 'inherited' }), input);
  expect(() => splitCreateRequest({ ...nested, request })).toThrow('requires create field "catalogId"');
  expect(reassembleCreateRequest({ ...top, params: {}, body: request })).toEqual(input);
});
