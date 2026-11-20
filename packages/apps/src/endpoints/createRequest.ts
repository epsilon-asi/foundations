import { reassemblePathRequest, splitPathRequest } from './pathRequestContent.js';
import type { ReassembleUpdateRequestOptions } from './reassembleUpdateRequest.js';
import type { SplitUpdateRequestOptions } from './splitUpdateRequest.js';

/** Flat Create input and the route that declares its parent parameters. */
export type SplitCreateRequestOptions<Request extends object = Record<string, unknown>> = SplitUpdateRequestOptions<Request>;

/** The decoded parent parameters and Create body for a collection route. */
export type ReassembleCreateRequestOptions<
  Params extends object = Record<string, unknown>,
  Body extends object = Record<string, unknown>,
> = ReassembleUpdateRequestOptions<Params, Body>;

/** Moves parent path fields into params and leaves the Create input in the body. */
export function splitCreateRequest<Request extends object>({ path, paramFields, request }: SplitCreateRequestOptions<Request>) {
  const { params, remaining: body } = splitPathRequest({ path, paramFields, request, kind: 'create' });
  return { params, body };
}

/** Restores a flat Create request from its decoded parent parameters and body. */
export function reassembleCreateRequest<Params extends object, Body extends object>({
  path, paramFields, params, body,
}: ReassembleCreateRequestOptions<Params, Body>) {
  return reassemblePathRequest({ path, paramFields, params, section: body, kind: 'create' });
}
