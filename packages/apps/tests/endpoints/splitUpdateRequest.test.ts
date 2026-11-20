import { expect, expectTypeOf, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { crudPaths } from '../../src/endpoints/crudPaths.js';
import { splitUpdateRequest } from '../../src/endpoints/splitUpdateRequest.js';

it('maps the flat ID to the item parameter and sends only the update fields in the body', () => {
  const request = Object.freeze({ id: 'a', name: 'Acme' });
  expect(splitUpdateRequest({
    path: '/offerings/:offeringId', paramFields: { offeringId: 'id' }, request,
  })).toEqual({ params: { offeringId: 'a' }, body: { name: 'Acme' } });
});

it('sends both IDs on a parent route, preserving the remaining field values', () => {
  const path = crudPaths({ name: 'SalesThread', parent: { name: 'Campaign' } }).item;
  const editedAt = new Date('2026-11-19T00:00:00Z');
  const { params, body } = splitUpdateRequest({
    path,
    paramFields: { salesThreadId: 'id' },
    request: { campaignId: 7, id: 'a', editedAt, name: null },
  });
  expect(params).toEqual({ campaignId: 7, salesThreadId: 'a' });
  expect(body).toEqual({ editedAt, name: null });
  expect(body.editedAt).toBe(editedAt);
  expectTypeOf(body.editedAt).toEqualTypeOf<Date | undefined>();
});

it('keeps a tenant update body intact when its route has no parameters', () => {
  const request = { name: 'Acme' };
  const { body, params } = splitUpdateRequest({ path: '/organization', request });
  expect(params).toEqual({});
  expect(body).toEqual(request);
  expect(body).not.toBe(request);
});

it('uses only mapped and present fields in optional path groups', () => {
  const path = '/reports/:period{/*rest}';
  expect(splitUpdateRequest({ path, request: { period: 'q1', name: 'New' } })).toEqual({
    params: { period: 'q1' }, body: { name: 'New' },
  });
  expect(splitUpdateRequest({ path, request: { period: 'q1', rest: ['one', 'two'] } })).toEqual({
    params: { period: 'q1', rest: ['one', 'two'] }, body: {},
  });
  expect(() => splitUpdateRequest({ path, request: { name: 'New' } })).toThrow('requires update field "period"');
});

it('reads a field used by multiple parameters and drops it from the body once', () => {
  expect(splitUpdateRequest({
    path: '/reports/:first/:second', paramFields: { first: 'id', second: 'id' }, request: { id: 'a' },
  })).toEqual({ params: { first: 'a', second: 'a' }, body: {} });
});

it.each(['/reports/{:period', '/reports/}:period'])('rejects an unbalanced group in %s', path => {
  expect(() => splitUpdateRequest({ path, request: { period: 'q1' } })).toThrow(ApiDefinitionError);
});

it('preserves escaped literal braces and braces in quoted parameter names', () => {
  const path = '/reports/\\{v/:"period}"/{:"tag{"}';
  expect(splitUpdateRequest({ path, request: { 'period}': 'q1', name: 'New' } })).toEqual({
    params: { 'period}': 'q1' }, body: { name: 'New' },
  });
});

it('uses own data for parameter mappings, parameter values and body fields', () => {
  const paramFields = Object.create({ period: 'wrong' }) as Record<string, string>;
  const request = Object.assign(Object.create({ inherited: 'outside' }), { period: 'q1', constructor: 'display' });
  const { params, body } = splitUpdateRequest({ path: '/reports/:period', paramFields, request });
  expect(params).toEqual({ period: 'q1' });
  expect(body).toEqual({ constructor: 'display' });
  expect(() => splitUpdateRequest({ path: '/reports/:inherited', request })).toThrow('requires update field "inherited"');

  const unusual = splitUpdateRequest({
    path: '/reports/:"__proto__"', paramFields: { ['__proto__']: 'period' }, request: { period: 'q1' },
  });
  expect(Object.keys(unusual.params)).toEqual(['__proto__']);
  expect(unusual.params['__proto__']).toBe('q1');
});
