import { z } from 'zod/v4';

// A time-zone offset can move an otherwise valid timestamp outside the wire format's four-digit years.
const encodableDate = z.date()
  .min(new Date('0000-01-01T00:00:00.000Z'))
  .max(new Date('9999-12-31T23:59:59.999Z'));

/** Decodes an ISO timestamp with a time zone and encodes the instant in UTC. */
export const dateWireCodec = z.codec(z.iso.datetime({ offset: true }), encodableDate, {
  decode: text => new Date(text),
  encode: date => date.toISOString(),
});
