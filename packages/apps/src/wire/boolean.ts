import { z } from 'zod/v4';

/** Decodes Zod's boolean strings and encodes booleans as 'true' or 'false'. */
export const booleanWireCodec = z.stringbool();
