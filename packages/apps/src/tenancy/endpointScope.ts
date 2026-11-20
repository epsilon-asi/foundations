import { z } from 'zod/v4';
import type { DeclaredOption } from '../endpoints/declaredOption.js';

/** The scopes that an endpoint declaration can select. */
export const EndpointScope = Object.freeze({
  Tenant: 'tenant',
  Account: 'account',
  Public: 'public',
});

export type EndpointScope = (typeof EndpointScope)[keyof typeof EndpointScope];

export const DEFAULT_ENDPOINT_SCOPE = EndpointScope.Tenant;

/** How a resource belongs to a tenant or account. */
export type ResourceTenancy = 'owned' | 'shared' | 'self' | 'account';

export interface DefaultEndpointScopeOptions {
  /** Declared resource tenancy. Omitting it gives the endpoint tenant scope. */
  tenancy?: ResourceTenancy;
}

type ScopeOption<Source, Key extends PropertyKey> = unknown extends Source ? unknown : DeclaredOption<Source, Key>;

/** The default scope allowed by a declaration's resource tenancy. */
export type TenancyScopeOf<Options, Tenancy = ScopeOption<Options, 'tenancy'>> =
  ('account' extends Tenancy ? typeof EndpointScope.Account : never)
  | ([Tenancy] extends ['account'] ? never : typeof DEFAULT_ENDPOINT_SCOPE);

/** An optional declared scope preserves the possibility of its fallback. */
export type DeclaredScope<Settings, Fallback, Scope = ScopeOption<Settings, 'scope'>> =
  Extract<EndpointScope, Scope> | (undefined extends Scope ? Fallback : never);

/** Derives the default scope for a resource's endpoints. */
export function defaultEndpointScope({ tenancy }: DefaultEndpointScopeOptions = {}) {
  return tenancy === 'account' ? EndpointScope.Account : DEFAULT_ENDPOINT_SCOPE;
}

/** Validates an endpoint scope. An omitted scope defaults to tenant. */
export const endpointScopeSchema = z.enum(EndpointScope).default(DEFAULT_ENDPOINT_SCOPE);
