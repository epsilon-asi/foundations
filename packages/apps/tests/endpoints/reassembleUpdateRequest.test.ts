import { expect, expectTypeOf, it } from 'vitest';
import { crudPaths } from '../../src/endpoints/crudPaths.js';
import { reassembleUpdateRequest } from '../../src/endpoints/reassembleUpdateRequest.js';
import { splitUpdateRequest } from '../../src/endpoints/splitUpdateRequest.js';

const item = { path: '/offerings/:offeringId', paramFields: { offeringId: 'id' } };

it('round-trips a parented update, preserving decoded body and ID values', () => {
  const path = crudPaths({ name: 'SalesThread', parent: { name: 'Campaign' } }).item;
  const route = { path, paramFields: { salesThreadId: 'id' } };
  const request = { campaignId: 42, id: 'a', name: 'Acme', editedAt: new Date('2026-11-16T12:00:00Z') };
  const parts = splitUpdateRequest({ ...route, request });
  expect(parts).toEqual({ params: { campaignId: 42, salesThreadId: 'a' }, body: { name: 'Acme', editedAt: request.editedAt } });
  const flat = reassembleUpdateRequest({ ...route, ...parts });
  expect(flat).toEqual(request);
  expect(flat.editedAt).toBe(request.editedAt);
  expectTypeOf(flat.editedAt).toEqualTypeOf<Date | undefined>();
});

it('restores the custom item alias without changing either section', () => {
  const body = Object.freeze({ name: 'Acme' });
  const params = Object.freeze({ offeringId: 'a' });
  const request = reassembleUpdateRequest({ ...item, params, body });
  expect(request).toEqual({ id: 'a', name: 'Acme' });
  expectTypeOf(request.name).toBeString();
});

it('returns a fresh body for a parameter-free tenant route', () => {
  const body = Object.freeze({ label: '', enabled: false, description: null });
  const flat = reassembleUpdateRequest({ path: '/organization', params: {}, body });
  expect(flat).toEqual(body);
  expect(flat).not.toBe(body);
});

it('omits an absent optional path group and preserves a supplied wildcard value', () => {
  const route = { path: '/reports/:period{/*rest}', body: { name: 'Updated' } };
  const rest = ['public', 'summary'];
  expect(reassembleUpdateRequest({ ...route, params: { period: 'q1' } })).toEqual({ period: 'q1', name: 'Updated' });
  expect(reassembleUpdateRequest({ ...route, params: { period: 'q1', rest } }).rest).toBe(rest);
  expect(() => reassembleUpdateRequest({ ...route, params: { period: 'q1' }, body: { rest } })).toThrow('in path parameter "rest"');
});

it('rejects missing, unknown, and misplaced path values', () => {
  expect(() => reassembleUpdateRequest({ ...item, params: {}, body: { name: 'Acme' } })).toThrow('requires path parameter "offeringId"');
  expect(() => reassembleUpdateRequest({ ...item, params: { offeringId: 'a', other: 'b' }, body: {} })).toThrow('no path parameter "other"');
  expect(() => reassembleUpdateRequest({ ...item, params: { offeringId: 'a' }, body: { id: 'a' } })).toThrow('update field "id" in path');
});

it('requires parameters mapped to the same request field to agree', () => {
  const route = { path: '/reports/:first/:second', paramFields: { first: 'id', second: 'id' }, body: {} };
  expect(reassembleUpdateRequest({ ...route, params: { first: 0, second: 0 } })).toEqual({ id: 0 });
  expect(() => reassembleUpdateRequest({ ...route, params: { first: 0, second: 1 } })).toThrow('conflicting path values for update field "id"');
});

it('copies own fields, including prototype-named fields, as data', () => {
  const params = Object.assign(Object.create({ extra: 'inherited' }), { period: 'q1' });
  const body = Object.assign(Object.create({ ignored: true }), { constructor: 'display' });
  const flat = reassembleUpdateRequest({ path: '/reports/:period', paramFields: { period: '__proto__' }, params, body });
  expect(Object.keys(flat).sort()).toEqual(['__proto__', 'constructor']);
  expect(flat['__proto__']).toBe('q1');
  expect(Object.getPrototypeOf(flat)).toBe(Object.prototype);
  expect(() => reassembleUpdateRequest({ path: '/reports/:extra', params: Object.create({ extra: 'inherited' }), body }))
    .toThrow('requires path parameter "extra"');
});

it('requires object sections even for a route with no path fields', () => {
  expect(() => reassembleUpdateRequest({ path: '/organization', params: [], body: {} })).toThrow('Update params must be an object');
  expect(() => reassembleUpdateRequest({ path: '/organization', params: {}, body: [] })).toThrow('Update body must be an object');
});
