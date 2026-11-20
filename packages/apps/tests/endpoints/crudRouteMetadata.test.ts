import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { crudRouteMetadata, type CrudRouteMetadataOptions } from '../../src/endpoints/crudRouteMetadata.js';
import { defaultFailureCodes } from '../../src/endpoints/defaultFailureCodes.js';
import { reassembleUpdateRequest } from '../../src/endpoints/reassembleUpdateRequest.js';
import { splitUpdateRequest } from '../../src/endpoints/splitUpdateRequest.js';
import { ResourceDefinitionError } from '../../src/model/ResourceDefinitionError.js';
import type { Id, Readable, Tenant, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import type { SortDescriptor } from '../../src/query/resolveSorts.js';
import { transitionRouteMetadata } from '../../src/state/transitionRouteMetadata.js';
import type { EndpointPrincipalKind } from '../../src/tenancy/endpointPrincipals.js';
import type { EndpointScope } from '../../src/tenancy/endpointScope.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
const disabledOperations = { Create: false, Get: false, Update: false, Delete: false, List: false };
const tenantDefaults = { docs: true, scope: 'tenant', principals: ['user', 'apiKey'] };
class StoredRecord {
  @Prop.string({ crud: 'id' }) key!: string;
}

it('requires a primary key on resolved models with enabled CRUD routes', () => {
  class Report {
    @Prop.string() description!: string;
  }

  const report = resolve(Report);
  expect(() => crudRouteMetadata(report)).toThrow(ResourceDefinitionError);
  expect(crudRouteMetadata({ ...report, operations: disabledOperations })).toEqual([]);
});

it('checks tenant ownership on resolved models even with every CRUD operation disabled', () => {
  class Project extends StoredRecord {}
  const owned = { ...resolve(Project), tenancy: 'owned' } as const;
  expect(() => crudRouteMetadata(owned)).toThrow(ResourceDefinitionError);
  expect(() => crudRouteMetadata({ ...owned, operations: disabledOperations })).toThrow(/Project.*requires a Tenant field/);

  class Activity {
    @Prop.uuid({ crud: 'tenant' }) workspaceId!: string;
  }
  expect(crudRouteMetadata({ ...resolve(Activity), plural: 'Activities', tenancy: 'owned', operations: disabledOperations })).toEqual([]);
});

it('derives parent-scoped routes for an owned model and a name-only preview', () => {
  class Project extends StoredRecord {
    @Prop.uuid({ crud: { access: 'tenant' } }) workspaceKey!: string;
  }
  const scope = { tenancy: 'owned', parent: { name: 'Portfolio' } } as const;
  const preview = crudRouteMetadata({ name: 'Project', ...scope });
  const routes = crudRouteMetadata({ ...resolve(Project), ...scope });
  expect(preview).toHaveLength(5);
  expect(routes.map(route => route.path)).toEqual(preview.map(route => route.path));
});

it.each([undefined, 'shared', 'self'] as const)('allows a model without a Tenant field with tenancy %s', tenancy => {
  class Project extends StoredRecord {}
  expect(crudRouteMetadata({ ...resolve(Project), tenancy, access: { read: 'VIEWER' } })).toHaveLength(tenancy === 'shared' ? 2 : 5);
});

it('maps the item parameter to an inherited ID field and round-trips a parented update', () => {
  class CatalogItem extends StoredRecord {
    @Prop.string({ crud: 'editable' }) title!: string;
  }
  const [create, get, update, remove, list] = crudRouteMetadata({ ...resolve(CatalogItem), parent: { name: 'Catalog' } });
  for (const route of [get, update, remove]) expect(route.paramFields).toEqual({ catalogItemId: 'key' });
  for (const route of [create, list]) expect(route).not.toHaveProperty('paramFields');

  const request = { catalogId: 'catalog-a', key: 'item-b', title: 'Revised' };
  const parts = splitUpdateRequest({ ...update, request });
  expect(parts).toEqual({ params: { catalogId: 'catalog-a', catalogItemId: 'item-b' }, body: { title: 'Revised' } });
  expect(reassembleUpdateRequest({ ...update, ...parts })).toEqual(request);
  expect(() => reassembleUpdateRequest({ ...update, ...parts, body: { key: 'other' } })).toThrow('in path parameter "catalogItemId"');
});

it('validates search fields on the resolved resource when declaring CRUD routes', () => {
  class TitledRecord extends StoredRecord {
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  }
  class Report extends TitledRecord {
    @Prop.string({ crud: 'writeOnly' }) draftNote!: WriteOnly<string>;
  }
  const model = resolve(Report);
  expect(crudRouteMetadata({ ...model, list: { search: { fields: ['title'] } } })).toHaveLength(5);
  // @ts-expect-error A write-only field cannot be searched.
  expect(() => crudRouteMetadata({ ...model, list: { search: { fields: ['draftNote'] } } })).toThrow(ApiDefinitionError);
});

it('checks filter declarations against inherited fields and the owning tenant marker', () => {
  class Entry extends StoredRecord {
    @Prop.string({ crud: { access: 'tenant' } }) workspaceKey!: Tenant<string>;
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  }
  class Report extends Entry {}
  const report = { ...resolve(Report), tenancy: 'owned' } as const;
  const routes = crudRouteMetadata({ ...report, list: { filter: { title: ['$ilike'] } } });
  const list = routes.find(route => route.operation === 'List')!;
  expect(list.name).toBe('ListReports');
  expect(list.Filters).toEqual({ title: { path: 'title', labelKey: 'report.title', kind: 'text', operators: ['$ilike'] } });
  expectTypeOf(list.Filters.title.path).toEqualTypeOf<'title'>();
  expectTypeOf(list.Filters.title.operators).toEqualTypeOf<readonly '$ilike'[]>();
  expect(Object.isFrozen(list.Filters)).toBe(true);
  expect(routes.filter(route => route.operation !== 'List').every(route => !Object.hasOwn(route, 'Filters'))).toBe(true);
  const preview = crudRouteMetadata({ name: 'Report', list: { filter: { title: true } } }).find(route => route.operation === 'List')!;
  expect(Object.keys(preview.Filters)).toEqual([]);
  expect(Object.isFrozen(preview.Filters)).toBe(true);
  expectTypeOf<keyof typeof preview.Filters>().toEqualTypeOf<never>();
  // @ts-expect-error Inherited tenant fields are supplied by the request context.
  expect(() => crudRouteMetadata({ ...report, list: { filter: { workspaceKey: true } } })).toThrow(ApiDefinitionError);
});

it('exposes readable scalar sort descriptors on the List operation of a resolved model', () => {
  class Product {
    @Prop.uuid({ crud: 'id' }) key!: Id<string>;
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
    @Prop.string({ crud: 'writeOnly' }) privateNote!: WriteOnly<string>;
  }
  const routes = crudRouteMetadata({ ...resolve(Product), list: { sort: true } });
  const list = routes.find(route => route.operation === 'List')!;
  expect(list.Sorts).toEqual({
    key: { path: 'key', labelKey: 'product.key' },
    title: { path: 'title', labelKey: 'product.title' },
  });
  expectTypeOf(list.Sorts.title?.path).toEqualTypeOf<'title' | undefined>();
  expectTypeOf<keyof typeof list.Sorts>().toEqualTypeOf<'key' | 'title'>();
  expect(Object.isFrozen(list.Sorts)).toBe(true);
  expect(Object.keys(list.Filters)).toEqual([]);
  expect(Object.isFrozen(list.Filters)).toBe(true);
  expect(routes.filter(route => route.operation !== 'List').every(route => !Object.hasOwn(route, 'Sorts'))).toBe(true);

  const model = resolve(Product);
  const selected = crudRouteMetadata({ ...model, list: { sort: ['title'] } }).find(route => route.operation === 'List')!;
  expect(selected.Sorts).toEqual({ title: list.Sorts.title });
  expectTypeOf<keyof typeof selected.Sorts>().toEqualTypeOf<'title'>();
  // @ts-expect-error A write-only field cannot be selected on the List endpoint.
  expect(() => crudRouteMetadata({ ...model, list: { sort: ['privateNote'] } })).toThrow(/Product.*unreadable.*privateNote/);
});

it('exposes a frozen empty Sorts map without both a model and a sort declaration', () => {
  class Report extends StoredRecord {
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  }
  const model = resolve(Report);
  const pagingOnly = crudRouteMetadata(model).find(route => route.operation === 'List')!;
  const searchOnly = crudRouteMetadata({ ...model, list: { search: { fields: ['title'] } } }).find(route => route.operation === 'List')!;
  const empty = crudRouteMetadata({ ...model, list: { sort: [] } }).find(route => route.operation === 'List')!;
  const preview = crudRouteMetadata({ name: 'Report', list: { sort: ['title'] } }).find(route => route.operation === 'List')!;
  for (const list of [pagingOnly, searchOnly, empty, preview]) {
    expect(Object.keys(list.Sorts)).toEqual([]);
    expect(Object.getPrototypeOf(list.Sorts)).toBeNull();
    expect(Object.isFrozen(list.Sorts)).toBe(true);
  }
  expectTypeOf<keyof typeof pagingOnly.Sorts>().toEqualTypeOf<never>();
  expectTypeOf<keyof typeof searchOnly.Sorts>().toEqualTypeOf<never>();
  expectTypeOf<keyof typeof empty.Sorts>().toEqualTypeOf<never>();
  expectTypeOf<keyof typeof preview.Sorts>().toEqualTypeOf<never>();
});

it('keeps sort descriptors optional when the resource declaration is widened', () => {
  class Report extends StoredRecord {
    @Prop.string({ crud: 'readable' }) title!: Readable<string>;
    @Prop.number({ crud: 'readable' }) rank!: Readable<number>;
  }
  function listSorts(options: CrudRouteMetadataOptions) {
    return crudRouteMetadata(options).find(route => route.operation === 'List')!.Sorts;
  }
  const model = resolve(Report);
  const selected = listSorts({ ...model, list: { sort: ['title'] } });
  expectTypeOf(selected.title).toEqualTypeOf<SortDescriptor | undefined>();
  expect(selected.title).toEqual({ path: 'title', labelKey: 'report.title' });
  expect(listSorts(model).title).toBeUndefined();
  expect(listSorts({ name: 'Report', list: { sort: true } }).title).toBeUndefined();

  function optionalSelection(list?: { sort?: readonly 'title'[] }) {
    return crudRouteMetadata({ ...model, list }).find(route => route.operation === 'List')!.Sorts;
  }
  const optional = optionalSelection();
  expectTypeOf<keyof typeof optional>().toEqualTypeOf<'title'>();
  expectTypeOf(optional.title).toEqualTypeOf<SortDescriptor<'title'> | undefined>();
  expect(optional.title).toBeUndefined();
  expect(optionalSelection({ sort: ['title'] }).title).toEqual(selected.title);
});

it('narrows mixed CRUD and transition descriptors by kind', () => {
  const crud = crudRouteMetadata({ name: 'Offering', tenancy: 'shared', access: { read: 'VIEWER' } });
  const archive = transitionRouteMetadata({ name: 'Offering', verb: 'archive' });
  const labels = [...crud, archive].map(route => {
    if (route.kind === 'crud') return route.operation;
    expectTypeOf(route).toEqualTypeOf<typeof archive>();
    return route.name;
  });
  expect(labels).toEqual(['Get', 'List', 'ArchiveOffering']);
});

it('assembles the method, path and success code for each enabled named export', () => {
  const routes = crudRouteMetadata({ name: 'Offering' });
  expect(routes).toEqual([
    { kind: 'crud', operation: 'Create', name: 'CreateOffering', method: 'post', path: '/offerings', code: 201, ...tenantDefaults },
    { kind: 'crud', operation: 'Get', name: 'GetOffering', method: 'get', path: '/offerings/:offeringId', code: 200, ...tenantDefaults },
    { kind: 'crud', operation: 'Update', name: 'UpdateOffering', method: 'patch', path: '/offerings/:offeringId', code: 200, ...tenantDefaults },
    { kind: 'crud', operation: 'Delete', name: 'DeleteOffering', method: 'delete', path: '/offerings/:offeringId', code: 200, ...tenantDefaults },
    { kind: 'crud', operation: 'List', name: 'ListOfferings', method: 'get', path: '/offerings', code: 200, Filters: {}, Sorts: {}, ...tenantDefaults },
  ]);
  type Create = Extract<(typeof routes)[number], { operation: 'Create' }>;
  expectTypeOf<(typeof routes)[number]['kind']>().toEqualTypeOf<'crud'>();
  expectTypeOf<Create['name']>().toEqualTypeOf<'CreateOffering'>();
  expectTypeOf<Create['method']>().toEqualTypeOf<'post'>();
  expectTypeOf<Create['code']>().toEqualTypeOf<201>();
  expectTypeOf<Create['scope']>().toEqualTypeOf<EndpointScope>();
  expectTypeOf<Create['principals']>().toEqualTypeOf<readonly EndpointPrincipalKind[] | undefined>();
  expectTypeOf<Create>().not.toHaveProperty('Sorts');
});

it('omits disabled operations and keeps the parent ID on both paths', () => {
  const routes = crudRouteMetadata({
    name: 'SalesThread', parent: { name: 'SalesCampaign' }, operations: { Delete: false },
  });
  const prefix = '/sales-campaigns/:salesCampaignId/sales-threads';
  expect(routes.map(({ name, path }) => [name, path])).toEqual([
    ['CreateSalesThread', prefix],
    ['GetSalesThread', `${prefix}/:salesThreadId`],
    ['UpdateSalesThread', `${prefix}/:salesThreadId`],
    ['ListSalesThreads', prefix],
  ]);
});

it('uses the declared plural and shared-resource defaults', () => {
  const read = { feature: 'directory' };
  expect(crudRouteMetadata({ name: 'Company', plural: 'Companies', tenancy: 'shared', access: { read } })).toEqual([
    { kind: 'crud', operation: 'Get', name: 'GetCompany', method: 'get', path: '/companies/:companyId', code: 200, Access: read, ...tenantDefaults },
    { kind: 'crud', operation: 'List', name: 'ListCompanies', method: 'get', path: '/companies', code: 200, Access: read, Filters: {}, Sorts: {}, ...tenantDefaults },
  ]);
});

it('requires an explicit read rule for Get on a shared resource', () => {
  class Company extends StoredRecord {}
  const shared = { ...resolve(Company), plural: 'Companies', tenancy: 'shared' } as const;
  expect(() => crudRouteMetadata(shared)).toThrow(ApiDefinitionError);
  for (const access of [{}, { list: 'VIEWER' }, { write: 'EDITOR' }, { fields: { name: { write: 'EDITOR' } } }, Object.create({ read: 'VIEWER' })]) {
    expect(() => crudRouteMetadata({ ...shared, access })).toThrow(/Company.*Get.*access\.read/);
  }
  const list = crudRouteMetadata({ ...shared, operations: { Get: false }, access: { list: 'VIEWER' } });
  expect(list.map(route => route.operation)).toEqual(['List']);
  expect(() => crudRouteMetadata({ ...shared, operations: { Get: false } })).toThrow(/Company.*List.*access\.list or access\.read/);
});

it.each([['Create', 'create'], ['Update', 'update'], ['Delete', 'delete']] as const)(
  'requires a write rule when a shared declaration opts into %s', (operation, key) => {
    const shared = { name: 'DirectoryItem', tenancy: 'shared', operations: { [operation]: true } } as const;
    const read = { feature: 'directory' };
    expect(() => crudRouteMetadata({ ...shared, access: { read } })).toThrow(`for ${operation} (access.${key} or access.write)`);
    for (const access of [{ read, write: 'EDITOR' }, { read, [key]: 'EDITOR' }]) {
      expect(crudRouteMetadata({ ...shared, access }).map(route => route.operation)).toContain(operation);
    }
  },
);

it('keeps shared writes disabled when only their access rules are declared', () => {
  const shared = { name: 'DirectoryItem', tenancy: 'shared' } as const;
  const access = { read: 'VIEWER', write: 'EDITOR', delete: 'ADMINISTRATOR' };
  expect(crudRouteMetadata({ ...shared, access }).map(route => route.operation)).toEqual(['Get', 'List']);
  const hiddenAccess = Object.assign(Object.create({ access }), shared);
  expect(() => crudRouteMetadata(hiddenAccess)).toThrow(/DirectoryItem.*Get.*access\.read/);
});

it('requires a declared access rule on a shared resource with every endpoint disabled', () => {
  const shared = { name: 'DirectoryItem', tenancy: 'shared', operations: disabledOperations } as const;
  expect(() => crudRouteMetadata(shared)).toThrow(/DirectoryItem.*requires an explicit CRUD access rule/);
  expect(crudRouteMetadata({ ...shared, access: { write: 'EDITOR' } })).toEqual([]);
});

it('rejects an empty rule on a shared endpoint even when a general rule exists', () => {
  const shared = { name: 'DirectoryItem', tenancy: 'shared' } as const;
  for (const list of ['', {}, []]) {
    expect(() => crudRouteMetadata({ ...shared, access: { read: 'VIEWER', list } })).toThrow(/DirectoryItem.*List/);
  }
  expect(crudRouteMetadata({ ...shared, access: { read: 'VIEWER', list: undefined } })).toHaveLength(2);
});

it('warns once per Company declaration and preserves its default list name and path', ({ onTestFinished }) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  onTestFinished(() => { warn.mockRestore(); });

  const options = { name: 'Company' } as const;
  const routes = crudRouteMetadata(options);
  expect(routes.find(route => route.operation === 'List')).toMatchObject({ name: 'ListCompanys', path: '/companys' });
  expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Resource "Company" defaults to the plural "Companys"'));

  crudRouteMetadata(options);
  expect(warn).toHaveBeenCalledTimes(2);
});

