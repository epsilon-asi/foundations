import { EntityManager } from '@mikro-orm/core';
import type { TenantScope, UnitOfWork } from '../runtime/unitOfWork.js';
import { TENANT_FILTER } from './defineEntity.js';

/** Use the host's connection pool and isolate each invocation's identity map and tenant filter. */
export function ormUnitOfWork(orm: { readonly em: EntityManager }): UnitOfWork<EntityManager> {
  return {
    async run({ tenant, write, handle }) {
      if (!tenant.id) throw new Error('A tenant is required for a unit of work.');
      const em = orm.em.fork({ disableContextResolution: true, disableTransactions: false, flushMode: 'commit' });
      em.setFilterParams(TENANT_FILTER, { tenantId: tenant.id });
      // MikroORM flushes once at the end of transactional(), after the caller's result is encoded.
      return write ? em.transactional(handle) : handle(em);
    },
  };
}

/** Access the verified tenant's ORM manager inside a request handler. */
export function getEntityManager(ctx: TenantScope & { readonly em?: object }): EntityManager {
  const em = ctx.em;
  if (!(em instanceof EntityManager) || em.global || !ctx.tenant.id || em.getFilterParams(TENANT_FILTER)?.tenantId !== ctx.tenant.id) {
    throw new Error('This handler requires an ORM unit of work bound to its tenant.');
  }
  return em;
}
