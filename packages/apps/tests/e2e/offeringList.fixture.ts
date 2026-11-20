import { newId, type ReadModel } from '@epsilon-asi/apps';
import { expect, vi } from 'vitest';
import { CreateOffering, ListOfferings, type Offering, OfferingType } from '../../examples/crud-api/common/src/resources/Offering.js';
import { input, type OfferingIsolationOptions, organizationA, organizationB } from './offeringIsolation.fixture.js';

interface ExpectedPage {
  tenant: string;
  query: { page?: number; perPage?: number };
  offerings: ReadModel<typeof Offering>[];
  count: number;
}

export async function verifyOfferingList({ writer, reader = writer, responses }: OfferingIsolationOptions) {
  const editorA = writer.as({ tenant: organizationA, role: 'EDITOR' });
  const editorB = writer.as({ tenant: organizationB, role: 'EDITOR' });
  const first = await editorA.call(CreateOffering, { ...input, name: 'First A offering' });
  const other = await editorB.call(CreateOffering, { ...input, name: 'B offering' });
  const second = await editorA.call(CreateOffering, { ...input, name: 'Second A offering' });
  if (first.code !== 201 || second.code !== 201 || other.code !== 201) throw new Error('Expected three stored offerings');
  const ownRows = [first.data, second.data].sort((a, b) => a.id.localeCompare(b.id));
  for (const row of [...ownRows, other.data]) expect(row).not.toHaveProperty('vectorStoreId');

  async function expectPage({ tenant, query, offerings, count }: ExpectedPage) {
    const viewer = reader.as({ tenant, role: 'VIEWER' });
    const result = await viewer.call(ListOfferings, query);
    expect(result).toStrictEqual({ code: 200, data: { offerings, count } });

    const exchange = responses.at(-1);
    const wireRows = offerings.map(row => ({
      ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    }));
    expect(exchange).toMatchObject({ method: 'GET', path: '/offerings', tenant, hasBody: false, status: 200 });
    expect(exchange?.body).toStrictEqual({ code: 200, data: { offerings: wireRows, count } });
    if (query.page !== undefined) expect(exchange?.query?.page).toBe(String(query.page));
    if (query.perPage !== undefined) expect(exchange?.query?.perPage).toBe(String(query.perPage));
  }

  await expectPage({ tenant: organizationA, query: {}, offerings: ownRows, count: 2 });
  await expectPage({ tenant: organizationA, query: { page: 0, perPage: 1 }, offerings: [ownRows[0]], count: 2 });
  await expectPage({ tenant: organizationA, query: { page: 1, perPage: 1 }, offerings: [ownRows[1]], count: 2 });
  await expectPage({ tenant: organizationA, query: { page: 2, perPage: 1 }, offerings: [], count: 2 });
  await expectPage({
    tenant: organizationA, query: { page: Number.MAX_SAFE_INTEGER, perPage: 100 }, offerings: [], count: 2,
  });
  await expectPage({ tenant: organizationB, query: {}, offerings: [other.data], count: 1 });
  await expectPage({ tenant: newId(), query: {}, offerings: [], count: 0 });
}

export async function verifyFilteredOfferingList({
  writer, reader = writer, responses, replaceNextQuery,
}: OfferingIsolationOptions & { replaceNextQuery(query: string): void }) {
  const editor = writer.as({ tenant: organizationA, role: 'EDITOR' });
  const other = writer.as({ tenant: organizationB, role: 'EDITOR' });
  const viewer = reader.as({ tenant: organizationA, role: 'VIEWER' });
  const viewerB = reader.as({ tenant: organizationB, role: 'VIEWER' });
  const where = { type: { $eq: OfferingType.Service } };
  const orderBy = { name: 'asc', createdAt: 'desc' } as const;
  const query = { where, orderBy, perPage: 1 };
  async function create(name: string, day: number) {
    // Only Date is faked. HTTP listeners and the database still use real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(Date.UTC(2025, 0, day)));
      const result = await editor.call(CreateOffering, { ...input, name });
      if (result.code !== 201) throw new Error('Expected an offering');
      return result.data;
    } finally {
      vi.useRealTimers();
    }
  }
  const older = await create('Team', 2);
  expect((await editor.call(CreateOffering, { ...input, type: OfferingType.Product, name: 'A product' })).code).toBe(201);
  const foreign = await other.call(CreateOffering, { ...input, name: 'A foreign service' });
  if (foreign.code !== 201) throw new Error('Expected an offering in tenant B');
  const newer = await create('Team', 3);
  expect(await viewer.call(ListOfferings, query)).toStrictEqual({ code: 200, data: { offerings: [newer], count: 2 } });
  const wire = responses.at(-1)!;
  expect(wire).toMatchObject({ method: 'GET', path: '/offerings', hasBody: false, tenant: organizationA, status: 200,
    body: { code: 200, data: { offerings: [{ id: newer.id }], count: 2 } } });
  expect(Object.entries(wire.query ?? {}).filter(([key]) => key.startsWith('orderBy'))).toEqual([
    ['orderBy[name]', 'asc'], ['orderBy[createdAt]', 'desc'],
  ]);
  expect(wire.query?.['where[type][$eq]']).toBe('SERVICE');
  expect(await viewer.call(ListOfferings, { ...query, page: 1 })).toStrictEqual({ code: 200, data: { offerings: [older], count: 2 } });
  expect(await viewer.call(ListOfferings, { ...query, page: 2 })).toStrictEqual({ code: 200, data: { offerings: [], count: 2 } });
  expect(await viewerB.call(ListOfferings, query)).toStrictEqual({ code: 200, data: { offerings: [foreign.data], count: 1 } });

  const firstByName = await create('Basic', 1);
  expect(await viewer.call(ListOfferings, { where, orderBy })).toStrictEqual({
    code: 200, data: { offerings: [firstByName, newer, older], count: 3 },
  });
  expect(await viewer.call(ListOfferings, { where, orderBy: { createdAt: 'desc', name: 'asc' } })).toStrictEqual({
    code: 200, data: { offerings: [newer, older, firstByName], count: 3 },
  });

  const tied = await create('Team', 3);
  const tiedRows = [newer, tied].sort((a, b) => a.id.localeCompare(b.id));
  expect(await viewer.call(ListOfferings, { where, orderBy })).toStrictEqual({
    code: 200, data: { offerings: [firstByName, ...tiedRows, older], count: 4 },
  });

  for (const invalid of ['where[organizationId][$eq]=other', 'orderBy[description]=asc', 'where[type][$ne]=PRODUCT',
    'where[type][$eq]=UNKNOWN']) {
    replaceNextQuery(invalid);
    expect(await viewer.call(ListOfferings, {})).toMatchObject({ code: 422, error: 'Request.INVALID' });
    expect(responses.at(-1)?.status).toBe(422);
  }
}
