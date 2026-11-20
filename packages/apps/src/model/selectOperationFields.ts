import type { FieldOperation } from './access.js';
import { crudFieldAccess, type CrudField } from './extensions/crud.js';

export type { FieldOperation } from './access.js';

type AccessPreset = Extract<CrudField['extensions']['crud'], string>;

const operationsByPreset: Record<AccessPreset, readonly FieldOperation[]> = {
  readable: ['read'],
  id: ['read'],
  tenant: ['read'],
  editable: ['read', 'create', 'update'],
  createOnly: ['read', 'create'],
  updateOnly: ['read', 'update'],
  writeOnly: ['create', 'update'],
  internal: [],
  secret: [],
};

/** The public operations that use this field, including write-only form inputs. */
export function fieldOperations(field: CrudField): readonly FieldOperation[] {
  const access = crudFieldAccess(field);
  return access ? operationsByPreset[access] : operationsByPreset.internal;
}

export interface SelectOperationFieldsOptions<Field extends CrudField = CrudField> {
  /** The fields returned by the resource's type registry. */
  fields: ReadonlyMap<string, Field>;
  operation: FieldOperation;
}

/** Selects the resolved fields granted to the operation, in declaration order. */
export function selectOperationFields<Field extends CrudField>(
  { fields, operation }: SelectOperationFieldsOptions<Field>,
): ReadonlyMap<string, Field> {
  const selected = new Map<string, Field>();
  for (const [name, field] of fields) {
    if (fieldOperations(field).includes(operation)) selected.set(name, field);
  }
  return selected;
}
