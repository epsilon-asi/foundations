import { z } from 'zod/v4';

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

/** Derives the default scope for a resource's endpoints. */
export function defaultEndpointScope({ tenancy }: DefaultEndpointScopeOptions = {}) {
  return tenancy === 'account' ? EndpointScope.Account : DEFAULT_ENDPOINT_SCOPE;
}

/** Validates an endpoint scope. An omitted scope defaults to tenant. */
export const endpointScopeSchema = z.enum(EndpointScope).default(DEFAULT_ENDPOINT_SCOPE);
