import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { z } from 'zod/v4';
import {
  ApiDefinitionError, CLIENT_FAILURE_CODES, CRUD_OPERATIONS, DEFAULT_ENDPOINT_SCOPE, DEFAULT_MAX_PER_PAGE, DEFAULT_MAX_SEARCH_LENGTH, DEFAULT_PAGE, DEFAULT_PER_PAGE,
  DomainError, EndpointScope, FILTER_OPERATORS, FilterOperator, FRAMEWORK_ENGLISH_MESSAGES, ResourceDefinitionError, SERVER_FAILURE_CODES, SUCCESS_CODES, SortDirection,
  apiVersionHeaders, apiVersionSchema, assertFieldPatchModes, assertOptionNamesAvailable, assertPathRequestFields, assertResourceOwner, assertRouteNamesAvailable, assertUniqueRoutes,
  booleanWireCodec, crudEndpointNames, crudExtension, crudPaths, crudRouteMetadata, cursorListQuerySchema,
  dateWireCodec, defaultEndpointScope, defaultFailureCodes, defineErrors, domainErrorMessageKey,
  enabledCrudOperations, endpointScopeSchema, enumOptionMessageKey, failure, fieldMessageKeys, fields, filterOperatorMessageKey, httpExtension,
  isFailure, itemParamName, listResponseKey, messageKeys, newId, numberWireCodec, offsetListQuerySchema, offsetPaginationDefaults, offsetPaginationQuerySchema,
  reassembleUpdateRequest, resolveCrudIdField, resolveEndpointPrincipals, resolveFieldFilter, resolveFilterOperators, resolveFilters, resolveSorts, resolveTenantField, responseTypeUnion,
  searchQuerySchema, selectOperationFields, serverOnlyFields,
  splitUpdateRequest, tenantHeaders, tenantNames, tenantResourcePath, transitionRouteMetadata, uiExtension, updateFieldSchema, wireInputJsonSchema,
} from '@epsilon-asi/apps';
import manifest from '@epsilon-asi/apps/package.json' with { type: 'json' };

assert.equal(manifest.type, 'module');
assert.equal(typeof fields, 'function');
assert.equal(apiVersionSchema.parse('2026-11-16'), '2026-11-16');
assert.deepEqual(apiVersionHeaders({ version: '2024-02-29', apiVersion: '2026-11-16' }), { 'X-Api-Version': '2024-02-29' });
assert.deepEqual(tenantHeaders({ header: 'X-Organization-Id', tenant: () => 'org-a' }), { 'X-Organization-Id': 'org-a' });
assert.equal(selectOperationFields({ fields: new Map(), operation: 'read' }).size, 0);
assert.throws(() => resolveCrudIdField({ name: 'Offering', fields: new Map() }), ResourceDefinitionError);
assert.throws(() => resolveTenantField({ name: 'Offering', fields: new Map() }), ResourceDefinitionError);
assert.equal(serverOnlyFields({ fields: new Map() }).size, 0);
assert.doesNotThrow(() => assertFieldPatchModes({ name: 'Report', fields: new Map() }));
assert.deepEqual(Object.keys(resolveSorts({ name: 'Report', fields: new Map() })), []);
const emptyReport = { name: 'Report', fields: new Map(), extensions: {} };
assert.deepEqual(messageKeys(emptyReport), []);
assert.ok(Object.isFrozen(resolveFilters({ model: emptyReport })));
assert.throws(() => assertResourceOwner({ name: 'MfaFactor', tenancy: 'account' }), ResourceDefinitionError);
const patch = z.object({ rank: updateFieldSchema({ schema: z.int().positive().catch(1) }) });
assert.deepEqual(patch.parse({}), {});
assert.equal(patch.safeParse({ rank: 0 }).success, false);
await access(new URL(manifest.exports['.'].types, import.meta.resolve('@epsilon-asi/apps/package.json')));
assert.equal(newId()[14], '7');
assert.equal(crudEndpointNames({ name: 'Company', plural: 'Companies' }).List, 'ListCompanies');
assert.deepEqual(crudPaths({ name: 'ApiKey' }), { collection: '/api-keys', item: '/api-keys/:apiKeyId' });
assert.equal(crudPaths({ name: 'SalesThread', parent: { name: 'SalesCampaign' } }).collection,
  '/sales-campaigns/:salesCampaignId/sales-threads');
