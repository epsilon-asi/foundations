import { expect, it, vi } from 'vitest';
import { apiVersionHeaders } from '../../src/client/apiVersionHeaders.js';
import { tenantHeaders } from '../../src/client/tenantHeaders.js';
import { tenantNames } from '../../src/tenancy/tenantNames.js';

it('reads the current tenant once for each request', () => {
  const { header } = tenantNames({ resource: 'Organization' });
  let selected: string | undefined = 'org-a';
  const tenant = vi.fn(() => selected);
  const options = { header, tenant };

  const first = tenantHeaders(options);
  selected = 'org-b';
  const second = tenantHeaders(options);
  selected = undefined;
  expect(tenantHeaders(options)).toStrictEqual({});
  expect(first).toStrictEqual({ 'X-Organization-Id': 'org-a' });
  expect(second).toStrictEqual({ 'X-Organization-Id': 'org-b' });
  expect(tenant).toHaveBeenCalledTimes(3);
});

it('combines the configured tenant header with version headers for fetch', () => {
  const { header } = tenantNames({ resource: 'Organization', header: 'X-Workspace' });
  const headers = new Headers({
    ...apiVersionHeaders({ version: '2026-11-16' }),
    ...tenantHeaders({ header, tenant: () => 'org-a' }),
  });
  expect(headers.get('X-Workspace')).toBe('org-a');
  expect(headers.has('X-Organization-Id')).toBe(false);
  expect(headers.get('X-Api-Version')).toBe('2026-11-16');
});

it('omits the header when the client has no tenant callback', () => {
  expect(tenantHeaders({ header: 'X-Organization-Id' })).toStrictEqual({});
});

it('isolates header records across clients and requests', () => {
  const header = 'X-Organization-Id';
  const firstClient = { header, tenant: () => 'org-a' };
  const first = tenantHeaders(firstClient);
  const second = tenantHeaders({ header, tenant: () => 'org-b' });
  first[header] = 'changed';
  expect(tenantHeaders(firstClient)[header]).toBe('org-a');
  expect(second[header]).toBe('org-b');
});