it.each(['Status', 'Box', 'Match', 'Brush'])('warns about the default plural for %s', name => {
  const warn = vi.fn();
  crudRouteMetadata({ name, warn });
  expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(`defaults to the plural "${name}s"`));
});

it('allows an explicit plural and a regular default without a warning', () => {
  const warn = vi.fn();
  crudRouteMetadata({ name: 'Company', plural: 'Companies', warn });
  crudRouteMetadata({ name: 'Company', plural: 'Companys', warn });
  crudRouteMetadata({ name: 'Offering', warn });
  expect(warn).not.toHaveBeenCalled();
});

it('inherits the resource visibility and allows an operation to make itself visible', () => {
  const routes = crudRouteMetadata({
    name: 'Offering', docs: false,
    operations: { Create: { docs: true }, Get: true, Update: { principals: ['user'] }, Delete: false },
  });
  expect(routes.map(({ operation, docs }) => [operation, docs])).toEqual([
    ['Create', true], ['Get', false], ['Update', false], ['List', false],
  ]);
});

it('keeps a hidden operation enabled and ignores inherited or undefined overrides', () => {
  const operations = Object.assign(Object.create({ Update: { docs: false } }), {
    Get: { docs: false }, Delete: { docs: undefined }, List: Object.create({ docs: false }),
  });
  const routes = crudRouteMetadata({ name: 'Offering', docs: true, operations });
  expect(routes.map(({ operation, docs }) => [operation, docs])).toEqual([
    ['Create', true], ['Get', false], ['Update', true], ['Delete', true], ['List', true],
  ]);
});

