import type { ResolvedType } from '@epsilon-asi/foundation';
import type { crudExtension } from '../model/extensions/crud.js';
import type { uiExtension } from '../model/extensions/ui.js';
import { fieldEnumValues } from '../model/fieldEnumValues.js';
import { fieldOperations } from '../model/selectOperationFields.js';
import { enumOptionMessageKey, fieldMessageKeys } from './fieldMessageKeys.js';

export type MessageKeysOptions = Pick<
  ResolvedType<unknown, { crud: typeof crudExtension; ui: typeof uiExtension }>, 'name' | 'fields' | 'extensions'
>;

/** Lists the catalog keys for this resource's labels, visible fields and form options. */
export function messageKeys({ name, fields, extensions }: MessageKeysOptions): readonly string[] {
  const keys = new Set<string>();
  for (const key of [extensions.ui?.label, extensions.ui?.plural]) {
    if (key !== undefined) keys.add(key);
  }
  for (const field of fields.values()) {
    if (fieldOperations(field).length === 0) continue;
    const location = { resource: name, field: field.name };
    for (const key of Object.values(fieldMessageKeys({ ...location, ui: field.extensions.ui }))) keys.add(key);
    for (const value of fieldEnumValues(field.schema) ?? []) keys.add(enumOptionMessageKey({ ...location, value }));
  }
  return Object.freeze([...keys]);
}
