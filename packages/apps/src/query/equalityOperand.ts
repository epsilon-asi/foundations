import { z } from 'zod/v4';
import { fieldEnumValues } from '../model/fieldEnumValues.js';
import { withoutFallbacks } from '../model/updateFieldSchema.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';
import { booleanWireCodec } from '../wire/boolean.js';
import { dateWireCodec } from '../wire/date.js';
import { numberWireCodec } from '../wire/number.js';

const bigintWireCodec = z.codec(z.string().regex(/^-?(?:0|[1-9]\d*)$/), z.bigint(), {
  decode: text => BigInt(text),
  encode: value => value.toString(),
});

const textWire = z.string();

function scalarWire(schema: z.core.$ZodTypes) {
  switch (schema._zod.def.type) {
    case 'number': return numberWireCodec;
    case 'bigint': return bigintWireCodec;
    case 'boolean': return booleanWireCodec;
    case 'date': return dateWireCodec;
    case 'string': return textWire;
    case 'literal': case 'enum': case 'union':
      return fieldEnumValues(schema)?.every(value => typeof value === 'string') ? textWire : undefined;
  }
}

// A one-way transform has no encoder. Its stored scalar can still be compared using the standard wire form.
function hasTransform(schema: z.core.$ZodType): boolean {
  const def = (schema as z.core.$ZodTypes)._zod.def;
  switch (def.type) {
    case 'transform': return true;
    case 'pipe': return hasTransform(def.in) || hasTransform(def.out);
    case 'nullable': case 'optional': case 'nonoptional': case 'readonly':
      return hasTransform(def.innerType);
    default: return false;
  }
}

/** Builds a required comparison operand for a scalar field. The query supplies strings or an explicit null. */
export function equalityOperand(field: z.ZodType): z.ZodType | undefined {
  const stored = unwrapFieldSchema(field);
  const storedWire = scalarWire(stored.schema);
  if (!storedWire) return;

  const declared = withoutFallbacks(field);
  const input = unwrapFieldSchema(field, 'in');
  const storedChoices = storedWire === textWire && stored.schema._zod.def.type !== 'string';
  // Enum menus send the stored choices. Other scalars can use the field's own two-way string codec.
  const fieldWire = input.piped && !storedChoices && scalarWire(input.schema) === textWire && !hasTransform(declared);
  const compareStored = input.piped && !fieldWire;
  const value = z.nonoptional(compareStored ? withoutFallbacks(field, 'output') : declared);
  const wire: z.ZodType = fieldWire ? textWire : storedWire;
  const source = compareStored ? stored : input;
  const passNull = source.nullable && stored.nullable;
  const def = source.schema._zod.def;
  const needsWireCheck = wire !== textWire || (def.type === 'string' && def.coerce) || (source.nullable && !stored.nullable);
  const operand = needsWireCheck ? z.pipe(passNull ? wire.nullable() : wire, value) : value;
  return stored.nullable && !passNull ? operand.nullable() : operand;
}
