import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { splitPathRequest } from './pathRequestContent.js';

export interface SplitUpdateRequestOptions<Request extends object = Record<string, unknown>>
  extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Flat request fields before wire encoding. */
  request: Request;
}

/** Partitions the flat update fields by location, preserving their values. */
export function splitUpdateRequest<Request extends object>({ path, paramFields, request }: SplitUpdateRequestOptions<Request>) {
  const { params, remaining: body } = splitPathRequest({ path, paramFields, request, kind: 'update' });
  return { params, body };
}
