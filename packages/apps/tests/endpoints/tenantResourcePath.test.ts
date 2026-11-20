import { expect, it } from 'vitest';
import { tenantResourcePath } from '../../src/endpoints/tenantResourcePath.js';

it('uses the singular tenant resource name without a path parameter', () => {
  expect(tenantResourcePath({ name: 'Organization' })).toBe('/organization');
  expect(tenantResourcePath({ name: 'SalesAccount' })).toBe('/sales-account');
});

it('appends the declared transition verb directly to the tenant path', () => {
  expect(tenantResourcePath({ name: 'Organization', verb: 'archive' })).toBe('/organization/archive');
  expect(tenantResourcePath({ name: 'SalesAccount', verb: 'requestReview' })).toBe('/sales-account/requestReview');
});

it('checks reserved names on the singular resource and on transitions', () => {
  expect(() => tenantResourcePath({ name: 'Bulk' })).toThrow('reserved path segment "bulk"');
  expect(() => tenantResourcePath({ name: 'Organization', verb: 'Restore' })).toThrow('verb "Restore" is reserved');
});

it.each(['', ':tenantId', 'one/two'])('rejects %j as a tenant name or verb', value => {
  expect(() => tenantResourcePath({ name: value })).toThrow('single static path segment');
  expect(() => tenantResourcePath({ name: 'Organization', verb: value })).toThrow('single static path segment');
});
