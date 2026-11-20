import { z } from 'zod/v4';
import { numberWireCodec } from '../wire/number.js';

export const DEFAULT_PAGE = 0;
export const DEFAULT_PER_PAGE = 20;
export const DEFAULT_MAX_PER_PAGE = 100;

export interface OffsetPaginationDefaultsOptions {
  /** Page size settings from a list declaration. */
  perPage?: {
    /** Defaults to the smaller of DEFAULT_PER_PAGE and the list's maximum. */
    default?: number;
    /** Defaults to DEFAULT_MAX_PER_PAGE. */
    max?: number;
  };
}

function assertPageSize(field: 'default' | 'max', size: number): void {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new RangeError(`perPage.${field} must be a positive safe integer.`);
  }
}

/** Resolves the initial offset page and page size limits for a list declaration. */
export function offsetPaginationDefaults({ perPage = {} }: OffsetPaginationDefaultsOptions = {}) {
  if (Object.prototype.toString.call(perPage) !== '[object Object]') {
    throw new TypeError('perPage must be a page size settings object.');
  }
  const { max: maxPerPage = DEFAULT_MAX_PER_PAGE } = perPage;
  assertPageSize('max', maxPerPage);
  const { default: defaultPerPage = Math.min(DEFAULT_PER_PAGE, maxPerPage) } = perPage;
  assertPageSize('default', defaultPerPage);
  if (defaultPerPage > maxPerPage) {
    throw new RangeError('perPage.default must be less than or equal to perPage.max.');
  }
  return { page: DEFAULT_PAGE, perPage: defaultPerPage, maxPerPage };
}

function perPageQueryField(options: OffsetPaginationDefaultsOptions) {
  const { perPage, maxPerPage } = offsetPaginationDefaults(options);
  return numberWireCodec.pipe(z.int().min(1).max(maxPerPage)).prefault(String(perPage));
}

/** Decodes the wire query to numeric paging fields and encodes it back to strings. */
export function offsetPaginationQuerySchema(options: OffsetPaginationDefaultsOptions = {}) {
  return z.strictObject({
    page: numberWireCodec.pipe(z.int().nonnegative()).prefault(String(DEFAULT_PAGE)),
    perPage: perPageQueryField(options),
  });
}

/** Carries an optional opaque cursor alongside the list's page size. */
export function cursorPaginationQuerySchema(options: OffsetPaginationDefaultsOptions = {}) {
  return z.strictObject({
    cursor: z.string().optional(),
    perPage: perPageQueryField(options),
  });
}
