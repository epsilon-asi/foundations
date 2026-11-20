import { describe, expect, it } from 'vitest';
import { ResourceDefinitionError } from '../../../src/model/ResourceDefinitionError.js';
import { can, defineResource, ScopedStore, type Context, type Resource, type Row } from './scope.fixture.js';

const offering = defineResource({
  name: 'Offering', tenancy: 'owned',
  access: { read: [{ test: request => request.includeArchived === true, rule: 'ADMINISTRATOR' }, 'EDITOR'], write: 'EDITOR' },
});
const campaign = defineResource({ name: 'SalesCampaign', tenancy: 'owned' });
const thread = defineResource({
  name: 'SalesThread', tenancy: 'owned', parent: { resource: campaign, field: 'salesCampaignId' },
});
const channel = defineResource({ name: 'Channel', tenancy: 'owned', owner: 'userId', access: { read: 'own', write: 'own' } });
const company = defineResource({ name: 'Company', tenancy: 'shared', access: { read: { feature: 'directory' } } });
const organization = defineResource({ name: 'Organization', tenancy: 'self', operations: { Create: false } });
const mfa = defineResource({ name: 'MfaFactor', tenancy: 'account', owner: 'userId' });

const alice = {
  principal: { kind: 'user', id: 'alice' }, tenant: { id: 'A', role: 'ADMINISTRATOR', features: ['directory'] },
} satisfies Context;
const bob = {
  principal: { kind: 'user', id: 'bob' }, tenant: { id: 'B', role: 'ADMINISTRATOR', features: [] },
} satisfies Context;
const aliceAccount = { principal: alice.principal };
const bobAccount = { principal: bob.principal };

function row(id: string, fields: Partial<Row> = {}): Row { return { id, name: id, ...fields }; }

function store() {
  return new ScopedStore(new Map<Resource, Row[]>([
    [offering, [row('oa', { organizationId: 'A' }), row('ob', { organizationId: 'B' })]],
    [campaign, [
      row('ca', { organizationId: 'A' }), row('ca2', { organizationId: 'A' }), row('cb', { organizationId: 'B' }),
    ]],
    [thread, [
      row('ta', { organizationId: 'A', salesCampaignId: 'ca' }),
      row('ta2', { organizationId: 'A', salesCampaignId: 'ca2' }),
      row('tb', { organizationId: 'B', salesCampaignId: 'cb' }),
    ]],
    [channel, [
      row('mine', { organizationId: 'A', userId: 'alice' }), row('other-user', { organizationId: 'A', userId: 'bob' }),
      row('other-tenant', { organizationId: 'B', userId: 'alice' }),
    ]],
    [company, [row('directory-entry')]],
    [organization, [row('A'), row('B')]],
    [mfa, [row('alice-factor', { userId: 'alice' }), row('bob-factor', { userId: 'bob' })]],
  ]));
}

