import { expect, it } from 'vitest';
import { tenantNames } from '../../src/tenancy/tenantNames.js';

const organization = {
  header: 'X-Organization-Id',
  context: 'organization',
  field: 'organizationId',
};

it('derives the default tenant names from Organization', () => {
  expect(tenantNames({ resource: 'Organization' })).toEqual(organization);
});

it('uses the declared compound name in the header and camelCase for property names', () => {
  expect(tenantNames({ resource: 'SalesTeam' })).toEqual({
    header: 'X-SalesTeam-Id',
    context: 'salesTeam',
    field: 'salesTeamId',
  });
});

it.each([
  { header: 'X-Tenant' },
  { context: 'tenant' },
  { field: 'ownerId' },
])('overrides only the configured name %o', override => {
  expect(tenantNames({ resource: 'Organization', ...override })).toEqual({ ...organization, ...override });
});
