import { defineTypeExtension } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const messageKey = z.string().optional();

/** Declares message keys for a resource and display hints for its fields. */
export const uiExtension = defineTypeExtension({
  key: 'ui' as const,
  field: z.strictObject({
    label: messageKey,
    placeholder: messageKey,
    helperText: messageKey,
    input: z.string().optional(),
    autoComplete: z.string().optional(),
    multiline: z.boolean().optional(),
    order: z.number().optional(),
  }),
  type: z.strictObject({
    label: messageKey,
    plural: messageKey,
  }),
});
