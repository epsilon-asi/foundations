import { defineTypeExtension, type ResolvedField } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import { assertFieldPatchMode } from '../assertFieldPatchModes.js';

const accessPreset = z.enum([
  'readable', 'id', 'tenant', 'editable', 'createOnly', 'updateOnly', 'writeOnly', 'internal', 'secret',
]);

const fieldOptions = z.union([
  accessPreset,
  z.strictObject({
    access: accessPreset.optional(),
    id: z.boolean().optional(),
    patch: z.enum(['replace', 'merge', 'append']).optional(),
  }),
]);
export type CrudFieldOptions = z.output<typeof fieldOptions>;

/** Declares a field's access preset, primary-key flag and PATCH behavior. */
export const crudExtension = defineTypeExtension({
  key: 'crud' as const,
  field: fieldOptions,
  validateField: assertFieldPatchMode,
});

export type CrudField = ResolvedField<{ crud: typeof crudExtension }>;

/** Reads the access preset from either accepted CRUD declaration. */
export function crudFieldAccess({ extensions: { crud } }: Pick<CrudField, 'extensions'>) {
  return typeof crud === 'string' ? crud : crud?.access;
}

/** Both the ID preset and an explicit ID flag mark a primary key. */
export function isCrudIdField(field: CrudField): boolean {
  const crud = field.extensions.crud;
  return crudFieldAccess(field) === 'id' || (typeof crud === 'object' && crud.id === true);
}