it('rejects non-boolean visibility on a resource or individual operation', () => {
  // @ts-expect-error Resource visibility must be a boolean.
  expect(() => crudRouteMetadata({ name: 'Offering', docs: null })).toThrow('docs option on "Offering"');
  // @ts-expect-error A string is not an operation visibility setting.
  expect(() => crudRouteMetadata({ name: 'Offering', operations: { Get: { docs: 'false' } } }))
    .toThrow('docs option on "GetOffering"');
});

it('applies the resource scope to every enabled operation unless that operation declares its own', () => {
  const routes = crudRouteMetadata({
    name: 'Report', scope: 'public', operations: { Get: { scope: 'account' }, Delete: false },
  });
  expect(routes.map(({ operation, scope }) => [operation, scope])).toEqual([
    ['Create', 'public'], ['Get', 'account'], ['Update', 'public'], ['List', 'public'],
  ]);
  const [, get, , list] = routes;
  expect(defaultFailureCodes({ ...get })).toEqual([401, 403, 404, 422, 429, 500, 503]);
  expect(defaultFailureCodes({ ...list })).toEqual([422, 429, 500]);
});

it('resolves authenticated principals from each operation’s scope and tool setting', () => {
  const [create, get, update, remove, list] = crudRouteMetadata({
    name: 'Report', scope: 'account',
    operations: { Create: { scope: 'public' }, Get: { scope: 'tenant', tool: true }, Update: { scope: 'tenant' } },
  });
  expect(create).not.toHaveProperty('principals');
  expect(get).toMatchObject({ tool: true, principals: ['user', 'apiKey', 'agent'] });
  expect(update.principals).toEqual(['user', 'apiKey']);
  expect(remove.principals).toEqual(['user']);
  expect(list.principals).toEqual(['user']);
});

