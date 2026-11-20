import { randomUUID } from 'node:crypto';
import { MikroORM } from '@mikro-orm/sqlite';
import { expect, expectTypeOf, it } from 'vitest';
import { createRouteSystem } from '../../src/express/routes.js';
import { defineEntity, type EntityOf } from '../../src/mikro-orm/defineEntity.js';
import { crudHandlers, ResourceService } from '../../src/mikro-orm/resourceService.js';
import { ormUnitOfWork } from '../../src/mikro-orm/unitOfWork.js';
import type { Id, Tenant } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import { failure } from '../../src/responses/failure.js';

function declareEntries() {
  const resources = createResourceSystem({ tenant: () => Workspace, roles: ['VIEWER'] });
  const { Resource, Prop } = resources;
  @Resource()
  class Workspace { @Prop.uuid({ crud: 'id' }) id!: Id<string>; }
  @Resource()
  class Entry {
    @Prop.number({ crud: 'id', integer: true }) key!: Id<number>;
    @Prop.uuid({ crud: 'tenant' }) workspaceId!: Tenant<string>;
  }
  const { GetEntry } = resources.endpoints(Entry, {
    name: 'Entry', plural: 'Entries', operations: { Create: false, List: false, Update: false, Delete: false },
  });
  return { Entry, GetEntry };
}

it('uses the declared keys and the calling manager for a managed row, including on a custom table', async () => {
  const { Entry } = declareEntries();
  const entity = defineEntity(Entry, { table: 'custom_entries' });
  class Entries extends ResourceService(Entry) {}
  const service = new Entries();
  const defaults = crudHandlers(Entry);
  const orm = await MikroORM.init({ dbName: ':memory:', entities: [entity] });
  try {
    await orm.schema.create();
    const tenant = { id: randomUUID() }, other = { id: randomUUID() };
    const seed = orm.em.fork();
    seed.create(entity, { key: 7, workspaceId: tenant.id });
    seed.create(entity, { key: 8, workspaceId: other.id });
    await seed.flush();
    await ormUnitOfWork(orm).run({ tenant, write: false, async handle(em) {
      const ctx = { em, tenant };
      expectTypeOf<Parameters<typeof service.get>[0]['id']>().toEqualTypeOf<number>();
      expectTypeOf<Parameters<typeof defaults.Get>[0]>().toEqualTypeOf<{ key: number }>();
      expectTypeOf(service.get).returns.toEqualTypeOf<Promise<EntityOf<typeof Entry> | null>>();
      const own = await service.get({ ctx, id: 7 });
      expect(own).toBeInstanceOf(Entry);
      expect(own).toMatchObject({ key: 7, workspaceId: tenant.id });
      expect(await defaults.Get({ key: 7 }, ctx)).toBe(own);
      // A previously loaded foreign entity in this identity map must still be invisible to Get.
      await em.findOneOrFail(entity, { key: 8 }, { filters: false });
      expect(await service.get({ ctx, id: 8 })).toBeNull();
      expect(await defaults.Get({ key: 8 }, ctx)).toEqual(failure.notFound());
      expect(await defaults.Get({ key: 9 }, ctx)).toEqual(failure.notFound());
      await expect(service.get({ ctx: { em, tenant: other }, id: 7 })).rejects.toThrow('bound to its tenant');
      await expect(service.get({ ctx: { tenant }, id: 7 })).rejects.toThrow('bound to its tenant');
    } });
  } finally {
    await orm.close(true);
  }
});

it('requires both values to match when the tenant field is also the primary key', async () => {
  class Workspace {}
  const { Resource, Prop } = createResourceSystem({ tenant: () => Workspace });
  @Resource()
  class Preferences {
    @Prop.uuid({ crud: { access: 'tenant', id: true } }) workspaceId!: Tenant<string> & Id<string>;
  }
  const entity = defineEntity(Preferences);
  const Service = ResourceService(Preferences);
  const service = new Service();
  const orm = await MikroORM.init({ dbName: ':memory:', entities: [entity] });
  try {
    await orm.schema.create();
    const tenant = { id: randomUUID() };
    const seed = orm.em.fork();
    seed.create(entity, { workspaceId: tenant.id });
    await seed.flush();
    await ormUnitOfWork(orm).run({ tenant, write: false, async handle(em) {
      const ctx = { em, tenant };
      expect(await service.get({ ctx, id: tenant.id })).toMatchObject({ workspaceId: tenant.id });
      expect(await service.get({ ctx, id: randomUUID() })).toBeNull();
    } });
  } finally {
    await orm.close(true);
  }
});

it('resolves Get defaults by resource identity and gives an explicit field precedence', async () => {
  const { Entry, GetEntry } = declareEntries();
  const other = declareEntries();
  const endpoints = [GetEntry];
  const system = createRouteSystem();
  const defaults = crudHandlers(Entry);
  const override = system.handler(GetEntry, { handle: () => failure.notFound() });
  @system.Routes({ defaults })
  class Default {}
  @system.Routes({ defaults: [defaults] })
  class Override { get = override; }
  @system.Routes({ defaults: [defaults, defaults] })
  class Duplicate {}
  expect(await system.resolve({ endpoints, routes: [Default] })).toEqual([{ endpoint: GetEntry, handle: defaults.Get }]);
  expect(await system.resolve({ endpoints, routes: [Override] })).toEqual([override]);
  await expect(system.resolve({ endpoints, routes: [Duplicate] })).rejects.toThrow('Duplicate default for GetEntry');
  await expect(system.resolve({ endpoints: [other.GetEntry], routes: [Default] })).rejects.toThrow('Missing handlers for: GetEntry');
  await expect(system.resolve({ endpoints, routes: [] })).rejects.toThrow('Missing handlers for: GetEntry');
});
