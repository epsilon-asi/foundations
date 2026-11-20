import type { Constructor } from '@epsilon-asi/foundation';
import type { EntityClass, FilterQuery } from '@mikro-orm/core';
import { resourceModelFor } from '../model/createResourceSystem.js';
import { resolveCrudIdField } from '../model/resolveCrudIdField.js';
import type { GetInput, IdOf } from '../model/types.js';
import { failure, type Failure } from '../responses/failure.js';
import { tenantEntityKeys, type DefineEntityOptions, type EntityOf } from './defineEntity.js';
import { getEntityManager } from './unitOfWork.js';

type Context = Parameters<typeof getEntityManager>[0];
type ServiceOptions = Pick<DefineEntityOptions, 'resources'>;
type Lookup<C> = { ctx: Context; id: NonNullable<IdOf<C>> };
export interface ResourceGetService<C extends Constructor<object>> {
  get(options: Lookup<C>): Promise<EntityOf<C> | null>;
}

/** A service subclass uses the calling unit of work's manager for each lookup. */
export function ResourceService<C extends Constructor<object>>(target: C, options: ServiceOptions = {}): new () => ResourceGetService<C> {
  const keys = tenantEntityKeys(resourceModelFor(target, options.resources));
  return class {
    async get({ ctx, id }: Lookup<C>) {
      const em = getEntityManager(ctx);
      if (!(typeof id === 'string' || typeof id === 'number' || typeof id === 'boolean' || id instanceof Date)) {
        throw new TypeError('A scalar resource ID is required for Get.');
      }
      // Include ownership in the lookup even when the manager already has this primary key in its identity map.
      const where = { $and: [{ [keys.id]: id }, { [keys.tenant]: ctx.tenant.id }] } as FilterQuery<EntityOf<C>>;
      return em.findOne(target as EntityClass<EntityOf<C>>, where);
    }
  };
}

export interface ResourceGetHandlers<C extends Constructor<object>> {
  readonly resource: object;
  Get(request: GetInput<C>, ctx: Context): Promise<EntityOf<C> | Failure>;
}

/** Resource-keyed route defaults for the operations implemented by the ORM adapter. */
export function crudHandlers<C extends Constructor<object>>(target: C, options: ServiceOptions = {}): ResourceGetHandlers<C> {
  const resource = resourceModelFor(target, options.resources);
  const idField = resolveCrudIdField(resource).name as keyof GetInput<C>;
  const Service = ResourceService(target, options);
  const service = new Service();
  return {
    resource,
    async Get(request, ctx) {
      const id = request[idField] as NonNullable<IdOf<C>>;
      return await service.get({ ctx, id }) ?? failure.notFound();
    },
  };
}
