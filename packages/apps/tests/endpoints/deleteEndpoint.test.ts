import { expect, expectTypeOf, it } from 'vitest';
import type { RequestOf, ResponseDataOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import type { Editable, Id } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import type { EmptySuccessResponse } from '../../src/responses/success.js';

const onlyDelete = { Create: false, Get: false, Update: false, List: false } as const;

it('derives a bodyless item request, its delete rule, and an empty 200 response', () => {
  const resources = createResourceSystem({ roles: ['VIEWER', 'EDITOR', 'ADMIN'] });
  const { Resource, Prop, endpoints } = resources;
  class Row {
    @Prop.number({ crud: 'id', min: 1 }) key!: Id<number>;
  }
  @Resource()
  class Asset extends Row {
    @Prop.string({ crud: 'editable' }) label!: Editable<string>;
  }
  const group = endpoints(Asset, { name: 'Asset', operations: { ...onlyDelete, Update: true, Delete: true },
    access: { write: 'EDITOR', delete: 'ADMIN', fields: { label: { write: 'ADMIN' } } } });
  const endpoint = group.DeleteAsset;
  expect(resources.declaredEndpoints).toEqual([group.UpdateAsset, endpoint]);
  expectTypeOf<keyof typeof group>().toEqualTypeOf<'UpdateAsset' | 'DeleteAsset'>();
  expectTypeOf(endpoint.Method).toEqualTypeOf<'delete'>();
  expectTypeOf(endpoint.Route.paramFields.assetId).toEqualTypeOf<'key'>();
  expectTypeOf(endpoint.Access).toEqualTypeOf<'ADMIN'>();
  expectTypeOf<RequestOf<typeof endpoint>>().toEqualTypeOf<{ key: number }>();
  expectTypeOf<ResponseDataOf<typeof endpoint>>().toBeVoid();
  type Reply = ResponseTypeUnionOf<typeof endpoint>;
  expectTypeOf<Extract<Reply, { code: 200 }>>().toEqualTypeOf<EmptySuccessResponse>();
  expectTypeOf<Reply['code']>().toEqualTypeOf<200 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503>();
  expect(endpoint).toMatchObject({ Method: 'delete', Access: 'ADMIN', Path: '/assets/:assetId' });
  expect(endpoint.FieldAccess).toBeUndefined();
  expect(endpoint.ResponseData).toBeUndefined();
  const wire = endpoint.toContent({ key: 13 });
  expect(wire).toStrictEqual({ params: { assetId: '13' }, body: {}, query: {}, headers: {} });
  expect(endpoint.fromContent(wire)).toStrictEqual({ key: 13 });
  expect(endpoint.Request.safeParse({ key: 13, label: 'change' }).success).toBe(false);
  for (const section of [
    { params: {} }, { params: { assetId: '0' } }, { body: { key: 13 } }, { query: { label: 'change' } },
  ]) expect(endpoint.RequestContent.safeParse({ ...wire, ...section }).success).toBe(false);
  expect(endpoint.Response.encode({ code: 200 })).toStrictEqual({ code: 200 });
  expect(endpoint.ResponseTypeUnion.parse({ code: 200, message: 'Removed' })).toEqual({ code: 200, message: 'Removed' });
  expect(endpoint.ResponseTypeUnion.safeParse({ code: 200, data: { key: 13 } }).success).toBe(false);
  expect(endpoint.ResponseTypeUnion.safeParse({ code: 204 }).success).toBe(false);
});

it('uses the write rule by default and registers only enabled operations', () => {
  const { Resource, Prop, endpoints } = createResourceSystem();
  @Resource()
  class Tag { @Prop.string({ crud: 'id' }) id!: Id<string>; }
  const access = { read: 'VIEWER', write: 'EDITOR' } as const;
  const { DeleteTag } = endpoints(Tag, { name: 'Tag', operations: onlyDelete, access });
  expectTypeOf(DeleteTag.Access).toEqualTypeOf<'EDITOR'>();
  expect(DeleteTag.Access).toBe('EDITOR');
  const create = (enabled: boolean) => endpoints(Tag, {
    name: 'Tag', operations: { ...onlyDelete, Get: true, Delete: enabled }, access,
  });
  expectTypeOf<undefined>().toExtend<ReturnType<typeof create>['DeleteTag']>();
  expect(Object.keys(create(false))).toEqual(['GetTag']);
  expect(Object.keys(create(true))).toEqual(['GetTag', 'DeleteTag']);
});
