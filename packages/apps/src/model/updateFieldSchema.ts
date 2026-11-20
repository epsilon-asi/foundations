import { z } from 'zod/v4';

export interface UpdateFieldSchemaOptions<Schema extends z.core.$ZodType = z.core.$ZodType> {
  /** The declared field schema used on create. */
  schema: Schema;
}

function withDefinition(schema: z.core.$ZodType, changes: Record<string, unknown>) {
  return z.clone(schema, z.core.util.mergeDefs(schema._zod.def, changes), { parent: true });
}

function retainChecks(inner: z.core.$ZodType, wrapper: z.core.$ZodType) {
  const checks = wrapper._zod.def.checks;
  if (!checks?.length) return inner;
  return withDefinition(inner, { checks: [...(inner._zod.def.checks ?? []), ...checks] });
}

// Follow schemas that parse the field itself. A supplied array or object still
// validates its contents with the declaration for those elements or properties.
export function withoutFallbacks(schema: z.core.$ZodType, pipes: 'both' | 'output' = 'both'): z.core.$ZodType {
  const def = (schema as z.core.$ZodTypes)._zod.def;
  switch (def.type) {
    case 'default':
    case 'prefault':
    case 'catch':
      return retainChecks(withoutFallbacks(def.innerType, pipes), schema);
    case 'optional':
    case 'nonoptional':
    case 'nullable':
    case 'readonly':
      return withDefinition(schema, { innerType: withoutFallbacks(def.innerType, pipes) });
    case 'pipe':
      if (pipes === 'output') return retainChecks(withoutFallbacks(def.out, pipes), schema);
      return withDefinition(schema, { in: withoutFallbacks(def.in), out: withoutFallbacks(def.out) });
    case 'union':
      return withDefinition(schema, { options: def.options.map(option => withoutFallbacks(option, pipes)) });
    case 'intersection':
      return withDefinition(schema, { left: withoutFallbacks(def.left, pipes), right: withoutFallbacks(def.right, pipes) });
    case 'lazy': {
      const lazy = schema as z.core.$ZodLazy;
      // Keep the declaration lazy, even when its original target is already cached.
      return z.clone(lazy, {
        type: 'lazy', getter: () => withoutFallbacks(lazy._zod.innerType, pipes), checks: def.checks, error: def.error,
      }, { parent: true });
    }
    default:
      return schema;
  }
}

/** Derives an optional PATCH field that validates supplied values without applying create fallbacks. */
export function updateFieldSchema<Schema extends z.core.$ZodType>({ schema }: UpdateFieldSchemaOptions<Schema>) {
  const inner = withoutFallbacks(schema) as z.core.$ZodType<z.output<Schema> | undefined, z.input<Schema>>;
  return z.optional(inner);
}