it('narrows an inherited list on scope and tool overrides and accepts explicit operation restrictions', () => {
  const [create, get, update, remove, list] = crudRouteMetadata({
    name: 'Report', tool: true, principals: ['user', 'agent'],
    operations: { Create: { scope: 'public' }, Get: { tool: false }, Update: { scope: 'account' }, List: { principals: ['apiKey'] } },
  });
  expect(create).not.toHaveProperty('principals');
  expect(get).not.toHaveProperty('tool');
  expect(get.principals).toEqual(['user']);
  expect(update.principals).toEqual(['user']);
  expect(remove.principals).toEqual(['user', 'agent']);
  expect(list.principals).toEqual(['apiKey']);
});

it('rejects contradictory explicit restrictions at the declaring scope', () => {
  expect(() => crudRouteMetadata({ name: 'Report', principals: ['user'], operations: { Get: { scope: 'public', principals: ['user'] } } }))
    .toThrow(/GetReport.*public scope/);
  expect(() => crudRouteMetadata({ name: 'Report', scope: 'public', principals: ['user'] })).toThrow(/Report.*public scope/);
  expect(() => crudRouteMetadata({ name: 'Report', operations: { Get: { scope: 'account', principals: ['apiKey'] } } }))
    .toThrow(/GetReport.*apiKey/);
  expect(() => crudRouteMetadata({ name: 'Report', operations: { List: { principals: ['agent'] } } })).toThrow(/ListReports.*agent/);
});

