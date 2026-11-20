import { crudAccessRule, validatedCrudOperations, type CrudAccessMap } from '../../../src/access/crudAccess.js';
import { enabledCrudOperations, type CrudOperation as Operation } from '../../../src/endpoints/enabledCrudOperations.js';
import { assertResourceOwner } from '../../../src/model/assertResourceOwner.js';

// S4 starts after authentication and membership resolution. The server binds
// the tenant, role and entitlements. Only the flat request comes from the client.
const roles = ['VIEWER', 'EDITOR', 'ADMINISTRATOR'] as const;
type Role = typeof roles[number];
export interface Context {
  principal: { kind: 'user' | 'apiKey'; id: string };
  tenant?: { id: string; role: Role; features: readonly string[] };
}
export interface AccessRequest { includeArchived?: boolean }
type Grant = Role | 'own' | { feature: string };
type When = { test: (request: AccessRequest) => boolean; rule: Grant };
type Rule = Grant | readonly [...When[], Grant];

export interface Resource {
  name: string;
  tenancy: 'owned' | 'shared' | 'self' | 'account';
  access?: CrudAccessMap<Rule>;
  owner?: 'userId';
  parent?: { resource: Resource; field: 'salesCampaignId' };
  operations?: Partial<Record<Operation, boolean>>;
}

export function defineResource(resource: Resource): Resource {
  validatedCrudOperations(resource);
  assertResourceOwner(resource);
  return resource;
}

function selectedGrant(rule: Rule, request: AccessRequest): Grant {
  if (typeof rule === 'string' || 'feature' in rule) return rule;
  for (const entry of rule) {
    if (typeof entry === 'string' || 'feature' in entry) return entry;
    if (entry.test(request)) return entry.rule;
  }
  throw new Error('Conditional access requires a fallback');
}

// The UI and the service both evaluate this declaration. 'own' additionally
// becomes a row constraint when the service queries or writes.
function authorizedGrant(resource: Resource, op: Operation, ctx: Context, request: AccessRequest): Grant | undefined {
  if (!enabledCrudOperations(resource).includes(op)) return;
  if (resource.tenancy === 'account') return !ctx.tenant && ctx.principal.kind === 'user' ? 'own' : undefined;
  if (!ctx.tenant) return;
  const grant = selectedGrant(crudAccessRule({ access: resource.access, operation: op }) ?? 'ADMINISTRATOR', request);
  if (grant === 'own') return ctx.principal.kind === 'user' ? grant : undefined;
  if (typeof grant === 'object') return ctx.tenant.features.includes(grant.feature) ? grant : undefined;
  return roles.indexOf(ctx.tenant.role) >= roles.indexOf(grant) ? grant : undefined;
}

export function can(resource: Resource, op: Operation, ctx: Context, request: AccessRequest = {}): boolean {
  return authorizedGrant(resource, op, ctx, request) !== undefined;
}

export interface Row {
  id: string;
  name: string;
  organizationId?: string;
  userId?: string;
  salesCampaignId?: string;
}
type Bounds = Partial<Omit<Row, 'name'>>;
interface Query extends AccessRequest { parentId?: string }

function matches(row: Row, bounds: Bounds) {
  return Object.entries(bounds).every(([key, value]) => row[key as keyof Bounds] === value);
}

export class ScopedStore {
  private nextId = 0;
  constructor(private readonly tables: Map<Resource, Row[]>) {}

  private bounds(resource: Resource, op: Operation, ctx: Context, query: Query): Bounds {
    const grant = authorizedGrant(resource, op, ctx, query);
    if (!grant) throw new Error('Access denied');
    if (resource.tenancy === 'account') {
      if (!resource.owner) throw new Error('Account resources require an owner');
      return { [resource.owner]: ctx.principal.id };
    }
    if (!ctx.tenant) throw new Error('Tenant required');
    if (resource.tenancy === 'self') return { id: ctx.tenant.id };
    if (resource.tenancy === 'shared') return {};

    const bounds: Bounds = { organizationId: ctx.tenant.id };
    if (grant === 'own') {
      if (!resource.owner) throw new Error('Owner field required');
      bounds[resource.owner] = ctx.principal.id;
    }
    if (resource.parent) {
      if (!query.parentId) throw new Error('Parent required');
      const parent = this.lookup(resource.parent.resource, query.parentId, { organizationId: ctx.tenant.id });
      bounds[resource.parent.field] = parent.id;
      bounds.organizationId = parent.organizationId;
    }
    return bounds;
  }

  list(resource: Resource, ctx: Context, query: Query = {}) {
    const bounds = this.bounds(resource, 'List', ctx, query);
    return this.rows(resource).filter(row => matches(row, bounds)).map(row => ({ ...row }));
  }

  get(resource: Resource, ctx: Context, id: string, query: Query = {}): Row {
    return { ...this.lookup(resource, id, this.bounds(resource, 'Get', ctx, query)) };
  }

  create(resource: Resource, ctx: Context, input: Pick<Row, 'name'>, query: Query = {}) {
    const bounds = this.bounds(resource, 'Create', ctx, query);
    const row = { id: `new-${++this.nextId}`, name: input.name, ...bounds };
    this.rows(resource).push(row);
    return { ...row };
  }

  update(resource: Resource, ctx: Context, id: string, patch: Pick<Row, 'name'>, query: Query = {}) {
    const row = this.lookup(resource, id, this.bounds(resource, 'Update', ctx, query));
    row.name = patch.name;
    return { ...row };
  }

  delete(resource: Resource, ctx: Context, id: string, query: Query = {}) {
    const row = this.lookup(resource, id, this.bounds(resource, 'Delete', ctx, query));
    const rows = this.rows(resource);
    rows.splice(rows.indexOf(row), 1);
  }

  private rows(resource: Resource): Row[] {
    const rows = this.tables.get(resource);
    if (!rows) throw new Error(`Missing fixture table for ${resource.name}`);
    return rows;
  }

  private lookup(resource: Resource, id: string, bounds: Bounds): Row {
    const row = this.rows(resource).find(candidate => candidate.id === id && matches(candidate, bounds));
    if (!row) throw new Error('Not found');
    return row;
  }
}
