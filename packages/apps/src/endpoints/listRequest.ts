import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { assertEmptyRequestBody, reassemblePathRequest, splitPathRequest } from './pathRequestContent.js';
import type { SplitUpdateRequestOptions } from './splitUpdateRequest.js';

/** Flat list query and the collection route that declares its parent parameters. */
export type SplitListRequestOptions<Request extends object = Record<string, unknown>> = SplitUpdateRequestOptions<Request>;

export interface ReassembleListRequestOptions<
  Params extends object = Record<string, unknown>,
  Query extends object = Record<string, unknown>,
> extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Decoded parent values keyed by their path parameter names. */
  params: Params;
  /** The decoded list query, including its declared paging and filter values. */
  query: Query;
  /** A complete request content object may carry an empty body. */
  body?: Readonly<Record<string, never>>;
}

/** Moves parent fields into params and the remaining list fields into query. */
export function splitListRequest<Request extends object>({ path, paramFields, request }: SplitListRequestOptions<Request>) {
  const { params, remaining: query } = splitPathRequest({ path, paramFields, request, kind: 'list' });
  return { params, query };
}

/** Restores a flat list request from decoded parent parameters and query fields. */
export function reassembleListRequest<Params extends object, Query extends object>({
  path, paramFields, params, query, body,
}: ReassembleListRequestOptions<Params, Query>) {
  assertEmptyRequestBody({ path, body, kind: 'list' });
  return reassemblePathRequest({ path, paramFields, params, section: query, kind: 'list' });
}
