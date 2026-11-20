import { pathRequestFields, type PathRequestFieldsOptions } from './assertPathRequestFields.js';

export interface ReassembleUpdateRequestOptions<
  Params extends object = Record<string, unknown>,
  Body extends object = Record<string, unknown>,
> extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** Decoded path parameter values, keyed by their route names. */
  params: Params;
  /** Decoded update fields assigned to the body. */
  body: Body;
}

function sectionFields(section: object, name: string): Map<string, unknown> {
  if (Object.prototype.toString.call(section) !== '[object Object]') {
    throw new TypeError(`Update ${name} must be an object.`);
  }
  return new Map(Object.entries(section));
}

/** Reassembles a flat update from its decoded path and body fields. */
export function reassembleUpdateRequest<Params extends object, Body extends object>({
  path, paramFields, params, body,
}: ReassembleUpdateRequestOptions<Params, Body>) {
  const fields = pathRequestFields({ path, paramFields });
  const supplied = sectionFields(params, 'params');
  const request = sectionFields(body, 'body');
  const declared = new Set(fields.map(({ param }) => param));
  for (const param of supplied.keys()) {
    if (!declared.has(param)) throw new TypeError(`Route "${path}" has no path parameter "${param}".`);
  }

  for (const { param, field, optional } of fields) {
    if (Object.hasOwn(body, field)) {
      throw new TypeError(`Route "${path}" expects update field "${field}" in path parameter "${param}".`);
    }
    const value = supplied.get(param);
    if (value === undefined) {
      if (optional) continue;
      throw new TypeError(`Route "${path}" requires path parameter "${param}" for update field "${field}".`);
    }
    if (request.has(field) && !Object.is(request.get(field), value)) {
      throw new TypeError(`Route "${path}" has conflicting path values for update field "${field}".`);
    }
    request.set(field, value);
  }

  return Object.fromEntries(request) as Body & Partial<Record<string, Params[keyof Params] | Body[keyof Body]>>;
}