describe('declaration-driven scoping', () => {
  it.each([
    { resource: offering, ctx: alice, visible: 'oa', hidden: [{ id: 'ob', owner: bob }] },
    { resource: thread, ctx: alice, parentId: 'ca', visible: 'ta', hidden: [
      { id: 'tb', owner: bob, parentId: 'cb' }, { id: 'ta2', owner: alice, parentId: 'ca2' },
    ] },
    { resource: channel, ctx: alice, visible: 'mine', hidden: [
      { id: 'other-user', owner: { ...alice, principal: bob.principal } },
      { id: 'other-tenant', owner: { ...bob, principal: alice.principal } },
    ] },
    { resource: organization, ctx: alice, visible: 'A', hidden: [{ id: 'B', owner: bob }] },
    { resource: mfa, ctx: aliceAccount, visible: 'alice-factor', hidden: [{ id: 'bob-factor', owner: bobAccount }] },
  ])('limits $resource.name reads and mutations to the same rows', ({ resource, ctx, parentId, visible, hidden }) => {
    const db = store();
    const query = { parentId };
    expect(db.list(resource, ctx, query).map(r => r.id)).toEqual([visible]);
    for (const foreign of hidden) {
      const { id } = foreign;
      expect(() => db.get(resource, ctx, id, query)).toThrow('Not found');
      expect(() => db.update(resource, ctx, id, { name: 'changed' }, query)).toThrow('Not found');
      expect(() => db.delete(resource, ctx, id, query)).toThrow('Not found');
      const ownerQuery = 'parentId' in foreign ? { parentId: foreign.parentId } : {};
      expect(db.get(resource, foreign.owner, id, ownerQuery).name).toBe(id);
    }
    expect(db.get(resource, ctx, visible, query).name).toBe(visible);
    db.update(resource, ctx, visible, { name: 'changed' }, query);
    expect(db.get(resource, ctx, visible, query).name).toBe('changed');
    db.delete(resource, ctx, visible, query);
    expect(db.list(resource, ctx, query)).toEqual([]);
  });

  it('derives tenant, owner and parent keys on create', () => {
    const db = store();
    const name = { name: 'created' };
    expect(db.create(offering, alice, name)).toMatchObject({ organizationId: 'A' });
    expect(db.create(channel, alice, name)).toMatchObject({ organizationId: 'A', userId: 'alice' });
    expect(db.create(mfa, bobAccount, name)).toMatchObject({ userId: 'bob' });
    expect(db.create(thread, bob, name, { parentId: 'cb' })).toMatchObject({ organizationId: 'B', salesCampaignId: 'cb' });
    expect(() => db.create(thread, alice, name, { parentId: 'cb' })).toThrow('Not found');
    expect(() => db.list(thread, alice, { parentId: 'cb' })).toThrow('Not found');
    expect(() => db.create(thread, alice, name)).toThrow('Parent required');
    expect(db.list(thread, alice, { parentId: 'ca' }).map(r => r.id)).toEqual(['ta']);
  });

  it('requires an entitled tenant for shared reads and disables shared writes by default', () => {
    const db = store();
    const entitledBob = { ...bob, tenant: { ...bob.tenant, features: ['directory'] } };
    expect(db.get(company, alice, 'directory-entry')).toEqual(db.get(company, entitledBob, 'directory-entry'));
    expect(db.list(company, alice).map(r => r.id)).toEqual(['directory-entry']);
    expect(() => db.list(company, bob)).toThrow('Access denied');
    expect(() => db.get(company, aliceAccount, 'directory-entry')).toThrow('Access denied');
    expect(() => db.create(company, alice, { name: 'new' })).toThrow('Access denied');
    expect(() => db.update(company, alice, 'directory-entry', { name: 'changed' })).toThrow('Access denied');
    expect(() => db.delete(company, alice, 'directory-entry')).toThrow('Access denied');
    expect(db.get(company, alice, 'directory-entry').name).toBe('directory-entry');
    expect(() => defineResource({ name: 'InvalidShared', tenancy: 'shared' })).toThrow(/InvalidShared.*Get.*access\.read/);
    const listedDirectory = defineResource({ ...company, access: { read: 'VIEWER', list: { feature: 'directory' } } });
    expect(can(listedDirectory, 'Get', bob)).toBe(true);
    expect(can(listedDirectory, 'List', bob)).toBe(false);
    expect(() => defineResource({ ...company, operations: { Update: true } })).toThrow(/Company.*Update.*access\.write/);
    const editDirectory = defineResource({
      ...company, operations: { Update: true },
      access: { read: { feature: 'directory' }, write: 'ADMINISTRATOR', update: { feature: 'manageDirectory' } },
    });
    const catalog = new ScopedStore(new Map([[editDirectory, [row('directory-entry')]]]));
    expect(() => catalog.update(editDirectory, alice, 'directory-entry', { name: 'new' })).toThrow('Access denied');
    const manager = { ...alice, tenant: { ...alice.tenant, features: ['directory', 'manageDirectory'] } };
    catalog.update(editDirectory, manager, 'directory-entry', { name: 'new' });
    expect(catalog.get(editDirectory, entitledBob, 'directory-entry').name).toBe('new');
  });

  it('binds account rows only to a signed-in user outside tenant scope', () => {
    const db = store();
    expect(db.get(mfa, bobAccount, 'bob-factor').name).toBe('bob-factor');
    expect(() => db.list(mfa, alice)).toThrow('Access denied');
    expect(() => db.list(mfa, { principal: { kind: 'apiKey', id: 'alice' } })).toThrow('Access denied');
    expect(() => db.list(offering, aliceAccount)).toThrow('Access denied');
    const invalidAccount = () => defineResource({ name: 'InvalidAccount', tenancy: 'account' });
    expect(invalidAccount).toThrow(ResourceDefinitionError);
    expect(invalidAccount).toThrow(/InvalidAccount.*requires an owner/);
  });
});

describe('server and UI conditional access', () => {
  it.each([
    ['VIEWER', false, false], ['VIEWER', true, false],
    ['EDITOR', false, true], ['EDITOR', true, false],
    ['ADMINISTRATOR', false, true], ['ADMINISTRATOR', true, true],
  ] as const)('checks %s with includeArchived=%s', (role, includeArchived, allowed) => {
    const ctx: Context = { ...alice, tenant: { ...alice.tenant, role } };
    const request = { includeArchived };
    expect(can(offering, 'List', ctx, request)).toBe(allowed);
    const list = () => store().list(offering, ctx, request).map(r => r.id);
    if (allowed) expect(list()).toEqual(['oa']);
    else expect(list).toThrow('Access denied');
  });
});
