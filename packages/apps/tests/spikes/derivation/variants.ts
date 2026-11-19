import { createTypeRegistry, defineTypeExtension, type Constructor } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

// S1 fixture for deriving operation schemas from decorated field metadata.
const access = z.enum(['readable', 'editable', 'createOnly', 'updateOnly', 'writeOnly', 'internal', 'secret']);
const registry = createTypeRegistry({ namespace: 'spike-derivation' })
  .use(defineTypeExtension({ key: 'crud' as const, field: access }));
export const { Prop } = registry;

type Operation = 'read' | 'create' | 'update';
const allowed: Record<Operation, readonly (z.output<typeof access> | undefined)[]> = {
  read: ['readable', 'editable', 'createOnly', 'updateOnly'],
  create: ['editable', 'createOnly', 'writeOnly'],
  update: ['editable', 'updateOnly', 'writeOnly'],
};

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

export function derive(resource: Constructor, operation: Operation) {
  const cache = new Map<Constructor, z.ZodType<Record<string, unknown>>>();
  const serverOnlyFields = new Set<string>();

  function fieldVariant(schema: z.core.$ZodType, stripFallbacks: boolean): z.core.$ZodType {
    const def = definition(schema);
    switch (def.type) {
      case 'lazy': {
        const target = targets.get(def.getter);
        if (!target) throw new Error('Use a registered resource ref in the derivation fixture');
        return build(target());
      }
      case 'array':
        return z.clone(schema, z.core.util.mergeDefs(def, { element: fieldVariant(def.element, false) }));
      case 'default':
      case 'prefault':
      case 'catch':
        if (stripFallbacks) return fieldVariant(def.innerType, true);
        // Preserve create defaults, including callbacks, around a retargeted ref.
        return z.clone(schema, z.core.util.mergeDefs(def, { innerType: fieldVariant(def.innerType, false) }));
      case 'optional':
      case 'nullable':
        return z.clone(schema, z.core.util.mergeDefs(def, { innerType: fieldVariant(def.innerType, stripFallbacks) }));
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
    for (const field of registry.resolve(target).fields.values()) {
      const preset = field.extensions.crud;
      if (!allowed.read.includes(preset)) serverOnlyFields.add(field.name);
      const schema = fieldVariant(field.schema, operation === 'update');
      if (allowed[operation].includes(preset)) shape[field.name] = operation === 'update' ? z.optional(schema) : schema;
    }
    return object;
  }

  return { schema: build(resource), serverOnlyFields };
}
