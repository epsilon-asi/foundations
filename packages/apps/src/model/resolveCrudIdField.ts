import { isCrudIdField, type CrudField } from './extensions/crud.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';

export interface ResolveCrudIdFieldOptions<Field extends CrudField = CrudField> {
  /** Declared name of the resource. */
  name: string;
  /** Resolved fields, including inherited declarations. */
  fields: ReadonlyMap<string, Field>;
}

/** Returns the single resolved primary key for a CRUD resource. */
export function resolveCrudIdField<Field extends CrudField>({ name, fields }: ResolveCrudIdFieldOptions<Field>): Field {
  const idFields = [...fields.values()].filter(isCrudIdField);
  if (idFields.length === 0) throw new ResourceDefinitionError(`Resource "${name}" requires an ID field for CRUD endpoints.`);
  if (idFields.length > 1) {
    const names = idFields.map(field => `"${field.name}"`).join(', ');
    throw new ResourceDefinitionError(`Resource "${name}" declares multiple ID fields (${names}). CRUD requires exactly one.`);
  }

  const [id] = idFields;
  const crud = id.extensions.crud;
  if (typeof crud === 'object' && (crud.access === 'internal' || crud.access === 'secret')) {
    throw new ResourceDefinitionError(`Resource "${name}" cannot use its ${crud.access} field "${id.name}" as an ID.`);
  }
  return id;
}
