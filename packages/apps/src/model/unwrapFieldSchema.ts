import type { z } from 'zod/v4';

/** Finds a field's stored schema, or its input, without evaluating defaults, transforms or references. */
export function unwrapFieldSchema(schema: z.core.$ZodType, side: 'in' | 'out' = 'out') {
  let nullable = false;
  let piped = false;
  while (true) {
    const base = schema as z.core.$ZodTypes;
    const def = base._zod.def;
    switch (def.type) {
      case 'nullable':
        nullable = true;
        schema = def.innerType;
        break;
      case 'optional': case 'nonoptional': case 'default': case 'prefault': case 'catch': case 'readonly':
        schema = def.innerType;
        break;
      case 'pipe':
        piped = true;
        schema = def[side];
        break;
      default:
        return { schema: base, nullable, piped };
    }
  }
}
