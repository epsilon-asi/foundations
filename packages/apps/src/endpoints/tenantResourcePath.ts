import { toKebabCase } from '@epsilon-asi/foundation';
import { appendTransitionVerb, assertRouteNamesAvailable, isStaticPathSegment } from './assertRouteNamesAvailable.js';

export interface TenantResourcePathOptions {
  /** Singular PascalCase name of the tenant resource. */
  name: string;
  /** Optional transition verb to append to the tenant's own path. */
  verb?: string;
}

/** Derives the route for the tenant selected by the request header. */
export function tenantResourcePath({ name, verb }: TenantResourcePathOptions): string {
  const segment = toKebabCase(name);
  if (!isStaticPathSegment(segment)) {
    throw new TypeError(`Tenant name "${name}" must produce a single static path segment.`);
  }
  const path = `/${segment}`;
  assertRouteNamesAvailable({ path });
  return verb === undefined ? path : appendTransitionVerb({ path, verb });
}
