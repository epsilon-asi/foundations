import { defineTypeExtension } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

/** Overrides a field's wire name. Each endpoint chooses where it sends the field. */
export const httpExtension = defineTypeExtension({
  key: 'http' as const,
  field: z.strictObject({ name: z.string().optional() }),
});
