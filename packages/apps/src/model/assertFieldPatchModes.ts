import type { ExtensionFieldValidation } from '@epsilon-asi/foundation';
import type { z } from 'zod/v4';
import type { CrudField, CrudFieldOptions } from './extensions/crud.js';
import { ResourceDefinitionError } from './ResourceDefinitionError.js';
import { unwrapFieldSchema } from './unwrapFieldSchema.js';

/** The shape of a non-nullish decoded value. A nullish-only branch contributes no container. */
function patchContainer(schema: z.core.$ZodType): 'object' | 'array' | 'other' | undefined {
  const def = unwrapFieldSchema(schema).schema._zod.def;
  switch (def.type) {
    case 'object': case 'record': return 'object';
    case 'array': case 'tuple': return 'array';
    case 'null': case 'undefined': case 'void': case 'never': return undefined;
    case 'literal': return def.values.every(value => value == null) ? undefined : 'other';
    case 'union': {
      const kinds = new Set(def.options.map(patchContainer));
      kinds.delete(undefined);
      return kinds.size > 1 ? 'other' : kinds.values().next().value;
    }
    case 'intersection': {
      const left = patchContainer(def.left);
      return left === patchContainer(def.right) ? left : 'other';
    }
    default: return 'other';
  }
}

/** Checks a field's explicit merge or append mode against its stored value. */
export function assertFieldPatchMode({ typeName, fieldName, schema, options }: ExtensionFieldValidation<CrudFieldOptions | undefined>): void {
  const mode = typeof options === 'object' ? options?.patch : undefined;
  if (mode === undefined || mode === 'replace') return;
  if (mode !== 'merge' && mode !== 'append') {
    throw new ResourceDefinitionError(`Field "${typeName}.${fieldName}" declares an unknown PATCH mode "${String(mode)}".`);
  }
  const required = mode === 'merge' ? 'object' : 'array';
  if (patchContainer(schema) !== required) {
    throw new ResourceDefinitionError(`Field "${typeName}.${fieldName}" declares PATCH mode "${mode}", which requires an ${required} schema.`);
  }
}

export interface AssertFieldPatchModesOptions {
  /** Declared resource name for definition errors. */
  name: string;
  /** Resolved fields, including inherited declarations. */
  fields: ReadonlyMap<string, CrudField>;
}

/** Checks field PATCH declarations on a resolved model, including inherited fields. */
export function assertFieldPatchModes({ name, fields }: AssertFieldPatchModesOptions): void {
  for (const field of fields.values()) {
    assertFieldPatchMode({ typeName: name, fieldName: field.name, schema: field.schema, options: field.extensions.crud });
  }
}
