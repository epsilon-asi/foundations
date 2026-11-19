import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { dateWireCodec } from '../../src/wire/date.js';

it.each([
  ['2024-03-01T00:15:20.123+05:30', '2024-02-29T18:45:20.123Z'],
  ['2024-12-31T22:30:00-03:00', '2025-01-01T01:30:00.000Z'],
  ['1970-01-01T00:00:00Z', '1970-01-01T00:00:00.000Z'],
  ['0000-01-01T01:00:00+01:00', '0000-01-01T00:00:00.000Z'],
  ['9999-12-31T22:59:59.999-01:00', '9999-12-31T23:59:59.999Z'],
])('round-trips the instant in %s through UTC', (wire, utc) => {
  const decoded = dateWireCodec.decode(wire);
  expect(decoded).toEqual(new Date(utc));
  const encoded = dateWireCodec.encode(decoded);
  expect(encoded).toBe(utc);
  expect(dateWireCodec.decode(encoded)).toEqual(decoded);
});

it.each([
  '2025-01-01T12:00:00',
  '2025-02-29T12:00:00Z',
  '2025-01-01T12:00:00+25:00',
  'not a date',
])('rejects invalid wire input %s', wire => {
  expect(dateWireCodec.safeDecode(wire).success).toBe(false);
});

it('rejects an invalid Date on encode', () => {
  expect(dateWireCodec.safeEncode(new Date(NaN)).success).toBe(false);
});

it.each([
  '0000-01-01T00:00:00+01:00',
  '9999-12-31T23:59:59-01:00',
])('rejects %s when the UTC year falls outside the wire format', wire => {
  expect(dateWireCodec.safeDecode(wire).success).toBe(false);
  expect(dateWireCodec.safeEncode(new Date(wire)).success).toBe(false);
});

it('describes the wire input as a date-time string', () => {
  expect(z.toJSONSchema(dateWireCodec, { io: 'input' })).toMatchObject({
    type: 'string',
    format: 'date-time',
  });
});
