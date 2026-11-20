import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { reassemblePathRequest } from './pathRequestContent.js';

export interface ReassembleUpdateRequestOptions<
  Params extends object = Record<string, unknown>,
  Body extends object = Record<string, unknown>,
> extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Decoded path parameter values, keyed by their route names. */
  params: Params;
  /** Decoded request fields assigned to the body. */
  body: Body;
}

/** Reassembles a flat update from its decoded path and body fields. */
export function reassembleUpdateRequest<Params extends object, Body extends object>({
  path, paramFields, params, body,
}: ReassembleUpdateRequestOptions<Params, Body>) {
  return reassemblePathRequest({ path, paramFields, params, section: body, kind: 'update' });
}