it('ignores prototype principal and tool options at both declaration levels', () => {
  const options = Object.assign(Object.create({ tool: true, principals: ['agent'] }), {
    name: 'Report', operations: { Get: Object.create({ tool: true, principals: ['agent'] }), List: { principals: undefined } },
  });
  for (const route of crudRouteMetadata(options)) {
    expect(route.principals).toEqual(['user', 'apiKey']);
    expect(route).not.toHaveProperty('tool');
  }
});

it('ignores inherited scopes and operation settings, and treats an undefined scope as omitted', () => {
  const operations = Object.assign(Object.create({ Delete: { scope: 'public' } }), {
    Get: Object.create({ scope: 'public' }), Update: { scope: undefined }, Create: { scope: 'tenant' },
  });
  const account = Object.assign(Object.create({ scope: 'public' }), { name: 'MfaFactor', tenancy: 'account', operations });
  expect(crudRouteMetadata(account).map(({ operation, scope }) => [operation, scope])).toEqual([
    ['Create', 'tenant'], ['Get', 'account'], ['Update', 'account'], ['Delete', 'account'], ['List', 'account'],
  ]);
  const preview = Object.assign(Object.create({ operations: { Get: { scope: 'public' } } }), { name: 'Report', scope: undefined });
  expect(crudRouteMetadata(preview).every(route => route.scope === 'tenant')).toBe(true);
});

