import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { RequestOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import type { Defaulted, Editable, Id } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';

const supported = { Delete: false, Update: false, List: false } as const;

it('round-trips a validated, inherited ID under the declared item parameter', () => {
  const { Resource, Prop, endpoints } = createResourceSystem({ roles: ['VIEWER'] });
  class Row {
    @Prop.number({ crud: 'id', min: 1 }) key!: Id<number>;
  }
  @Resource()
  class Asset extends Row {}
  const onlyGet = endpoints(Asset, { name: 'Asset', operations: { ...supported, Create: false } });
  expect(Object.keys(onlyGet)).toEqual(['GetAsset']);
  const fromSettings = (operations: typeof supported & Record<string, unknown>) =>
    endpoints(Asset, { name: 'Asset', operations });
  type OptionalGet = ReturnType<typeof fromSettings>['GetAsset'];
  expectTypeOf<undefined>().toExtend<OptionalGet>();
  expect(fromSettings({ ...supported, Create: true, Get: false }).GetAsset).toBeUndefined();
  expectTypeOf<keyof typeof onlyGet>().toEqualTypeOf<'GetAsset'>();
  const { GetAsset } = onlyGet;
  expectTypeOf<RequestOf<typeof GetAsset>>().toEqualTypeOf<{ key: number }>();
  expectTypeOf(GetAsset.Route.paramFields.assetId).toEqualTypeOf<'key'>();
  const wire = GetAsset.toContent({ key: 23 });
  expect(wire).toEqual({ params: { assetId: '23' }, query: {}, body: {}, headers: {} });
  expect(GetAsset.fromContent(wire)).toEqual({ key: 23 });
  expect(GetAsset.Request.safeParse({ assetId: 23 }).success).toBe(false);
  expect(GetAsset.Request.safeParse({ key: 0 }).success).toBe(false);
  for (const params of [{}, { key: '23' }, { assetId: '0' }, { assetId: 23 }, { assetId: '23', extra: 'x' }]) {
    expect(GetAsset.RequestContent.safeParse({ ...wire, params }).success).toBe(false);
  }
  for (const section of ['headers', 'body', 'query']) {
    expect(GetAsset.RequestContent.safeParse({ ...wire, [section]: { key: '23' } }).success).toBe(false);
  }
});

it('declares the read rule and 200 response independently of Create and its write fields', () => {
  const resources = createResourceSystem({ roles: ['VIEWER', 'EDITOR'] });
  const { Prop, Resource, endpoints } = resources;
  @Resource()
  class RecordItem {
    @Prop.uuid({ crud: 'id' }) id!: Id<string>;
    @Prop.string({ crud: 'editable' }) name!: Editable<string>;
    @Prop.string() hidden!: string;
  }
  const pair = endpoints(RecordItem, {
    name: 'RecordItem', operations: { ...supported, Create: true, Get: { scope: 'public' } },
    access: { read: 'VIEWER', write: 'EDITOR', fields: { name: { write: 'EDITOR' } } },
  });
  expect(resources.declaredEndpoints).toEqual([pair.CreateRecordItem, pair.GetRecordItem]);
  const get = pair.GetRecordItem;
  expectTypeOf(get.Method).toEqualTypeOf<'get'>();
  expectTypeOf(get.Access).toEqualTypeOf<'VIEWER'>();
  expectTypeOf(get.Route.scope).toEqualTypeOf<'public'>();
  expectTypeOf<ResponseTypeUnionOf<typeof get>['code']>().toEqualTypeOf<200 | 404 | 422 | 429 | 500>();
  expect(get).toMatchObject({ Method: 'get', Access: 'VIEWER', Path: '/record-items/:recordItemId', Route: { code: 200 } });
  expect(get.FieldAccess).toBeUndefined();
  expect(pair.CreateRecordItem.Access).toBe('EDITOR');
  expect(get.Request.safeParse({ id: 'invalid' }).success).toBe(false);
  const stored = { id: '018f515e-0cca-7000-8000-000000000001', name: 'example', hidden: 'server-only' };
  expect(get.Response.encode({ code: 200, data: stored })).toEqual({ code: 200, data: { id: stored.id, name: stored.name } });
  expect(get.ResponseTypeUnion.safeParse({ code: 409, error: 'Resource.CONFLICT', traceId: 'r' }).success).toBe(false);
});

it('requires a path ID even if the field has a stored default', () => {
  const { Resource, Prop, endpoints } = createResourceSystem({ roles: ['VIEWER'] });
  @Resource()
  class Tag {
    @Prop(z.string().min(1).default('default-id'), { crud: 'id' }) key!: Defaulted<Id<string>>;
  }
  const { GetTag } = endpoints(Tag, { name: 'Tag', operations: { ...supported, Create: false } });
  expect(GetTag.Request.safeParse({}).success).toBe(false);
  expect(GetTag.RequestContent.safeParse({ params: {}, headers: {}, body: {}, query: {} }).success).toBe(false);
  expect(GetTag.fromContent(GetTag.toContent({ key: 'custom' }))).toEqual({ key: 'custom' });
  for (const key of ['', '.', '..']) {
    expect(GetTag.Request.safeParse({ key }).success).toBe(false);
    expect(GetTag.RequestContent.safeParse({ params: { tagId: key }, query: {}, headers: {}, body: {} }).success).toBe(false);
  }
});

it('reads a non-null key from a nullable union and requires a concrete ID for the lookup', () => {
  const { Prop, Resource, endpoints } = createResourceSystem({ roles: ['VIEWER'] });
  @Resource()
  class Label {
    @Prop(z.union([z.string(), z.null()]), { crud: 'id' }) key!: Id<string | null>;
  }
  const { GetLabel } = endpoints(Label, { name: 'Label', operations: { ...supported, Create: false } });
  expectTypeOf<RequestOf<typeof GetLabel>>().toEqualTypeOf<{ key: string }>();
  expect(GetLabel.fromContent(GetLabel.toContent({ key: 'starter' }))).toEqual({ key: 'starter' });
  expect(GetLabel.Request.safeParse({ key: null }).success).toBe(false);
});

it('leaves the inventory intact when a Get contract in the set cannot be built', () => {
  const resources = createResourceSystem({ roles: ['VIEWER'] });
  const { Prop, Resource, endpoints } = resources;
  @Resource()
  class Batch {
    @Prop(z.array(z.string()), { crud: 'id' }) key!: Id<string[]>;
  }
  expect(() => endpoints(Batch, { name: 'Batch', operations: { ...supported, Create: true, Get: true } })).toThrow(ApiDefinitionError);
  expect(resources.declaredEndpoints).toEqual([]);
});
