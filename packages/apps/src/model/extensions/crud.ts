import { defineTypeExtension } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';

const accessPreset = z.enum([
  'readable', 'id', 'tenant', 'editable', 'createOnly', 'updateOnly', 'writeOnly', 'internal', 'secret',
]);

/** Declares a field's access preset, primary-key flag and PATCH behavior. */
export const crudExtension = defineTypeExtension({
  key: 'crud' as const,
  field: z.union([
    accessPreset,
    z.strictObject({
      access: accessPreset.optional(),
      id: z.boolean().optional(),
      patch: z.enum(['replace', 'merge', 'append']).optional(),
    }),
  ]),
});
