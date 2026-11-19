import { randomUUID } from 'node:crypto';
import { serialize, type EntityManager, type EntitySchema, type FilterQuery } from '@mikro-orm/core';
import { MikroORM as PostgresORM } from '@mikro-orm/postgresql';
import { MikroORM as SqliteORM } from '@mikro-orm/sqlite';
import { expect, it } from 'vitest';
import { Offering, offeringSchema, resourceService, type EntityOf } from './offering.fixture.js';

type Row = EntityOf<typeof Offering>;

// An overlap on JSONB means that at least one singleton array is contained.
// The empty input explicitly matches no rows.
function overlaps<T>(values: readonly T[], containsOne: (value: T) => FilterQuery<Row>): FilterQuery<Row> {
  return values.length ? { $or: values.map(containsOne) } : { id: { $in: [] } };
}

async function exercise(em: EntityManager, entity: EntitySchema<Row>) {
  const first = em.fork();
  first.setFilterParams('tenant', { organizationId: 'a' });
  const second = em.fork();
  second.setFilterParams('tenant', { organizationId: 'b' });
  const service = resourceService<typeof Offering>(entity);
  const input = { name: 'Office', tags: ['team', 'monthly'], months: [1, 3], details: { seats: 2 } };
  const own = service.create({ ctx: { em: first, organizationId: 'a' }, input });
  const other = second.create(entity, { ...input, organizationId: 'b' });
  first.assign(own, { name: 'Team office', providerId: 'internal', details: { seats: 8 } });
  await first.flush();
  await second.flush();
  first.clear();

  const stored = await first.findOneOrFail(entity, { id: own.id });
  expect(stored).toBeInstanceOf(Offering);
  expect(stored.providerId).toBe('internal');
  expect(serialize(stored)).toEqual({
    id: own.id, organizationId: 'a', name: 'Team office', tags: input.tags, months: input.months,
    details: { seats: 8 }, status: 'draft',
  });
  const bySeats = { details: { seats: { $gte: 4 } } } satisfies FilterQuery<Row>;
  expect((await first.find(entity, bySeats)).map(row => row.id)).toEqual([own.id]);
  expect(await first.findOne(entity, { id: other.id })).toBeNull();
  expect(await first.nativeUpdate(entity, { id: other.id }, { name: 'changed' })).toBe(0);
  second.clear();
  expect((await second.findOneOrFail(entity, { id: other.id })).name).toBe('Office');
  await expect(em.fork().find(entity, {})).rejects.toThrow(/filter 'tenant'/);
  return { first, id: own.id };
}

it('creates, assigns, serializes and scopes a flavored entity in SQLite', async () => {
  const entity = offeringSchema();
  const orm = await SqliteORM.init({ dbName: ':memory:', entities: [entity] });
  try {
    await orm.schema.create();
    await exercise(orm.em, entity);
  } finally {
    await orm.close(true);
  }
});

const postgresUrl = process.env.SPIKE_POSTGRES_URL;
it.skipIf(!postgresUrl && process.env.SPIKE_REQUIRE_POSTGRES !== '1')(
  'runs the same entity and JSONB operators in PostgreSQL',
  async () => {
    if (!postgresUrl) throw new Error('Set SPIKE_POSTGRES_URL to run the PostgreSQL spike');
    const schema = 'spike_' + randomUUID().replaceAll('-', '');
    const entity = offeringSchema();
    const orm = await PostgresORM.init({ clientUrl: postgresUrl, entities: [entity], schema, ensureDatabase: false });
    try {
      const connection = orm.em.getConnection();
      // The caller owns the database. This test owns only the fresh schema it successfully creates.
      await connection.execute(`create schema "${schema}"`);
      try {
        await orm.schema.create();
        const { first, id } = await exercise(orm.em, entity);
        const matching = async (where: FilterQuery<Row>) => (await first.find(entity, where)).map(row => row.id);
        expect(await matching({ tags: { $contains: ['team', 'monthly'] } })).toEqual([id]);
        expect(await matching({ tags: { $contains: ['team', 'yearly'] } })).toEqual([]);
        expect(await matching({ details: { $contains: { seats: 8 } } })).toEqual([id]);
        // SQLSTATE 42883: PostgreSQL has no && operator for JSONB.
        await expect(matching({ tags: { $overlap: ['monthly'] } })).rejects.toMatchObject({ code: '42883' });
        const tagQueries = (tags: string[]) => overlaps(tags, tag => ({ tags: { $contains: [tag] } }));
        const monthQueries = (months: number[]) => overlaps(months, month => ({ months: { $contains: [month] } }));
        expect(await matching(tagQueries(['yearly', 'monthly']))).toEqual([id]);
        expect(await matching(tagQueries(['yearly', 'weekly']))).toEqual([]);
        expect(await matching(monthQueries([12, 3]))).toEqual([id]);
        expect(await matching(monthQueries([12, 6]))).toEqual([]);
        expect(await matching(monthQueries([]))).toEqual([]);
      } finally {
        await connection.execute(`drop schema "${schema}" cascade`);
      }
    } finally {
      await orm.close(true);
    }
  },
);
