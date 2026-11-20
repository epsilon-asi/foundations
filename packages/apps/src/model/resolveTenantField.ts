import { crudFieldAccess, type CrudField } from './extensions/crud.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';

export interface ResolveTenantFieldOptions<Field extends CrudField = CrudField> {
  /** Declared name of the tenant-owned resource. */
  name: string;
  /** Resolved fields, including inherited declarations. */
  fields: ReadonlyMap<string, Field>;
}

/** Returns the single field that holds the resource's owning tenant. */
export function resolveTenantField<Field extends CrudField>({ name, fields }: ResolveTenantFieldOptions<Field>): Field {
  const tenants = [...fields.values()].filter(field => crudFieldAccess(field) === 'tenant');
  if (tenants.length === 0) throw new ResourceDefinitionError(`Tenant-owned resource "${name}" requires a Tenant field.`);
  if (tenants.length > 1) {
    const names = tenants.map(field => `"${field.name}"`).join(', ');
    throw new ResourceDefinitionError(`Tenant-owned resource "${name}" declares multiple Tenant fields (${names}). Exactly one is required.`);
  }
  return tenants[0];
}
