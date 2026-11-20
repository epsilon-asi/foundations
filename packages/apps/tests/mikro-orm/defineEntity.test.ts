import { createResourceSystem, type Id, type Secret, type Tenant } from '@epsilon-asi/apps';
import { defineEntity } from '@epsilon-asi/apps/mikro-orm';
import { MikroORM } from '@mikro-orm/postgresql';
import { expect, it } from 'vitest';
import { Offering, OfferingStatus, OfferingType } from '../../examples/crud-api/common/src/resources/Offering.js';

it('derives the PostgreSQL Offering table, ownership index and serialization grants from its declaration', async () => {
  const entity = defineEntity(Offering);
  const orm = new MikroORM({ entities: [entity], dbName: 'metadata' });
  try {
    const { properties } = orm.getMetadata(Offering);
    expect(properties.id).toMatchObject({ primary: true, columnTypes: ['uuid'] });
    expect(properties.organizationId).toMatchObject({ fieldNames: ['organization_id'], columnTypes: ['uuid'] });
    expect(properties.links.columnTypes).toEqual(['jsonb']);
    expect(properties.type.items).toEqual(['PRODUCT', 'SERVICE']);
    expect(properties.status.items).toEqual(['DRAFT', 'ACTIVE', 'ARCHIVED']);
    expect(properties.vectorStoreId.hidden).toBe(true);
    const sql = await orm.schema.getCreateSchemaSQL();
    expect(sql).toContain('create table "offering"');
    expect(sql).toMatch(/create index .* on "offering" \("organization_id"\)/);
    expect(sql).toMatch(/"created_at" timestamptz/);
    expect(sql).toMatch(/"updated_at" timestamptz/);
    expect(sql).toMatch(/check \("type" in \('PRODUCT', 'SERVICE'\)\)/);
    const values = {
      id: crypto.randomUUID(), organizationId: crypto.randomUUID(), name: 'Trial', description: '',
      type: OfferingType.Service, vectorStoreId: 'private', createdAt: new Date(), updatedAt: new Date(),
    };
    const em = orm.em.fork();
    const row = em.create(entity, values);
    expect(row).toBeInstanceOf(Offering);
    expect(row.links).toEqual([]);
    expect(row.status).toBe(OfferingStatus.Draft);
    const override = em.create(entity, { ...values, id: crypto.randomUUID(), status: OfferingStatus.Active });
    expect(override.status).toBe(OfferingStatus.Active);
  } finally {
    await orm.close(true);
  }
});

it('resolves the declaring system lazily and requires an explicit system for a shared declaration', () => {
  class Team {}
  const first = createResourceSystem({ tenant: () => Team });
  const second = createResourceSystem({ tenant: () => Team });

  @first.Resource()
  @second.Resource()
  class Shared {
    @first.Prop.uuid({ crud: 'id' }) @second.Prop.uuid({ crud: 'id' }) key!: Id<string>;
    @first.Prop.uuid({ crud: 'tenant' }) @second.Prop.uuid({ crud: 'tenant' }) teamId!: Tenant<string>;
  }
  expect(() => defineEntity(Shared)).toThrow(/multiple resource systems/);
  expect(defineEntity(Shared, { resources: second, table: 'entries' }).tableName).toBe('entries');
  expect(() => defineEntity(Team)).toThrow(/@Resource/);
});

it('refuses to map unimplemented ownership or secret storage to a plain database column', () => {
  const { Resource, Prop } = createResourceSystem({ tenant: () => Organization });
  @Resource()
  class Organization {
    @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  }
  @Resource()
  class Credential {
    @Prop.uuid({ crud: 'id' }) key!: Id<string>;
    @Prop.uuid({ crud: 'tenant' }) organizationId!: Tenant<string>;
    @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  }
  @Resource({ owner: 'userId' })
  class AccountEntry {
    @Prop.uuid({ crud: 'id' }) key!: Id<string>;
    @Prop.uuid({ crud: 'tenant' }) organizationId!: Tenant<string>;
    @Prop.uuid() userId!: string;
  }
  expect(() => defineEntity(Organization)).toThrow(/tenant-owned resource/);
  expect(() => defineEntity(Credential)).toThrow(/Credential.token.*encrypted storage/);
  expect(() => defineEntity(AccountEntry)).toThrow(/AccountEntry.*owner filtering/);
});
