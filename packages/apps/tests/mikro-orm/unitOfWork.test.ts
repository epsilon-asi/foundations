import { randomUUID } from 'node:crypto';
import { MikroORM } from '@mikro-orm/sqlite';
import { describe, expect, it } from 'vitest';
import { createRouteSystem } from '../../src/express/routes.js';
import { defineEntity } from '../../src/mikro-orm/defineEntity.js';
import { getEntityManager, ormUnitOfWork } from '../../src/mikro-orm/unitOfWork.js';
import type { Editable, Id, Tenant } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import { failure } from '../../src/responses/failure.js';
import { createTestApp } from '../../src/testing/index.js';

describe('tenant-scoped request unit of work', () => {
  const resources = createResourceSystem({ tenant: () => Workspace, roles: ['EDITOR'] });
  const { Resource, Prop, endpoints } = resources;
  @Resource()
  class Workspace { @Prop.uuid({ crud: 'id' }) id!: Id<string>; }
  @Resource()
  class Note {
    @Prop.uuid({ crud: 'id' }) id!: Id<string>;
    @Prop.uuid({ crud: 'tenant' }) workspaceId!: Tenant<string>;
    @Prop.string({ crud: 'editable', min: 1 }) title!: Editable<string>;
  }
  const entity = defineEntity(Note);
  const { CreateNote, DeleteNote } = endpoints(Note, {
    name: 'Note', operations: { Create: true, Get: false, Update: false, List: false, Delete: true },
  });
  const routeSystem = createRouteSystem();
  @routeSystem.Routes()
  class NoteRoutes {
    create = routeSystem.handler(CreateNote, { handle: async ({ title }, ctx) => {
      const em = getEntityManager(ctx);
      const row = em.create(entity, { id: randomUUID(), title, workspaceId: ctx.tenant.id });
      if (title === 'committed') return row;
      // Force SQL before the failure so that a discarded identity map cannot pass for a rollback.
      await em.flush();
      if (title === 'declared failure') return failure.notFound();
      if (title === 'thrown error') throw new Error('private database detail');
      if (title === 'deferred error') {
        ctx.defer(() => { throw new Error('cleanup failed'); });
        return row;
      }
      return { ...row, title: '' };
    } });
    delete = routeSystem.handler(DeleteNote, {
      // @ts-expect-error Exercise a misconfigured handler that returns the row it just removed.
      handle: async ({ id }, ctx) => {
        const em = getEntityManager(ctx);
        const row = await em.findOneOrFail(entity, { id });
        await em.remove(row).flush();
        return row;
      },
    });
  }

  it('commits valid responses and rolls back SQL on returned, thrown, cleanup and response-encoding failures', async () => {
    const orm = await MikroORM.init({ dbName: ':memory:', entities: [entity], disableTransactions: true });
    try {
      await orm.schema.create();
      const unitOfWork = ormUnitOfWork(orm);
      const tenant = { id: randomUUID() };
      const app = await createTestApp({ resources, routes: [NoteRoutes], routeSystem, unitOfWork, env: { APP_ENV: 'test' } });
      try {
        const client = app.as({ tenant: tenant.id });
        for (const [title, code] of [
          ['committed', 201], ['declared failure', 404], ['thrown error', 500], ['deferred error', 500], ['invalid response', 500],
        ] as const) {
          expect((await client.call(CreateNote, { title })).code).toBe(code);
        }
        const rows = await unitOfWork.run({ tenant, write: false, handle: em => em.find(entity, {}) });
        expect(rows.map(row => row.title)).toEqual(['committed']);
        const id = rows[0].id;
        expect(await client.call(DeleteNote, { id })).toEqual({ code: 500, error: 'Server.INTERNAL', traceId: expect.any(String) });
        expect(await unitOfWork.run({ tenant, write: false, handle: em => em.count(entity, { id }) })).toBe(1);
      } finally {
        await app.close();
      }
    } finally {
      await orm.close(true);
    }
  });

  it('gives concurrent reads independent identity maps and requires the matching tenant binding', async () => {
    const orm = await MikroORM.init({ dbName: ':memory:', entities: [entity] });
    try {
      const unitOfWork = ormUnitOfWork(orm);
      const a = { id: randomUUID() }, b = { id: randomUUID() };
      const managers = await Promise.all([a, b, a].map(tenant => unitOfWork.run({
        tenant, write: false, handle: async em => getEntityManager({ tenant, em }),
      })));
      expect(new Set(managers).size).toBe(3);
      expect(() => getEntityManager({ tenant: b, em: managers[0] })).toThrow('bound to its tenant');
      expect(() => getEntityManager({ tenant: a, em: orm.em })).toThrow('bound to its tenant');
      expect(() => getEntityManager({ tenant: a })).toThrow('bound to its tenant');
      await expect(unitOfWork.run({ tenant: { id: '' }, write: true, handle: async () => undefined })).rejects.toThrow('tenant is required');
    } finally {
      await orm.close(true);
    }
  });
});
