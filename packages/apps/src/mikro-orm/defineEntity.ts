import { toSnakeCase, type Constructor } from '@epsilon-asi/foundation';
import { EntitySchema, type Hidden, type HiddenProps, type Opt } from '@mikro-orm/core';
import type { z } from 'zod/v4';
import type { DefaultAxis } from '../model/access.js';
import { resourceModelFor, type ResourceModel, type ResourceSystem } from '../model/createResourceSystem.js';
import { crudFieldAccess } from '../model/extensions/crud.js';
import { fieldEnumValues } from '../model/fieldEnumValues.js';
import { resolveCrudIdField } from '../model/resolveCrudIdField.js';
import { resolveTenantField } from '../model/resolveTenantField.js';
import { ResourceDefinitionError } from '../model/ResourceDefinitionError.js';
import { serverOnlyFields } from '../model/serverOnlyFields.js';
import type { Fields, ReadModel } from '../model/types.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';

export const TENANT_FILTER = 'tenant';

type Column<C, K extends keyof Fields<C>> = K extends keyof ReadModel<C> ? ReadModel<C>[K] : Hidden<Fields<C>[K]>;
/** Defaulted columns may be omitted at creation; unreadable columns stay out of serialized DTOs. */
export type EntityOf<C extends Constructor<object>> = {
  [K in keyof Fields<C>]: DefaultAxis extends keyof NonNullable<Fields<C>[K]> ? Opt<Column<C, K>> : Column<C, K>;
} & { [HiddenProps]?: Exclude<keyof Fields<C>, keyof ReadModel<C>> };

export interface DefineEntityOptions {
  /** Defaults to the resource system that declared the class. */
  resources?: Pick<ResourceSystem, 'resolve'>;
  /** Defaults to the resource name in snake case. */
  table?: string;
}

function columnType(schema: z.core.$ZodTypes, path: string) {
  const values = fieldEnumValues(schema);
  if (values?.length) return { enum: true as const, items: values };
  switch (schema._zod.def.type) {
    case 'string': return { type: (schema as z.ZodString).format === 'uuid' ? 'uuid' : 'text' };
    case 'number': return { type: (schema as z.ZodNumber).isInt ? 'integer' : 'double' };
    case 'boolean': return { type: 'boolean' };
    case 'date': return { type: Date };
    case 'array': case 'object': case 'record': case 'tuple': return { type: 'json' };
    default: throw new ResourceDefinitionError(`Cannot derive a database column for "${path}" from "${schema._zod.def.type}".`);
  }
}

export function tenantEntityKeys<C extends Constructor>(model: ResourceModel<C>) {
  if (model.tenancy !== 'owned') {
    throw new ResourceDefinitionError(`Database persistence currently requires a tenant-owned resource. Check "${model.name}".`);
  }
  if (model.owner !== undefined) {
    throw new ResourceDefinitionError(`"${model.name}" requires owner filtering, which this adapter does not support yet.`);
  }
  return { id: resolveCrudIdField(model).name, tenant: resolveTenantField(model).name };
}

/** Derives the server-side entity and its default tenant filter from a resource declaration. */
export function defineEntity<C extends Constructor<object>>(target: C, options: DefineEntityOptions = {}): EntitySchema<EntityOf<C>> {
  const model = resourceModelFor(target, options.resources);
  const { id, tenant } = tenantEntityKeys(model);
  const hidden = serverOnlyFields(model);
  const properties = Object.fromEntries([...model.fields].map(([name, field]) => {
    if (crudFieldAccess(field) === 'secret') {
      throw new ResourceDefinitionError(`"${model.name}.${name}" requires encrypted storage, which this adapter does not support yet.`);
    }
    const { schema, nullable } = unwrapFieldSchema(field.schema);
    return [name, {
      ...columnType(schema, `${model.name}.${name}`),
      primary: name === id,
      index: name === tenant,
      hidden: hidden.has(name),
      nullable: nullable || field.schema._zod.optout === 'optional',
      // MikroORM calls onCreate for null as well as undefined; Zod defaults apply only to undefined.
      ...(field.schema._zod.optin === 'defaulted' && { onCreate: (row: object) => field.schema.parse(Reflect.get(row, name)) }),
    }] as const;
  }));
  // The registry supplies the property names at runtime. The class flavors supply their ORM types.
  return new EntitySchema({
    class: target,
    tableName: options.table ?? toSnakeCase(model.name),
    properties,
    filters: {
      [TENANT_FILTER]: {
        name: TENANT_FILTER, default: true,
        cond: ({ tenantId }: { tenantId: string }) => {
          if (typeof tenantId !== 'string' || !tenantId) throw new Error(`A tenant ID is required to query "${model.name}".`);
          return { [tenant]: tenantId };
        },
      },
    },
  }) as EntitySchema<EntityOf<C>>;
}
