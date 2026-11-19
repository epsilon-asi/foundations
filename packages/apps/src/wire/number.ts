import { z } from 'zod/v4';

const wireNumber = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/);

/** Decodes JSON number syntax and encodes a finite number as decimal or scientific notation. */
export const numberWireCodec = z.codec(wireNumber, z.number(), {
  decode: text => Number(text),
  encode: value => Object.is(value, -0) ? '-0' : String(value),
});
