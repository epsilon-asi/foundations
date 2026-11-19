import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { booleanWireCodec } from '../../src/wire/boolean.js';

it.each([
  ['true', true], ['false', false],
  ['1', true], ['0', false],
  ['YES', true], ['no', false],
  ['on', true], ['Off', false],
] as const)('round-trips %s through its canonical boolean spelling', (text, value) => {
  expect(booleanWireCodec.decode(text)).toBe(value);
  const encoded = booleanWireCodec.encode(value);
  expect(encoded).toBe(String(value));
  expect(booleanWireCodec.decode(encoded)).toBe(value);
});

it.each(['', 'maybe', '2', ' false '])('rejects unrecognized boolean text %j', text => {
  expect(booleanWireCodec.safeDecode(text).success).toBe(false);
});

it('describes a string on the wire and a boolean after decoding', () => {
  expectTypeOf<z.input<typeof booleanWireCodec>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof booleanWireCodec>>().toEqualTypeOf<boolean>();
  expect(z.toJSONSchema(booleanWireCodec, { io: 'input' })).toMatchObject({ type: 'string' });
});
