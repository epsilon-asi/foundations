import { selectOperationFields, type SelectOperationFieldsOptions } from './selectOperationFields.js';

export type ServerOnlyFieldsOptions = Pick<SelectOperationFieldsOptions, 'fields'>;

/** Lists a resolved resource's unreadable fields in declaration order, including inherited fields. */
export function serverOnlyFields({ fields }: ServerOnlyFieldsOptions): ReadonlySet<string> {
  const hidden = new Set(fields.keys());
  const readable = selectOperationFields({ fields, operation: 'read' });
  for (const name of readable.keys()) hidden.delete(name);
  return hidden;
}
