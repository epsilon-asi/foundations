import { expect, expectTypeOf, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { resolveEndpointPrincipals, type EndpointPrincipalKind } from '../../src/tenancy/endpointPrincipals.js';

it('derives the allowed callers from the endpoint scope and tool exposure', () => {
  expect(resolveEndpointPrincipals()).toEqual(['user', 'apiKey']);
  expect(resolveEndpointPrincipals({ tool: true })).toEqual(['user', 'apiKey', 'agent']);
  expect(resolveEndpointPrincipals({ scope: 'account', tool: true })).toEqual(['user']);
  expect(resolveEndpointPrincipals({ scope: 'public' })).toBeUndefined();
  expectTypeOf(resolveEndpointPrincipals()).toEqualTypeOf<readonly EndpointPrincipalKind[]>();
  expectTypeOf(resolveEndpointPrincipals({ scope: 'public' })).toBeUndefined();
});

it('copies and freezes explicit restrictions, preserving declaration order', () => {
  const principals: EndpointPrincipalKind[] = ['agent', 'user', 'agent'];
  const allowed = resolveEndpointPrincipals({ tool: true, principals });
  principals.pop();
  principals.pop();
  expect(allowed).toEqual(['agent', 'user']);
  expect(Object.isFrozen(allowed)).toBe(true);
  expect(Object.isFrozen(resolveEndpointPrincipals())).toBe(true);
});

it('narrows inherited restrictions to the effective scope without widening an empty result', () => {
  expect(resolveEndpointPrincipals({ scope: 'account', inheritedPrincipals: ['apiKey'] })).toEqual([]);
  expect(resolveEndpointPrincipals({ scope: 'account', inheritedPrincipals: ['apiKey', 'user'] })).toEqual(['user']);
  expect(resolveEndpointPrincipals({ scope: 'public', inheritedPrincipals: ['user'] })).toBeUndefined();
  expect(resolveEndpointPrincipals({ principals: ['apiKey'], inheritedPrincipals: ['user'] })).toEqual(['apiKey']);
});

it('rejects explicit kinds incompatible with an endpoint', () => {
  expect(() => resolveEndpointPrincipals({ scope: 'account', principals: ['apiKey'] })).toThrow(ApiDefinitionError);
  expect(() => resolveEndpointPrincipals({ scope: 'account', tool: true, principals: ['agent'] })).toThrow(ApiDefinitionError);
  expect(() => resolveEndpointPrincipals({ principals: ['agent'] })).toThrow(ApiDefinitionError);
  expect(() => resolveEndpointPrincipals({ scope: 'public', principals: ['user'] })).toThrow(ApiDefinitionError);
  // @ts-expect-error Services are in-process and cannot be declared as HTTP callers.
  expect(() => resolveEndpointPrincipals({ principals: ['service'] })).toThrow(ApiDefinitionError);
  // @ts-expect-error A string is not a principal list.
  expect(() => resolveEndpointPrincipals({ principals: 'user' })).toThrow(ApiDefinitionError);
  // @ts-expect-error A tool flag must be a boolean.
  expect(() => resolveEndpointPrincipals({ tool: 'true' })).toThrow(ApiDefinitionError);
});
