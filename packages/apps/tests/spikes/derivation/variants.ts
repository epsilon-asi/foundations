import { createTypeRegistry, type Constructor } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import { crudExtension } from '../../../src/model/extensions/crud.js';
import { selectOperationFields, type FieldOperation } from '../../../src/model/selectOperationFields.js';
import { serverOnlyFields } from '../../../src/model/serverOnlyFields.js';
import { updateFieldSchema } from '../../../src/model/updateFieldSchema.js';

// S1 fixture for deriving operation schemas from decorated field metadata.
const registry = createTypeRegistry({ namespace: 'spike-derivation' }).use(crudExtension);
export const { Prop } = registry;

function definition(schema: z.core.$ZodType) {
  return (schema as z.core.$ZodTypes)._zod.def;
}

// Foundation's lazy ref yields the full model. Tag its getter so traversal can
// select the target's operation schema, including after a metadata-only clone.
const targets = new WeakMap<() => z.core.$ZodType, () => Constructor>();
export function ref<C extends Constructor>(target: () => C) {
  const schema = registry.ref(target);
  const def = definition(schema);
  if (def.type !== 'lazy') throw new Error('Expected a lazy foundation ref');
  targets.set(def.getter, target);
  return schema;
}

export function derive(resource: Constructor, operation: FieldOperation) {
  const cache = new Map<Constructor, z.ZodType<Record<string, unknown>>>();
  const redactedNames = new Set<string>();

  function fieldVariant(schema: z.core.$ZodType): z.core.$ZodType {
    const def = definition(schema);
    switch (def.type) {
      case 'lazy': {
        const target = targets.get(def.getter);
        if (!target) throw new Error('Use a registered resource ref in the derivation fixture');
        return build(target());
      }
      case 'array':
        return z.clone(schema, z.core.util.mergeDefs(def, { element: fieldVariant(def.element) }));
      case 'default':
      case 'prefault':
      case 'catch':
      case 'optional':
      case 'nullable':
        return z.clone(schema, z.core.util.mergeDefs(def, { innerType: fieldVariant(def.innerType) }));
      case 'string':
      case 'number':
      case 'enum':
        return schema;
      default:
        throw new Error(`Unsupported schema in the derivation spike: ${def.type}`);
    }
  }

  function build(target: Constructor): z.ZodType<Record<string, unknown>> {
    const cached = cache.get(target);
    if (cached) return cached;
    const shape: Record<string, z.core.$ZodType> = {};
    const object = z.lazy(() => operation === 'read' ? z.object(shape) : z.strictObject(shape));
    cache.set(target, object);
    const model = registry.resolve(target);
    const hidden = serverOnlyFields(model);
    const writable = operation === 'read' ? undefined : selectOperationFields({ fields: model.fields, operation });
    for (const field of model.fields.values()) {
      const serverOnly = hidden.has(field.name);
      if (serverOnly) redactedNames.add(field.name);
      const schema = fieldVariant(field.schema);
      if (writable ? writable.has(field.name) : !serverOnly) {
        shape[field.name] = operation === 'update' ? updateFieldSchema({ schema }) : schema;
      }
    }
    return object;
  }

  return { schema: build(resource), serverOnlyFields: redactedNames };
}
