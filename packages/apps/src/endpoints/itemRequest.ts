import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { assertEmptyRequestBody, reassemblePathRequest, splitPathRequest } from './pathRequestContent.js';
import type { SplitUpdateRequestOptions } from './splitUpdateRequest.js';

/** Flat Get or Delete fields and the route that declares their parameter names. */
export type SplitItemRequestOptions<Request extends object = Record<string, unknown>> = SplitUpdateRequestOptions<Request>;

export interface ReassembleItemRequestOptions<Params extends object = Record<string, unknown>>
  extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Decoded path values, keyed by their route parameter names. */
  params: Params;
  /** Get and Delete accept an omitted or empty body. */
  body?: Readonly<Record<string, never>>;
}

/** Moves every Get or Delete request field into the path parameters. */
export function splitItemRequest<Request extends object>({ path, paramFields, request }: SplitItemRequestOptions<Request>): {
  params: Partial<Record<string, Request[keyof Request]>>;
  body: Record<string, never>;
} {
  const { params } = splitPathRequest({ path, paramFields, request, kind: 'item' });
  return { params, body: {} };
}

/** Restores the flat Get or Delete request from decoded path parameters. */
export function reassembleItemRequest<Params extends object>({
  path, paramFields, params, body,
}: ReassembleItemRequestOptions<Params>): Partial<Record<string, Params[keyof Params]>> {
  assertEmptyRequestBody({ path, body, kind: 'item' });
  return reassemblePathRequest({ path, paramFields, params, section: {}, kind: 'item' });
}
