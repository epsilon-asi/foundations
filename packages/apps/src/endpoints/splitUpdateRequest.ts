import { pathRequestFields, type PathRequestFieldsOptions } from './assertPathRequestFields.js';

export interface SplitUpdateRequestOptions<Request extends object = Record<string, unknown>>
  extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Flat update fields before wire encoding. */
  request: Request;
}

/** Partitions the flat update fields by location, preserving their values. */
export function splitUpdateRequest<Request extends object>({ path, paramFields, request }: SplitUpdateRequestOptions<Request>): {
  params: Partial<Record<string, Request[keyof Request]>>;
  body: Partial<Request>;
} {
  const fields = pathRequestFields({ path, paramFields });
  const body = Object.fromEntries(Object.entries(request)) as Record<string, Request[keyof Request]>;
  const params: [string, Request[keyof Request]][] = [];

  for (const { param, field, optional } of fields) {
    const value = Object.hasOwn(body, field) ? body[field] : undefined;
    if (value === undefined) {
      if (optional) continue;
      throw new TypeError(`Route "${path}" parameter "${param}" requires update field "${field}".`);
    }
    params.push([param, value]);
  }
  // Several parameters can read one field. Remove it only after all have read it.
  for (const { field } of fields) delete body[field];
  return { params: Object.fromEntries(params), body: body as Partial<Request> };
}
