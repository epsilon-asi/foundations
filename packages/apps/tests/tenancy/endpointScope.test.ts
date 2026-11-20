import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { DEFAULT_ENDPOINT_SCOPE, EndpointScope, defaultEndpointScope, endpointScopeSchema } from '../../src/tenancy/endpointScope.js';

it('derives tenant scope when the resource omits its tenancy', () => {
  expect(defaultEndpointScope()).toBe(EndpointScope.Tenant);
});

it.each([
  ['owned', 'tenant'],
  ['shared', 'tenant'],
  ['self', 'tenant'],
  ['account', 'account'],
] as const)('derives %s resource tenancy as %s endpoint scope', (tenancy, expected) => {
  const scope = defaultEndpointScope({ tenancy });
  expect(scope).toBe(expected);
  expectTypeOf(scope).toEqualTypeOf<'tenant' | 'account'>();
});

it('defaults an omitted endpoint scope to tenant', () => {
  const declaration = z.object({ scope: endpointScopeSchema });
  expect(DEFAULT_ENDPOINT_SCOPE).toBe('tenant');
  expect(declaration.parse({})).toEqual({ scope: 'tenant' });
});

it.each(['tenant', 'account', 'public'] as const)('preserves the explicit %s scope', scope => {
  expect(endpointScopeSchema.parse(scope)).toBe(scope);
});

it.each(['platform', 'unknown', null])('rejects an unsupported scope %j', scope => {
  expect(endpointScopeSchema.safeParse(scope).success).toBe(false);
});

it('exposes the same scope values in TypeScript and the schema', () => {
  expect(EndpointScope).toEqual({ Tenant: 'tenant', Account: 'account', Public: 'public' });
  expectTypeOf<EndpointScope>().toEqualTypeOf<'tenant' | 'account' | 'public'>();
  expectTypeOf<z.input<typeof endpointScopeSchema>>().toEqualTypeOf<EndpointScope | undefined>();
  expectTypeOf<z.output<typeof endpointScopeSchema>>().toEqualTypeOf<EndpointScope>();
});
