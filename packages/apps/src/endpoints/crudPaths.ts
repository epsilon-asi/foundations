import { toKebabCase } from '@epsilon-asi/foundation';
import type { ResourceTenancy } from '../tenancy/endpointScope.js';
import { assertRouteNamesAvailable, isStaticPathSegment } from './assertRouteNamesAvailable.js';
import { itemParamName } from './itemParamName.js';
import { pluralResourceName, type CrudEndpointNamesOptions } from './resourceNames.js';
import { tenantResourcePath } from './tenantResourcePath.js';

export interface CrudPathsOptions extends CrudEndpointNamesOptions {
  /** A tenant resource ('self') uses its singular path for item operations. */
  tenancy?: ResourceTenancy;
  /** Optional non-tenant parent. Its item path prefixes the child's collection. */
  parent?: CrudEndpointNamesOptions;
}

function resourcePathParts(options: CrudEndpointNamesOptions) {
  if (!options.name) throw new TypeError('A resource name is required to derive CRUD paths.');
  const plural = pluralResourceName(options);
  const segment = toKebabCase(plural);
  if (!isStaticPathSegment(segment)) {
    throw new TypeError(`Collection name "${plural}" must produce a single static path segment.`);
  }
  assertRouteNamesAvailable({ path: `/${segment}` });
  return { segment, param: itemParamName(options.name) };
}

/** Derives resource collection and item path templates, optionally within a parent item. */
export function crudPaths(options: CrudPathsOptions) {
  const self = options.tenancy === 'self';
  if (self && options.parent) {
    throw new TypeError(`Tenant resource "${options.name}" cannot have a parent route.`);
  }
  const child = resourcePathParts(options);
  const parent = options.parent && resourcePathParts(options.parent);
  if (parent?.param === child.param) {
    throw new TypeError(`Parent and child would both use the path parameter "${child.param}".`);
  }
  const prefix = parent ? `/${parent.segment}/:${parent.param}` : '';
  const collection = `${prefix}/${child.segment}`;
  const item = self ? tenantResourcePath({ name: options.name }) : `${collection}/:${child.param}`;
  return { collection, item };
}
