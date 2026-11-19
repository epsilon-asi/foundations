import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import {
  CRUD_OPERATIONS, DEFAULT_ENDPOINT_SCOPE, DEFAULT_MAX_PER_PAGE, DEFAULT_MAX_SEARCH_LENGTH, DEFAULT_PAGE, DEFAULT_PER_PAGE,
  EndpointScope, FILTER_OPERATORS, FilterOperator, SUCCESS_CODES, SortDirection, assertOptionNamesAvailable,
  assertRouteNamesAvailable, booleanWireCodec, crudEndpointNames, crudExtension, crudPaths, dateWireCodec, domainErrorMessageKey,
  endpointScopeSchema, enumOptionMessageKey, fieldMessageKeys, filterOperatorMessageKey, httpExtension, itemParamName, newId,
  listResponseKey, numberWireCodec, searchQuerySchema, tenantNames, uiExtension,
} from '@epsilon-asi/apps';
import manifest from '@epsilon-asi/apps/package.json' with { type: 'json' };

assert.equal(manifest.type, 'module');
await access(new URL(manifest.exports['.'].types, import.meta.resolve('@epsilon-asi/apps/package.json')));
assert.equal(newId()[14], '7');
assert.equal(crudEndpointNames({ name: 'Company', plural: 'Companies' }).List, 'ListCompanies');
assert.deepEqual(crudPaths({ name: 'ApiKey' }), { collection: '/api-keys', item: '/api-keys/:apiKeyId' });
assert.equal(crudPaths({ name: 'SalesThread', parent: { name: 'SalesCampaign' } }).collection,
  '/sales-campaigns/:salesCampaignId/sales-threads');
assert.deepEqual(CRUD_OPERATIONS.Delete, { method: 'delete', code: 200 });
assert.throws(() => assertOptionNamesAvailable({ versioned: false }), /versioned/);
assert.equal(itemParamName('ApiKey'), 'apiKeyId');
assert.equal(listResponseKey({ name: 'ApiKey' }), 'apiKeys');
assert.throws(() => assertRouteNamesAvailable({ path: '/offerings/bulk' }), /bulk/);
assert.equal(DEFAULT_ENDPOINT_SCOPE, EndpointScope.Tenant);
assert.equal(endpointScopeSchema.parse(undefined), DEFAULT_ENDPOINT_SCOPE);
assert.equal(domainErrorMessageKey('OrgBilling.UNPAID'), 'errors.OrgBilling.UNPAID');
assert.deepEqual(SUCCESS_CODES, { Ok: 200, Created: 201 });
assert.deepEqual(tenantNames({ resource: 'Organization' }), {
  header: 'X-Organization-Id', context: 'organization', field: 'organizationId',
});
assert.equal(crudExtension.key, 'crud');
assert.equal(crudExtension.field.parse('createOnly'), 'createOnly');
assert.equal(httpExtension.key, 'http');
assert.deepEqual(httpExtension.field.parse({ name: 'display_name' }), { name: 'display_name' });
assert.equal(uiExtension.key, 'ui');
assert.deepEqual(uiExtension.type.parse({ plural: 'contact.plural' }), { plural: 'contact.plural' });
assert.equal(fieldMessageKeys({ resource: 'Offering', field: 'name' }).helperText, 'offering.name.helper');
assert.equal(enumOptionMessageKey({ resource: 'Offering', field: 'status', value: 'DRAFT' }), 'offering.status.DRAFT');
assert.equal(booleanWireCodec.decode('false'), false);
assert.equal(dateWireCodec.decode('2025-01-01T01:00:00+01:00').toISOString(), '2025-01-01T00:00:00.000Z');
assert.equal(numberWireCodec.decode('0'), 0);
assert.equal(DEFAULT_PAGE, 0);
assert.equal(DEFAULT_PER_PAGE, 20);
assert.equal(DEFAULT_MAX_PER_PAGE, 100);
assert.equal(DEFAULT_MAX_SEARCH_LENGTH, 200);
assert.equal(searchQuerySchema.parse('monthly invoices'), 'monthly invoices');
assert.deepEqual(SortDirection, { Asc: 'asc', Desc: 'desc' });
assert.equal(FilterOperator.ILike, '$ilike');
assert.equal(filterOperatorMessageKey(FilterOperator.Gte), 'filters.operator.Gte');
assert.ok(FILTER_OPERATORS.text.includes(FilterOperator.ILike));
assert.ok(!FILTER_OPERATORS.range.includes(FilterOperator.ILike));

for (const peer of ['@google-cloud/pubsub', '@mikro-orm/core', '@mikro-orm/migrations', 'express', 'redis', 'stripe']) {
  assert.equal(typeof manifest.peerDependencies?.[peer], 'string', `Missing peer dependency ${peer}`);
  assert.equal(manifest.peerDependenciesMeta?.[peer]?.optional, true, `${peer} must be optional`);
  assert.ok(!Object.hasOwn(manifest.dependencies, peer), `${peer} must be installed by the adapter consumer`);
}

assert.equal(manifest.peerDependencies['@mikro-orm/migrations'], manifest.peerDependencies['@mikro-orm/core']);

for (const driver of ['@mikro-orm/postgresql', '@mikro-orm/sqlite']) {
  assert.equal(manifest.devDependencies?.[driver], manifest.peerDependencies['@mikro-orm/core']);
  for (const group of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.ok(!Object.hasOwn(manifest[group] ?? {}, driver), `${driver} must be development-only`);
  }
}
