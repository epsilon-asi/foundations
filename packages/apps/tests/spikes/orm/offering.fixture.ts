import { EntitySchema, type EntityManager, type Hidden, type HiddenProps, type Opt, type RequiredEntityData } from '@mikro-orm/core';
import type { CreateInput, Defaulted, Editable, Readable, ReadModel } from '../inheritance/resource.fixture.js';

export class Offering {
  id: Defaulted<Readable<string>> = crypto.randomUUID();
  organizationId!: Readable<string>;
  name!: Editable<string>;
  tags!: Editable<string[]>;
  months!: Editable<number[]>;
  details!: Editable<{ seats: number }>;
  status: Defaulted<Readable<string>> = 'draft';
  providerId?: string;
}

type ResourceClass = new () => object;
type DefaultAxis = Extract<keyof Defaulted<object>, symbol>;
type Column<R, K extends keyof R> = K extends keyof ReadModel<R> ? ReadModel<R>[K] : Hidden<R[K]>;
export type EntityOf<C extends ResourceClass> = {
  [K in keyof InstanceType<C>]: DefaultAxis extends keyof NonNullable<InstanceType<C>[K]>
    ? Opt<Column<InstanceType<C>, K>>
    : Column<InstanceType<C>, K>;
  // MikroORM also needs the named hidden keys for optional fields in serialized DTO types.
} & { [HiddenProps]?: Exclude<keyof InstanceType<C>, keyof ReadModel<InstanceType<C>>> };

// Just the columns needed by S3. The server-side schema uses the resource class itself.
export function offeringSchema() {
  return new EntitySchema<EntityOf<typeof Offering>>({
    class: Offering,
    properties: {
      id: { type: 'string', primary: true },
      organizationId: { type: 'string', index: true },
      name: { type: 'string' },
      tags: { type: 'json' },
      months: { type: 'json' },
      details: { type: 'json' },
      status: { type: 'string' },
      providerId: { type: 'string', nullable: true, hidden: true },
    },
    filters: {
      tenant: {
        name: 'tenant',
        default: true,
        cond: ({ organizationId }: { organizationId: string }) => {
          if (!organizationId) throw new Error('An organization is required');
          return { organizationId };
        },
      },
    },
  });
}

export function resourceService<C extends ResourceClass>(entity: EntitySchema<EntityOf<C>>) {
  return {
    create({ ctx, input }: { ctx: { em: EntityManager; organizationId: string }; input: CreateInput<InstanceType<C>> }) {
      // The caller supplies the resource's writable fields; the service supplies tenancy.
      // TypeScript cannot prove that these two mapped types satisfy MikroORM's generic create input.
      const data = { ...input, organizationId: ctx.organizationId } as RequiredEntityData<EntityOf<C>>;
      return ctx.em.create(entity, data);
    },
  };
}
