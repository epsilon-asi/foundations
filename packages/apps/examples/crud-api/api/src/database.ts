import { Routes, type CreateApiOptions } from '@epsilon-asi/apps/express';
import { crudHandlers, defineEntity, getEntityManager, ormUnitOfWork } from '@epsilon-asi/apps/mikro-orm';
import { LockMode, raw, type MikroORM } from '@mikro-orm/core';
import { Offering } from '../../common/src/resources/Offering.js';
import { offeringOrder, type OfferingStorage } from './exampleOffering.js';
import { OfferingRouteHandlers } from './routes/OfferingRoutes.js';

export const OfferingEntity = defineEntity(Offering);

const databaseOfferings: Omit<OfferingStorage, 'get'> = {
  save: ({ ctx, row }) => getEntityManager(ctx).create(OfferingEntity, row),
  list({ ctx, query: { page, perPage, where = {}, orderBy } }) {
    // Keep this page and its total on the same PostgreSQL snapshot during concurrent writes.
    return getEntityManager(ctx).transactional(async em => {
      const count = await em.count(OfferingEntity, where);
      const offset = page * perPage;
      if (offset >= count) return { offerings: [], count };
      const order = offeringOrder(orderBy).map(([field, direction]) => field === 'name'
        ? { [raw(alias => alias + '.name collate "C"')]: direction } : { [field]: direction });
      const offerings = await em.find(OfferingEntity, where, { orderBy: order, offset, limit: perPage });
      return { offerings, count };
    }, { readOnly: true, isolationLevel: 'repeatable read' });
  },
  async update({ ctx, id, patch }) {
    const em = getEntityManager(ctx);
    // Serialize updates to this tenant's row so each response includes earlier committed edits.
    const row = await em.findOne(OfferingEntity, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE });
    if (row) em.assign(row, patch);
    return row;
  },
  async delete({ ctx, id }) {
    const deleted = await getEntityManager(ctx).nativeDelete(OfferingEntity, { id });
    return deleted === 1;
  },
};

@Routes({ defaults: crudHandlers(Offering) })
class DatabaseOfferingRoutes extends OfferingRouteHandlers {
  protected readonly offerings = databaseOfferings;
}

/** The host registers OfferingEntity and owns the pool for the lifetime of the server. */
export function offeringDatabase(orm: Pick<MikroORM, 'em'>): Required<Pick<CreateApiOptions, 'routes' | 'unitOfWork'>> {
  return { routes: [DatabaseOfferingRoutes], unitOfWork: ormUnitOfWork(orm) };
}
