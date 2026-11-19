import { z } from 'zod/v4';

/** The scopes that an endpoint declaration can select. */
export const EndpointScope = Object.freeze({
  Tenant: 'tenant',
  Account: 'account',
  Public: 'public',
});

export type EndpointScope = (typeof EndpointScope)[keyof typeof EndpointScope];

export const DEFAULT_ENDPOINT_SCOPE = EndpointScope.Tenant;

/** Validates an endpoint scope. An omitted scope defaults to tenant. */
export const endpointScopeSchema = z.enum(EndpointScope).default(DEFAULT_ENDPOINT_SCOPE);
