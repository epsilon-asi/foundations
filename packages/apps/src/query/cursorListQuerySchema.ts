import { createListQuerySchema } from './listQuerySchema.js';
import { cursorPaginationQuerySchema } from './pagination.js';

export type { ListQueryOptions as CursorListQueryOptions } from './listQuerySchema.js';

/** Builds a cursor list's wire query with its declared search, sorting and filters. */
export const cursorListQuerySchema = createListQuerySchema(cursorPaginationQuerySchema);