assert.deepEqual(CRUD_OPERATIONS.Delete, { method: 'delete', code: 200 });
assert.deepEqual(crudRouteMetadata({ name: 'Offering', operations: { Delete: false } })[0], {
  kind: 'crud', operation: 'Create', name: 'CreateOffering', method: 'post', path: '/offerings', code: 201, docs: true, scope: 'tenant',
  principals: ['user', 'apiKey'],
});
assert.deepEqual(transitionRouteMetadata({ name: 'Offering', verb: 'archive' }), {
  kind: 'transition', name: 'ArchiveOffering', method: 'post', path: '/offerings/:offeringId/archive',
});
assert.deepEqual(enabledCrudOperations({ tenancy: 'shared' }), ['Get', 'List']);
assert.throws(() => crudRouteMetadata({ name: 'DirectoryItem', tenancy: 'shared' }), ApiDefinitionError);
const sharedDirectory = crudRouteMetadata({ name: 'DirectoryItem', tenancy: 'shared', access: { read: 'VIEWER' } });
assert.equal(sharedDirectory.find(route => route.operation === 'List').Access, 'VIEWER');
assert.deepEqual(resolveEndpointPrincipals({ scope: 'account' }), ['user']);
assert.deepEqual(offsetPaginationDefaults(), { page: 0, perPage: 20, maxPerPage: 100 });
assert.deepEqual(offsetPaginationQuerySchema().parse({ page: '2' }), { page: 2, perPage: 20 });
assert.deepEqual(cursorListQuerySchema().decode({ cursor: 'next+/=' }), { cursor: 'next+/=', perPage: 20 });
assert.deepEqual(offsetListQuerySchema({ search: { fields: ['name'] } }).parse({ q: 'invoices' }), {
  page: 0, perPage: 20, q: 'invoices',
});
const reportRoute = { method: 'get', path: '/reports' };
assert.throws(() => assertUniqueRoutes([reportRoute, reportRoute]), ApiDefinitionError);
assert.equal(wireInputJsonSchema(dateWireCodec).format, 'date-time');
assert.throws(() => assertPathRequestFields({ path: '/reports/:period', request: z.object({}) }), ApiDefinitionError);
assert.deepEqual(defaultFailureCodes({ scope: 'public', path: '/sign-in' }), [422, 429, 500]);
assert.equal(tenantResourcePath({ name: 'Organization', verb: 'archive' }), '/organization/archive');
assert.throws(() => assertOptionNamesAvailable({ versioned: false }), /versioned/);
assert.throws(() => crudRouteMetadata({ name: 'Offering', operations: { List: { versioned: false } } }), /versioned/);
assert.equal(itemParamName('ApiKey'), 'apiKeyId');
const update = splitUpdateRequest({
  path: '/offerings/:offeringId', paramFields: { offeringId: 'id' }, request: { id: 'a', name: 'Acme' },
});
assert.equal(update.params.offeringId, 'a');
assert.equal(update.body.name, 'Acme');
assert.ok(!Object.hasOwn(update.body, 'id'));
assert.deepEqual(reassembleUpdateRequest({ path: '/offerings/:offeringId', paramFields: { offeringId: 'id' }, ...update }), {
  id: 'a', name: 'Acme',
});
assert.equal(listResponseKey({ name: 'ApiKey' }), 'apiKeys');
assert.throws(() => assertRouteNamesAvailable({ path: '/offerings/bulk' }), /bulk/);
assert.equal(DEFAULT_ENDPOINT_SCOPE, EndpointScope.Tenant);
assert.equal(defaultEndpointScope({ tenancy: 'account' }), EndpointScope.Account);
assert.equal(endpointScopeSchema.parse(undefined), DEFAULT_ENDPOINT_SCOPE);
assert.equal(domainErrorMessageKey('OrgBilling.UNPAID'), 'errors.OrgBilling.UNPAID');
assert.ok(isFailure(failure.notFound()));
assert.equal(failure.notFound().code, CLIENT_FAILURE_CODES.NotFound);
assert.equal(isFailure({ code: 404 }), false);
const OrgBillingError = defineErrors('OrgBilling', { UNPAID: { code: 402 } });
const unpaid = new OrgBillingError.Unpaid();
assert.ok(unpaid instanceof DomainError);
assert.equal(unpaid.error, OrgBillingError.Types.UNPAID);
assert.equal(unpaid.code, 402);
assert.deepEqual(SUCCESS_CODES, { Ok: 200, Created: 201 });
assert.equal(CLIENT_FAILURE_CODES.BadRequest, 400);
assert.equal(CLIENT_FAILURE_CODES.TooManyRequests, 429);
assert.ok(Object.isFrozen(CLIENT_FAILURE_CODES));
assert.deepEqual(SERVER_FAILURE_CODES, { InternalServerError: 500, ServiceUnavailable: 503 });
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
assert.equal(FRAMEWORK_ENGLISH_MESSAGES[filterOperatorMessageKey(FilterOperator.Gte)], 'Greater than or equal to');
assert.equal(FRAMEWORK_ENGLISH_MESSAGES[domainErrorMessageKey('Auth.TOKEN_EXPIRED')], 'Your access token has expired.');
const statusReply = responseTypeUnion({ response: z.strictObject({ code: z.literal(200) }), failures: [404] });
assert.equal(statusReply.decode({ code: 404, error: 'Record.MISSING', traceId: 'request' }).code, 404);
assert.ok(FILTER_OPERATORS.text.includes(FilterOperator.ILike));
assert.deepEqual(resolveFilterOperators({ kind: 'text', cap: [FilterOperator.ILike] }), ['$ilike']);
assert.deepEqual(resolveFieldFilter({ schema: z.enum(['DRAFT', 'LIVE']), cap: true }), {
  kind: 'enum', operators: FILTER_OPERATORS.enum,
});
assert.deepEqual(resolveFieldFilter({ schema: z.union([z.literal('draft'), z.literal('live')]), cap: ['$in'] }), {
  kind: 'enum', operators: ['$in'],
});
assert.deepEqual(resolveFieldFilter({ schema: z.boolean(), cap: true }), { kind: 'boolean', operators: FILTER_OPERATORS.boolean });
assert.deepEqual(resolveFieldFilter({ schema: z.date(), cap: ['$gte'] }), { kind: 'range', operators: ['$gte'] });
assert.deepEqual(resolveFieldFilter({ schema: z.array(z.string()), cap: true }), { kind: 'array', operators: FILTER_OPERATORS.array });
assert.deepEqual(resolveFieldFilter({ schema: z.array(z.string()).nullable(), cap: ['$exists', '$eq'] }), {
  kind: 'array', operators: ['$exists', '$eq'],
});
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
