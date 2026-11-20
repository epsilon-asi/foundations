import { z } from 'zod/v4';

const errorPart = z.string().regex(/[^.\s]+/);

/** The wire identifier and request trace shared by failure envelopes. */
export const failureFields = { error: z.templateLiteral([errorPart, '.', errorPart]), traceId: z.string() };
