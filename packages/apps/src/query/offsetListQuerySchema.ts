import { createListQuerySchema } from './listQuerySchema.js';
import { offsetPaginationQuerySchema } from './pagination.js';

export type { ListQueryOptions as OffsetListQueryOptions } from './listQuerySchema.js';

/** Builds an offset list's wire query with its declared search, sorting and filters. */
export const offsetListQuerySchema = createListQuerySchema(offsetPaginationQuerySchema);