it.each(['platform', null] as const)('rejects an invalid scope %j on either declaration', scope => {
  // @ts-expect-error A resource must use a supported scope.
  const resource = () => crudRouteMetadata({ name: 'Report', scope });
  // @ts-expect-error A per-operation override must use a supported scope.
  const operation = () => crudRouteMetadata({ name: 'Report', scope: 'public', operations: { Get: { scope } } });
  expect(resource).toThrow(ApiDefinitionError);
  expect(resource).toThrow('scope option on "Report"');
  expect(operation).toThrow(ApiDefinitionError);
  expect(operation).toThrow('scope option on "GetReport"');
});

it('derives account routes with an inherited owner and allows a name-only preview', () => {
  class AccountRecord extends StoredRecord {
    @Prop.uuid() memberKey!: string;
  }
  class MfaFactor extends AccountRecord {}

  const preview = crudRouteMetadata({ name: 'MfaFactor', tenancy: 'account' });
  const routes = crudRouteMetadata({ ...resolve(MfaFactor), tenancy: 'account', owner: 'memberKey' });
  expect(routes.every(route => route.scope === 'account')).toBe(true);
  expect(routes.map(route => route.path)).toEqual(preview.map(route => route.path));
  expect(routes.map(route => route.path)).toEqual([
    '/mfa-factors', '/mfa-factors/:mfaFactorId', '/mfa-factors/:mfaFactorId',
    '/mfa-factors/:mfaFactorId', '/mfa-factors',
  ]);
});

