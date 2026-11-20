import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { dateWireCodec } from '../../src/wire/date.js';
import { numberWireCodec } from '../../src/wire/number.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

it('describes date and numeric request fields as their wire inputs', () => {
  const request = z.strictObject({
    since: dateWireCodec.describe('Earliest timestamp'),
    amount: numberWireCodec.optional(),
  });
  expect(wireInputJsonSchema(request)).toMatchObject({
    type: 'object',
    required: ['since'],
    additionalProperties: false,
    properties: {
      since: { type: 'string', format: 'date-time', description: 'Earliest timestamp' },
      amount: { type: 'string', pattern: expect.any(String) },
    },
  });
});

it('reports a decoded date that has no wire representation', () => {
  expect(() => wireInputJsonSchema(z.object({ since: z.date() }))).toThrow(/date/i);
});
