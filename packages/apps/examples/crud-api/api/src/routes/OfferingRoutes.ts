import { failure } from '@epsilon-asi/apps';
import { handler, Routes, type RouteClass } from '@epsilon-asi/apps/express';
import { CreateOffering, DeleteOffering, GetOffering, ListOfferings, UpdateOffering } from '../../../common/src/resources/Offering.js';
import { exampleOffering, OfferingStore, type OfferingStorage } from '../exampleOffering.js';

/** Both applications share the four operations for which they provide their own handlers. */
export abstract class OfferingRouteHandlers {
  protected abstract readonly offerings: Omit<OfferingStorage, 'get'>;

  create = handler(CreateOffering, {
    handle: (request, ctx) => this.offerings.save({ ctx, row: exampleOffering(request, ctx.tenant.id) }),
  });

  list = handler(ListOfferings, {
    handle: (query, ctx) => this.offerings.list({ ctx, query }),
  });

  update = handler(UpdateOffering, {
    handle: async ({ id, ...patch }, ctx) => await this.offerings.update({ ctx, id, patch }) ?? failure.notFound(),
  });

  delete = handler(DeleteOffering, {
    handle: async ({ id }, ctx) => {
      const deleted = await this.offerings.delete({ ctx, id });
      if (!deleted) return failure.notFound();
    },
  });
}

export function routesForOfferings(createStorage: () => OfferingStorage): RouteClass {
  @Routes()
  class OfferingRoutes extends OfferingRouteHandlers {
    protected readonly offerings = createStorage();

    get = handler(GetOffering, {
      handle: async ({ id }, ctx) => await this.offerings.get({ ctx, id }) ?? failure.notFound(),
    });
  }
  return OfferingRoutes;
}

export const OfferingRoutes = routesForOfferings(() => new OfferingStore());
