import { expect, it } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { assertUniqueRoutes } from '../../src/endpoints/assertUniqueRoutes.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';

it('names both endpoints that declare GET /reports', () => {
  const routes = [
    { name: 'ListReports', method: 'get', path: '/reports' },
    { name: 'DailyReports', method: 'GET', path: '/reports' },
  ] as const;
  expect(() => assertUniqueRoutes(routes)).toThrow(ApiDefinitionError);
  expect(() => assertUniqueRoutes(routes)).toThrow('duplicate route GET /reports (ListReports, DailyReports)');
});

it('accepts GET and POST on the same path and checks each collection independently', () => {
  const reports = [{ method: 'GET', path: '/reports' }, { method: 'POST', path: '/reports' }];
  assertUniqueRoutes(reports);
  assertUniqueRoutes(reports);
});

it('finds a custom route that collides with an enabled CRUD route', () => {
  const routes = crudRouteMetadata({ name: 'Report', docs: false });
  expect(() => assertUniqueRoutes([...routes, { name: 'ReportDetail', method: 'GET', path: '/REPORTS/:id/' }]))
    .toThrow('duplicate route GET /REPORTS/:id/ (GetReport, ReportDetail)');
});

it.each([
  ['/reports/:period', '/reports/:"report-period"'],
  ['/reports{/*rest}', '/reports{/*"more-items"}'],
  ['/réSumé', '/RÉSUMÉ/'],
])('treats equivalent templates %s and %s as a duplicate', (first, second) => {
  expect(() => assertUniqueRoutes([{ method: 'GET', path: first }, { method: 'GET', path: second }]))
    .toThrow(ApiDefinitionError);
});

it('keeps literals, parameters, wildcards, and optional groups distinct', () => {
  const paths = ['/reports/archive', '/reports/:id', '/reports/*rest', '/reports{/*rest}', '/reports/\\:id', '/reports/\\*rest'];
  assertUniqueRoutes(paths.map(path => ({ method: 'get', path })));
});

it('preserves Unicode distinctions made by the router', () => {
  assertUniqueRoutes(['ss', 'ß', 's', 'ſ'].map(segment => ({ method: 'get', path: `/${segment}` })));
});
