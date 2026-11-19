import { z } from 'zod/v4';

export const DEFAULT_MAX_SEARCH_LENGTH = 200;

/** Validates the q field on a search-enabled list. */
export const searchQuerySchema = z.string().max(DEFAULT_MAX_SEARCH_LENGTH);
