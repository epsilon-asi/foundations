import type { ResourceTenancy } from '../tenancy/endpointScope.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';

export interface AssertResourceOwnerOptions {
  /** Declared resource name. */
  name: string;
  /** Only account resources require an owner. */
  tenancy?: ResourceTenancy;
  /** Name of the field that identifies the user who owns the row. */
  owner?: string;
  /** Resolved model fields, including inherited fields, when available. */
  fields?: ReadonlyMap<string, unknown>;
}

/** Checks the resource's declared owner against its tenancy and resolved fields. */
export function assertResourceOwner({ name, tenancy, owner, fields }: AssertResourceOwnerOptions): void {
  if (owner === undefined) {
    if (tenancy === 'account') throw new ResourceDefinitionError(`Account resource "${name}" requires an owner field.`);
    return;
  }
  if (typeof owner !== 'string' || !owner.trim()) {
    throw new ResourceDefinitionError(`Resource "${name}" requires a nonempty owner field name.`);
  }
  if (fields && !fields.has(owner)) {
    throw new ResourceDefinitionError(`Resource "${name}" has no declared owner field "${owner}".`);
  }
}
