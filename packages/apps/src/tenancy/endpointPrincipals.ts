import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { DEFAULT_ENDPOINT_SCOPE, EndpointScope } from './endpointScope.js';

/** Authenticated principal defaults for ordinary HTTP endpoints. Public endpoints allow anonymous callers. */
export const DEFAULT_ENDPOINT_PRINCIPALS = Object.freeze({
  tenant: Object.freeze(['user', 'apiKey'] as const),
  account: Object.freeze(['user'] as const),
  public: undefined,
});

const tenantToolPrincipals = Object.freeze([...DEFAULT_ENDPOINT_PRINCIPALS.tenant, 'agent'] as const);
export type EndpointPrincipalKind = (typeof tenantToolPrincipals)[number];

export interface ResolveEndpointPrincipalsOptions {
  /** Endpoint name for definition errors. */
  name?: string;
  /** Defaults to tenant scope. */
  scope?: EndpointScope;
  /** Exposes a tenant endpoint to agent callers. Default: false. */
  tool?: boolean;
  /** Explicit authenticated principal restrictions on this endpoint. */
  principals?: readonly EndpointPrincipalKind[];
  /** A resource-wide restriction to narrow when the operation changes scope or tool exposure. */
  inheritedPrincipals?: readonly EndpointPrincipalKind[];
}

/** Returns allowed authenticated kinds, or undefined for a public endpoint. */
export function resolveEndpointPrincipals(options: ResolveEndpointPrincipalsOptions & { scope: 'public' }): undefined;
export function resolveEndpointPrincipals(
  options?: ResolveEndpointPrincipalsOptions & { scope?: 'tenant' | 'account' },
): readonly EndpointPrincipalKind[];
export function resolveEndpointPrincipals(options?: ResolveEndpointPrincipalsOptions): readonly EndpointPrincipalKind[] | undefined;
export function resolveEndpointPrincipals({
  name, scope = DEFAULT_ENDPOINT_SCOPE, tool = false, principals, inheritedPrincipals,
}: ResolveEndpointPrincipalsOptions = {}): readonly EndpointPrincipalKind[] | undefined {
  const endpoint = name ? `Endpoint "${name}"` : 'Endpoint';
  if (typeof scope !== 'string' || !Object.hasOwn(DEFAULT_ENDPOINT_PRINCIPALS, scope)) {
    throw new ApiDefinitionError(`${endpoint} has an invalid scope.`);
  }
  if (typeof tool !== 'boolean') throw new ApiDefinitionError(`The tool option on ${endpoint} must be a boolean.`);
  const restriction = principals === undefined ? inheritedPrincipals : principals;
  if (restriction !== undefined && !Array.isArray(restriction)) {
    throw new ApiDefinitionError(`The principals option on ${endpoint} must be an array.`);
  }
  if (scope === EndpointScope.Public) {
    if (principals?.length) throw new ApiDefinitionError(`${endpoint} has public scope and cannot require authenticated principals.`);
    return undefined;
  }
  const allowed: readonly EndpointPrincipalKind[] = scope === EndpointScope.Tenant && tool
    ? tenantToolPrincipals : DEFAULT_ENDPOINT_PRINCIPALS[scope];
  if (restriction === undefined) return allowed;

  const result = new Set<EndpointPrincipalKind>();
  for (const kind of restriction) {
    if (!tenantToolPrincipals.includes(kind)) {
      const value = typeof kind === 'string' ? ` "${kind}"` : '';
      throw new ApiDefinitionError(`${endpoint} has an unsupported principal kind${value}.`);
    }
    if (allowed.includes(kind)) result.add(kind);
    else if (principals !== undefined) throw new ApiDefinitionError(`${endpoint} cannot accept principal "${kind}" with its scope and tool setting.`);
  }
  return Object.freeze([...result]);
}
