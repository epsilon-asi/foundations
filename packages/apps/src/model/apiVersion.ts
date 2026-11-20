import { z } from 'zod/v4';

/** Optional API version declared on the resource system as a YYYY-MM-DD calendar date. */
export const apiVersionSchema = z.iso.date().optional();
