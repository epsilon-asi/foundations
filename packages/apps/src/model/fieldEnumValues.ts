import { z } from 'zod/v4';
import { unwrapFieldSchema } from './unwrapFieldSchema.js';

function collectValues(schema: z.core.$ZodType, values: Set<string | number>): boolean {
  const def = unwrapFieldSchema(schema).schema._zod.def;
  switch (def.type) {
    case 'enum':
      for (const value of z.core.util.getEnumValues(def.entries)) values.add(value);
      return true;
    case 'literal':
      for (const value of def.values) {
        if (value == null) continue;
        if (typeof value !== 'string' && typeof value !== 'number') return false;
        values.add(value);
      }
      return true;
    case 'union':
      return def.options.every(option => collectValues(option, values));
    case 'null': case 'undefined': case 'void': case 'never':
      return true;
    default:
      return false;
  }
}

/** Stored choices in declaration order, including native numeric enums and nested literal unions. */
export function fieldEnumValues(schema: z.core.$ZodType): readonly (string | number)[] | undefined {
  const values = new Set<string | number>();
  if (collectValues(schema, values)) return Object.freeze([...values]);
}
