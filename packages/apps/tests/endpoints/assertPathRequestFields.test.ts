import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { assertPathRequestFields } from '../../src/endpoints/assertPathRequestFields.js';
import { crudPaths } from '../../src/endpoints/crudPaths.js';

it('accepts a flat request field matching the route parameter', () => {
  expect(() => assertPathRequestFields({
    path: '/reports/:period', request: z.strictObject({ period: z.string(), format: z.string() }),
  })).not.toThrow();
});

it('identifies the path and missing field at definition time', () => {
  const request = z.object({ filter: z.object({ period: z.string() }) });
  const define = () => assertPathRequestFields({ path: '/reports/:period', request });
  expect(define).toThrow(ApiDefinitionError);
  expect(define).toThrow('Route "/reports/:period" parameter "period" has no request field "period".');
});

it('checks both IDs when a parented CRUD item maps its own path parameter to id', () => {
  const path = crudPaths({ name: 'SalesThread', parent: { name: 'Campaign' } }).item;
  const request = z.object({ campaignId: z.string(), id: z.string() });
  const paramFields = { salesThreadId: 'id' };
  expect(() => assertPathRequestFields({ path, request, paramFields })).not.toThrow();
  expect(() => assertPathRequestFields({ path, request: request.omit({ id: true }), paramFields }))
    .toThrow('parameter "salesThreadId" has no request field "id"');
  expect(() => assertPathRequestFields({ path, request: request.omit({ campaignId: true }), paramFields }))
    .toThrow('parameter "campaignId" has no request field "campaignId"');
});

it('handles escaped markers, quoted names, Unicode identifiers and optional wildcards', () => {
  const path = '/files\\:v/\\*literal/:région/:"report-\\\"kind"{/*rest}';
  const request = z.object({ région: z.string(), 'report-"kind': z.string(), rest: z.array(z.string()).optional() });
  expect(() => assertPathRequestFields({ path, request })).not.toThrow();
  expect(() => assertPathRequestFields({ path, request: request.omit({ rest: true }) })).toThrow('no request field "rest"');
  expect(() => assertPathRequestFields({ path, request: request.omit({ 'report-"kind': true }) })).toThrow(ApiDefinitionError);
});

it('requires an explicitly declared field even for names also found on the object prototype', () => {
  expect(() => assertPathRequestFields({ path: '/reports/:toString', request: z.looseObject({}) }))
    .toThrow('parameter "toString" has no request field "toString"');
});

it('accepts a static route with an empty request', () => {
  expect(() => assertPathRequestFields({ path: '/reports', request: z.object({}) })).not.toThrow();
});

it.each(['/reports/:', '/reports/:"period'])('rejects a path parameter without a complete name in %s', path => {
  expect(() => assertPathRequestFields({ path, request: z.object({}) })).toThrow(ApiDefinitionError);
});
