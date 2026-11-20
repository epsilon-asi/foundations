import { newId } from '@epsilon-asi/apps';
import type { TestApp } from '@epsilon-asi/apps/testing';
import { expect } from 'vitest';
import { CreateOffering, GetOffering, OfferingType, UpdateOffering } from '../../examples/crud-api/common/src/resources/Offering.js';
import { input, organizationA, organizationB } from './offeringIsolation.fixture.js';

export function observeOfferingPatches() {
  const exchanges: { path: string; tenant: string | null; body: unknown; status: number; reply: unknown }[] = [];
  let replacement: object | undefined;
  const transport: typeof fetch = async (url, init) => {
    if (init?.method !== 'PATCH') return fetch(url, init);
    // The server must also reject forbidden fields sent by a caller without client-side validation.
    const req = new Request(url, replacement ? { ...init, body: JSON.stringify(replacement) } : init);
    replacement = undefined;
    const body: unknown = await req.clone().json();
    const response = await fetch(req);
    exchanges.push({
      path: new URL(req.url).pathname, tenant: req.headers.get('X-Organization-Id'), body,
      status: response.status, reply: await response.clone().json(),
    });
    return response;
  };
  return { exchanges, transport, replaceNextBody(body: object) { replacement = body; } };
}

interface UpdateOfferingScenario {
  writer: TestApp;
  reader?: TestApp;
  http: ReturnType<typeof observeOfferingPatches>;
  /** An independent database lookup also verifies the private column across all patches. */
  readVectorStoreId?: (id: string) => Promise<string>;
}

export async function verifyOfferingUpdates({ writer, reader = writer, http, readVectorStoreId }: UpdateOfferingScenario) {
  const editor = writer.as({ tenant: organizationA, role: 'EDITOR' });
  const viewer = reader.as({ tenant: organizationA, role: 'VIEWER' });
  const other = writer.as({ tenant: organizationB, role: 'EDITOR' });
  const links = ['https://example.test/original', 'https://example.test/details'];
  const created = await editor.call(CreateOffering, { ...input, links });
  if (created.code !== 201) throw new Error('Expected the editor to create an offering');
  const { id } = created.data;
  const original = { ...created.data, links };
  expect(await viewer.call(GetOffering, { id })).toStrictEqual({ code: 200, data: original });
  const vectorStoreId = await readVectorStoreId?.(id);

  const name = 'Professional';
  const renamed = { ...original, name };
  const updated = await editor.call(UpdateOffering, { id, name });
  expect(updated).toStrictEqual({ code: 200, data: renamed });
  expect(http.exchanges).toStrictEqual([{
    path: '/offerings/' + id, tenant: organizationA, body: { name }, status: 200,
    reply: { code: 200, data: {
      ...renamed, createdAt: original.createdAt.toISOString(), updatedAt: original.updatedAt.toISOString(),
    } },
  }]);
  expect(http.exchanges[0].reply).not.toHaveProperty('data.vectorStoreId');
  expect(await viewer.call(GetOffering, { id })).toStrictEqual(updated);

  const replacement = ['https://example.test/replacement'];
  const final = { ...renamed, links: replacement };
  expect(await editor.call(UpdateOffering, { id, links: replacement })).toStrictEqual({ code: 200, data: final });
  expect(await viewer.call(GetOffering, { id })).toStrictEqual({ code: 200, data: final });
  // An ID-only flat request sends an empty patch and retains even non-default values.
  expect(await editor.call(UpdateOffering, { id })).toStrictEqual({ code: 200, data: final });

  expect(await viewer.call(UpdateOffering, { id, name: 'Denied' })).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
  const notFound = { code: 404, error: 'Resource.NOT_FOUND', traceId: expect.stringMatching(/.+/) };
  for (const target of [id, newId()]) {
    expect(await other.call(UpdateOffering, { id: target, name: 'Foreign' })).toStrictEqual(notFound);
    const exchange = http.exchanges.at(-1);
    expect(exchange?.status).toBe(404);
    expect(exchange?.reply).toStrictEqual(notFound);
  }
  const local = await other.call(CreateOffering, input);
  if (local.code !== 201) throw new Error('Expected a tenant B offering');
  expect(await other.call(UpdateOffering, { id: local.data.id, name: 'Local' }))
    .toStrictEqual({ code: 200, data: { ...local.data, name: 'Local' } });

  const protectedFields = { type: OfferingType.Product, id: newId(), organizationId: organizationB, vectorStoreId: 'private' };
  http.replaceNextBody({ name: 'Rejected', ...protectedFields });
  const invalid = await editor.call(UpdateOffering, { id, name: 'Rejected' });
  expect(invalid).toMatchObject({ code: 422, error: 'Request.INVALID' });
  if (invalid.code !== 422) throw new Error('Expected the server to reject protected PATCH fields');
  expect(invalid.issues.map(issue => issue.path).sort()).toEqual(Object.keys(protectedFields).sort());
  expect(await viewer.call(GetOffering, { id })).toStrictEqual({ code: 200, data: final });

  const concurrent = { name: 'Team', description: 'Seats for a team' };
  const secondEditor = reader.as({ tenant: organizationA, role: 'EDITOR' });
  const replies = await Promise.all([
    editor.call(UpdateOffering, { id, name: concurrent.name }),
    secondEditor.call(UpdateOffering, { id, description: concurrent.description }),
  ]);
  expect(replies.map(reply => reply.code)).toEqual([200, 200]);
  const merged = { code: 200, data: { ...final, ...concurrent } };
  expect(replies).toContainEqual(merged);
  expect(await viewer.call(GetOffering, { id })).toStrictEqual(merged);
  if (readVectorStoreId) {
    expect(vectorStoreId).toEqual(expect.stringMatching(/.+/));
    expect(await readVectorStoreId(id)).toBe(vectorStoreId);
  }
}