it('validates the declared account owner independently of enabled CRUD operations', () => {
  class MfaFactor extends StoredRecord {
    @Prop.uuid() userId!: string;
  }
  const account = { ...resolve(MfaFactor), tenancy: 'account' } as const;
  for (const operations of [undefined, disabledOperations]) {
    expect(() => crudRouteMetadata({ ...account, operations })).toThrow(ResourceDefinitionError);
    expect(() => crudRouteMetadata({ ...account, owner: 'missing', operations })).toThrow(/MfaFactor.*no declared owner field "missing"/);
  }
  expect(crudRouteMetadata({ ...account, owner: 'userId', operations: disabledOperations })).toEqual([]);
});

it('uses the singular tenant path for its item operations and the plural collection for Create and List', () => {
  class Organization extends StoredRecord {}
  const routes = crudRouteMetadata({ ...resolve(Organization), tenancy: 'self' });
  expect(routes).toEqual(crudRouteMetadata({ name: 'Organization', tenancy: 'self' }));
  expect(routes.map(({ method, path }) => [method, path])).toEqual([
    ['post', '/organizations'], ['get', '/organization'], ['patch', '/organization'],
    ['delete', '/organization'], ['get', '/organizations'],
  ]);
  expect(() => crudRouteMetadata({ name: 'Organization', tenancy: 'self', parent: { name: 'Group' } }))
    .toThrow('Tenant resource "Organization" cannot have a parent route.');
});

it('rejects colliding tenant GET paths only when both operations are enabled', () => {
  const options = { name: 'Workspace', plural: 'WORKSPACE', tenancy: 'self' } as const;
  expect(() => crudRouteMetadata(options)).toThrow(ApiDefinitionError);
  expect(() => crudRouteMetadata(options)).toThrow('duplicate route GET /workspace');
  const getRoutes = crudRouteMetadata({ ...options, operations: { List: false } }).filter(route => route.method === 'get');
  expect(getRoutes.map(route => route.name)).toEqual(['GetWorkspace']);
});
