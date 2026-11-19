import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { numberWireCodec } from '../../src/wire/number.js';

it.each([
  ['0', 0, '0'],
  ['-0', -0, '-0'],
  ['-12.500', -12.5, '-12.5'],
  ['4.2E+2', 420, '420'],
  ['5e-324', Number.MIN_VALUE, '5e-324'],
  ['1.7976931348623157e+308', Number.MAX_VALUE, '1.7976931348623157e+308'],
] as const)('round-trips the numeric value of %s', (wire, value, canonical) => {
  expect(numberWireCodec.decode(wire)).toBe(value);
  expect(numberWireCodec.encode(value)).toBe(canonical);
  expect(numberWireCodec.decode(canonical)).toBe(value);
});

it.each([
  '', ' ', ' 0', '0\n', '2px', '0x10', '+2', '01', '.5', '1.', '2e',
  'Infinity', 'NaN', '1e309',
])('rejects invalid numeric wire text %j', wire => {
  expect(numberWireCodec.safeDecode(wire).success).toBe(false);
});

it.each([NaN, Infinity, -Infinity])('rejects %s on encode', value => {
  expect(numberWireCodec.safeEncode(value).success).toBe(false);
});

it('describes the wire input as a numeric string', () => {
  expectTypeOf<z.input<typeof numberWireCodec>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof numberWireCodec>>().toEqualTypeOf<number>();
  expect(z.toJSONSchema(numberWireCodec, { io: 'input' })).toMatchObject({
    type: 'string',
    pattern: expect.any(String),
  });
});
