import { expect, it } from 'vitest';
import { assertRouteNamesAvailable } from '../../src/endpoints/assertRouteNamesAvailable.js';

it.each([
  ['/bulk/offerings', 'bulk'],
  ['/offerings/bulk/create', 'bulk'],
  ['/offerings/:offeringId/restore/', 'restore'],
  ['/offerings/Bulk/create', 'Bulk'],
])('rejects a reserved static segment in %s', (path, segment) => {
  expect(() => assertRouteNamesAvailable({ path }))
    .toThrow(`Route "${path}" uses the reserved path segment "${segment}".`);
});

it.each(['bulk', 'restore', 'Restore'])('rejects the reserved transition verb %s', verb => {
  expect(() => assertRouteNamesAvailable({ path: '/offerings', verb }))
    .toThrow(`Transition verb "${verb}" is reserved.`);
});

it('accepts ordinary names, reserved prefixes and named parameters', () => {
  expect(() => assertRouteNamesAvailable({ path: '/offerings/archive', verb: 'archive' })).not.toThrow();
  expect(() => assertRouteNamesAvailable({ path: '/bulkhead/:restore', verb: 'restored' })).not.toThrow();
});
