import { randomUUID } from 'node:crypto';
import { TENANT_FILTER } from '@epsilon-asi/apps/mikro-orm';
import { createTestApp } from '@epsilon-asi/apps/testing';
import { MikroORM } from '@mikro-orm/postgresql';
import { expect, it, onTestFinished, vi } from 'vitest';
import { OfferingEntity, offeringDatabase } from '../../examples/crud-api/api/src/database.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { CreateOffering, ListOfferings } from '../../examples/crud-api/common/src/resources/Offering.js';
import { verifyOfferingDeletion } from './offeringDelete.fixture.js';
import { input, observeOfferingHttp, organizationA, verifyOfferingIsolation } from './offeringIsolation.fixture.js';
import { verifyFilteredOfferingList, verifyOfferingList } from './offeringList.fixture.js';
import { observeOfferingPatches, verifyOfferingUpdates } from './offeringUpdate.fixture.js';

const postgresUrl = process.env.SPIKE_POSTGRES_URL;
const postgres = it.skipIf(!postgresUrl && process.env.SPIKE_REQUIRE_POSTGRES !== '1');

async function startPostgresApps(transport: typeof fetch) {
  if (!postgresUrl) throw new Error('Set SPIKE_POSTGRES_URL to run the PostgreSQL HTTP test');
  const schema = 'offering_e2e_' + randomUUID().replaceAll('-', '');
  const options = { clientUrl: postgresUrl, entities: [OfferingEntity], schema, ensureDatabase: false };
  const writerOrm = await MikroORM.init(options);
  onTestFinished(() => writerOrm.close(true));
  const connection = writerOrm.em.getConnection();
  await connection.execute(`create schema "${schema}"`);
  // Register cleanup only after creating the schema. Hooks release listeners and pools in reverse order.
  onTestFinished(async () => { await connection.execute(`drop schema "${schema}" cascade`); });
  await writerOrm.schema.create();
  const readerOrm = await MikroORM.init(options);
  onTestFinished(() => readerOrm.close(true));

  const httpOptions = { resources, env: { APP_ENV: 'test' }, fetch: transport };
  const writer = await createTestApp({ ...httpOptions, ...offeringDatabase(writerOrm) });
  onTestFinished(() => writer.close());
  const reader = await createTestApp({ ...httpOptions, ...offeringDatabase(readerOrm) });
  onTestFinished(() => reader.close());
  return { writer, reader, readerOrm, schema };
}

postgres('serves the default GetOffering with 200 for the owning tenant and 404 for another through independent pools', async () => {
  const { transport, responses } = observeOfferingHttp();
  const { writer, reader, readerOrm } = await startPostgresApps(transport);
  const created = await verifyOfferingIsolation({ writer, reader, responses });
  const em = readerOrm.em.fork();
  await expect(em.findOne(OfferingEntity, { id: created.id })).rejects.toThrow(/tenant/i);
  em.setFilterParams(TENANT_FILTER, { tenantId: organizationA });
  const stored = await em.findOneOrFail(OfferingEntity, { id: created.id });
  expect(stored).toMatchObject({ ...created, vectorStoreId: expect.stringMatching(/.+/) });
});

postgres('commits tenant-scoped partial updates visible on a second PostgreSQL connection pool', async () => {
  const http = observeOfferingPatches();
  const { writer, reader, readerOrm } = await startPostgresApps(http.transport);
  async function readVectorStoreId(id: string) {
    const em = readerOrm.em.fork();
    em.setFilterParams(TENANT_FILTER, { tenantId: organizationA });
    return (await em.findOneOrFail(OfferingEntity, { id })).vectorStoreId;
  }
  await verifyOfferingUpdates({ writer, reader, http, readVectorStoreId });
});

postgres('commits scoped deletions visible from an independent pool and leaves unrelated rows intact', async () => {
  const { transport, responses } = observeOfferingHttp();
  const { writer, reader, readerOrm, schema } = await startPostgresApps(transport);
  const retained = await verifyOfferingDeletion({ writer, reader, responses });
  const rows = await readerOrm.em.getConnection().execute(`select id from "${schema}"."offering"`);
  expect(rows).toStrictEqual([{ id: retained }]);
});

postgres('paginates committed offerings and counts each tenant through an independent pool', async () => {
  const { transport, responses } = observeOfferingHttp();
  const { writer, reader } = await startPostgresApps(transport);
  await verifyOfferingList({ writer, reader, responses });
});

postgres('keeps one list page and its count on the same snapshot during a concurrent insert', async () => {
  const { writer, reader, readerOrm } = await startPostgresApps(fetch);
  const editor = writer.as({ tenant: organizationA, role: 'EDITOR' });
  const viewer = reader.as({ tenant: organizationA, role: 'VIEWER' });
  const first = await editor.call(CreateOffering, input);
  if (first.code !== 201) throw new Error('Expected the original offering');

  // Commit on the writer after the reader's actual count and before its page query.
  const driver = readerOrm.em.getDriver();
  const count = driver.count.bind(driver);
  const afterCount = vi.spyOn(driver, 'count').mockImplementationOnce(async (...args) => {
    const total = await count(...args);
    const created = await editor.call(CreateOffering, { ...input, name: 'Team' });
    expect(created.code).toBe(201);
    return total;
  });
  onTestFinished(() => { afterCount.mockRestore(); });

  expect(await viewer.call(ListOfferings, {})).toStrictEqual({ code: 200, data: { offerings: [first.data], count: 1 } });
  expect(afterCount).toHaveBeenCalledOnce();
  const next = await viewer.call(ListOfferings, {});
  if (next.code !== 200) throw new Error('Expected to read the newly committed offering');
  expect(next.data.count).toBe(2);
  expect(next.data.offerings.map(row => row.name).sort()).toStrictEqual([input.name, 'Team']);
});

postgres('filters both count and rows and preserves requested sort priority across independent pools', async () => {
  const http = observeOfferingHttp();
  const { writer, reader } = await startPostgresApps(http.transport);
  await verifyFilteredOfferingList({ writer, reader, ...http });
});
