import { toKebabCase } from '@epsilon-asi/foundation';
import { assertRouteNamesAvailable } from './assertRouteNamesAvailable.js';
import { itemParamName } from './itemParamName.js';
import { pluralResourceName, type CrudEndpointNamesOptions } from './resourceNames.js';

export interface CrudPathsOptions extends CrudEndpointNamesOptions {
  /** Optional non-tenant parent. Its item path prefixes the child's collection. */
  parent?: CrudEndpointNamesOptions;
}

function resourcePathParts(options: CrudEndpointNamesOptions) {
  if (!options.name) throw new TypeError('A resource name is required to derive CRUD paths.');
  const plural = pluralResourceName(options);
  const segment = toKebabCase(plural);
  if (!/^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u.test(segment)) {
    throw new TypeError(`Collection name "${plural}" must produce a single static path segment.`);
  }
  assertRouteNamesAvailable({ path: `/${segment}` });
  return { segment, param: itemParamName(options.name) };
}

/** Derives resource collection and item path templates, optionally within a parent item. */
export function crudPaths(options: CrudPathsOptions) {
  const child = resourcePathParts(options);
  const parent = options.parent && resourcePathParts(options.parent);
  if (parent?.param === child.param) {
    throw new TypeError(`Parent and child would both use the path parameter "${child.param}".`);
  }
  const prefix = parent ? `/${parent.segment}/:${parent.param}` : '';
  const collection = `${prefix}/${child.segment}`;
  return { collection, item: `${collection}/:${child.param}` };
}
