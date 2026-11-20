import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import type { Editable, Id, Internal, Readable, Secret, Tenant, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { resolveFilters } from '../../src/query/resolveFilters.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { dateWireCodec } from '../../src/wire/date.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Account {
  @Prop.string({ crud: 'readable' }) label!: Readable<string>;
}
const reference = vi.fn(() => Account);
class StoredRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.uuid({ crud: { access: 'tenant' } }) workspaceKey!: Tenant<string>;
  @Prop.string({ crud: 'readable' }) tenantId!: Readable<string>;
}
class Offering extends StoredRecord {
  @Prop.string({ crud: 'editable', default: 'Draft' }) title!: Editable<string>;
  @Prop.number({ crud: 'readable', optional: true }) rank?: Readable<number>;
  @Prop(z.array(z.string()).nullable().optional(), { crud: 'readable' }) tags?: Readable<string[] | null>;
  @Prop(dateWireCodec, { crud: 'readable' }) createdAt!: Readable<Date>;
  @Prop(z.object({ theme: z.string() }), { crud: 'readable' }) settings!: Readable<{ theme: string }>;
  @Prop(z.json().optional(), { crud: 'readable' }) metadata?: Readable<z.core.util.JSONType>;
  @Prop.nested(reference, { crud: 'readable' }) account!: Readable<Account>;
  @Prop.string() providerId!: string;
  @Prop.string({ crud: 'internal' }) memo!: Internal<string>;
  @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
  @Prop.string({ crud: { access: 'secret' } }) token!: Secret<string>;
}
const model = resolve(Offering);
const metadata = { name: model.name, fields: model.fields };

describe.each([
  ['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema],
] as const)('%s list filter declarations', (_mode, build) => {
  it('rejects the inherited Tenant field regardless of the requested operators', () => {
    for (const cap of [true, [], ['$eq']] as const) {
      // @ts-expect-error Every tenant cap is forbidden.
      const declare = () => build({ model, filter: { workspaceKey: cap } });
      expect(declare).toThrow(ApiDefinitionError);
      expect(declare).toThrow(/Offering.*Tenant field "workspaceKey"/);
    }
  });

  it('accepts inherited readable fields, ID membership and the groups of wrapped schemas', () => {
    const filter = {
      tenantId: ['$ilike'], title: true, rank: ['$gte'], key: ['$in'],
      tags: ['$overlap', '$exists'], createdAt: ['$lt'],
    } as const;
    expect(build({ model, filter }).decode({})).toMatchObject({ perPage: 20 });
  });

  it('allows a schema-only preview and checks the declaration shape', () => {
    expect(build({ filter: { workspaceKey: true } }).decode({})).toMatchObject({ perPage: 20 });
    // @ts-expect-error A filter cap accepts only known operator spellings.
    expect(() => build({ filter: { name: ['$unknown'] } })).toThrow(ApiDefinitionError);
    // @ts-expect-error A list declares a field map.
    expect(() => build({ filter: ['title'] })).toThrow(ApiDefinitionError);
  });
});

it.each([
  ['providerId', 'unreadable'], ['memo', 'unreadable'], ['password', 'unreadable'],
  ['token', 'unreadable'], ['absent', 'undeclared'],
])('rejects %s when filtering the resource', (field, reason) => {
  expect(() => resolveFilters({ model: metadata, filter: { [field]: true } })).toThrow(
    `Filter on resource "Offering" includes the ${reason} field "${field}".`,
  );
});

it('rejects wrong operators, object and JSON fields, and keeps reference lookups lazy', () => {
  // @ts-expect-error An ID cannot use text matching.
  expect(() => resolveFilters({ model, filter: { key: ['$ilike'] } })).toThrow(/Offering\.key.*\$ilike.*id/);
  // @ts-expect-error An optional number is not nullable.
  expect(() => resolveFilters({ model, filter: { rank: ['$exists'] } })).toThrow(/Offering\.rank.*\$exists.*range/);
  for (const field of ['settings', 'metadata', 'account']) {
    expect(() => resolveFilters({ model: metadata, filter: { [field]: true } })).toThrow(`Invalid filter "Offering.${field}"`);
  }
  expect(reference).toHaveBeenCalledTimes(0);
});

it('recognizes the Tenant shorthand and the explicit ID flag', () => {
  class Member {
    @Prop.uuid({ crud: 'tenant' }) owner!: Tenant<string>;
    @Prop.uuid({ crud: { id: true, access: 'readable' } }) membershipKey!: Id<string>;
  }
  const member = resolve(Member);
  // @ts-expect-error An empty cap still names the tenant field.
  expect(() => resolveFilters({ model: member, filter: { owner: [] } })).toThrow(/Member.*Tenant field "owner"/);
  // @ts-expect-error IDs use equality and membership operators.
  expect(() => resolveFilters({ model: member, filter: { membershipKey: ['$like'] } })).toThrow(/\$like.*id/);
  expect(() => resolveFilters({ model: member, filter: { membershipKey: ['$in'] } })).not.toThrow();
});
