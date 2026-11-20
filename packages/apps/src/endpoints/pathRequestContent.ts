import { pathRequestFields, type PathRequestFieldsOptions } from './assertPathRequestFields.js';

type RoutePath = Pick<PathRequestFieldsOptions, 'path' | 'paramFields'>;
const sectionLabels = { create: 'Create', item: 'Item', list: 'List', update: 'Update' } as const;
type RequestKind = keyof typeof sectionLabels;

/** Separates path fields from the remaining decoded fields before wire encoding. */
export function splitPathRequest<Request extends object>({ path, paramFields, request, kind }: RoutePath & {
  request: Request;
  kind: RequestKind;
}): { params: Partial<Record<string, Request[keyof Request]>>; remaining: Partial<Request> } {
  const fields = pathRequestFields({ path, paramFields });
  if (kind !== 'update' && Object.prototype.toString.call(request) !== '[object Object]') {
    throw new TypeError(`${sectionLabels[kind]} request must be an object.`);
  }
  if (kind === 'item') {
    const allowed = new Set<string | symbol>(fields.map(({ field }) => field));
    for (const key of Reflect.ownKeys(request)) {
      if (!allowed.has(key)) throw new TypeError(`Route "${path}" has no path parameter for item field "${String(key)}".`);
    }
  }
  const remaining = Object.fromEntries(Object.entries(request)) as Record<string, Request[keyof Request]>;
  const params: [string, Request[keyof Request]][] = [];

  for (const { param, field, optional } of fields) {
    const value = Object.hasOwn(remaining, field) ? remaining[field] : undefined;
    if (value === undefined) {
      if (optional) continue;
      throw new TypeError(`Route "${path}" parameter "${param}" requires ${kind} field "${field}".`);
    }
    params.push([param, value]);
  }
  // Several parameters can read one field. Remove it only after all have read it.
  for (const { field } of fields) delete remaining[field];
  return { params: Object.fromEntries(params), remaining: remaining as Partial<Request> };
}

function sectionFields(section: object, name: string): Map<string, unknown> {
  if (Object.prototype.toString.call(section) !== '[object Object]') throw new TypeError(`${name} must be an object.`);
  return new Map(Object.entries(section));
}

/** Get, Delete and List have no body fields in their flat request. */
export function assertEmptyRequestBody({ path, body, kind }: { path: string; body: object | undefined; kind: 'item' | 'list' }): void {
  if (body === undefined) return;
  if (Object.prototype.toString.call(body) !== '[object Object]' || Reflect.ownKeys(body).length > 0) {
    throw new TypeError(`Route "${path}" requires an empty ${kind} body.`);
  }
}

/** Restores the path fields to the decoded body or query section. */
export function reassemblePathRequest<Params extends object, Section extends object>({
  path, paramFields, params, section, kind,
}: RoutePath & { params: Params; section: Section; kind: RequestKind }) {
  const fields = pathRequestFields({ path, paramFields });
  const label = sectionLabels[kind];
  const supplied = sectionFields(params, `${label} params`);
  const request = sectionFields(section, `${label} ${kind === 'list' ? 'query' : 'body'}`);
  const declared = new Set<string | symbol>(fields.map(({ param }) => param));
  const paramNames = kind === 'update' ? supplied.keys() : Reflect.ownKeys(params);
  for (const param of paramNames) {
    if (!declared.has(param)) throw new TypeError(`Route "${path}" has no path parameter "${String(param)}".`);
  }
  for (const { param, field, optional } of fields) {
    if (Object.hasOwn(section, field)) {
      throw new TypeError(`Route "${path}" expects ${kind} field "${field}" in path parameter "${param}".`);
    }
    const value = supplied.get(param);
    if (value === undefined) {
      if (optional) continue;
      throw new TypeError(`Route "${path}" requires path parameter "${param}" for ${kind} field "${field}".`);
    }
    if (request.has(field) && !Object.is(request.get(field), value)) {
      throw new TypeError(`Route "${path}" has conflicting path values for ${kind} field "${field}".`);
    }
    request.set(field, value);
  }
  return Object.fromEntries(request) as Section & Partial<Record<string, Params[keyof Params] | Section[keyof Section]>>;
}
