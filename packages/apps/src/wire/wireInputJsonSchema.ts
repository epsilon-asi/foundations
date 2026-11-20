import { z } from 'zod/v4';

/** Describes the encoded values accepted by a wire schema for OpenAPI and agent tools. */
export function wireInputJsonSchema(schema: z.ZodType): z.core.JSONSchema.BaseSchema {
  return z.toJSONSchema(schema, { io: 'input' });
}
