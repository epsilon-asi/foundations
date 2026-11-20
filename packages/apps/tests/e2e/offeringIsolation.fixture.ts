import { newId } from '@epsilon-asi/apps';
import type { TestApp } from '@epsilon-asi/apps/testing';
import { expect } from 'vitest';
import {
  CreateOffering, GetOffering, OfferingStatus, OfferingType,
} from '../../examples/crud-api/common/src/resources/Offering.js';

export const organizationA = '018f515e-0cca-7000-8000-000000000001';
export const organizationB = '018f515e-0cca-7000-8000-000000000002';
export const input = { name: 'Starter', description: 'Trial plan', type: OfferingType.Service };

interface OfferingHttpExchange {
  method: string;
  hasBody: boolean;
  path: string;
  query?: Record<string, string>;
  tenant: string | null;
  status: number;
  body: unknown;
}

export function observeOfferingHttp() {
  const responses: OfferingHttpExchange[] = [];
  let nextQuery: string | undefined;
  const transport: typeof fetch = async (url, init) => {
    if (nextQuery !== undefined) {
      const target = new URL(String(url));
      target.search = nextQuery;
      url = target;
      nextQuery = undefined;
    }
    const request = new Request(url, init);
    const target = new URL(request.url);
    const response = await fetch(request);
    responses.push({
      method: request.method, hasBody: request.body !== null,
      path: target.pathname, ...(target.search && { query: Object.fromEntries(target.searchParams) }),
      tenant: request.headers.get('X-Organization-Id'),
      status: response.status, body: await response.clone().json(),
    });
    return response;
  };
  return { responses, transport, replaceNextQuery(query: string) { nextQuery = query; } };
}

export interface OfferingIsolationOptions {
  writer: TestApp;
  reader?: TestApp;
  responses: ReturnType<typeof observeOfferingHttp>['responses'];
}

/** Both storage implementations must give callers the same wire responses and decoded results. */
export async function verifyOfferingIsolation({ writer, reader = writer, responses }: OfferingIsolationOptions) {
  const editor = writer.as({ user: 'editor-a', tenant: organizationA, role: 'EDITOR' });
  const viewerA = reader.as({ user: 'viewer-a', tenant: organizationA, role: 'VIEWER' });
  const viewerB = reader.as({ user: 'viewer-b', tenant: organizationB, role: 'VIEWER' });
  const created = await editor.call(CreateOffering, input);
  expect(created.code).toBe(201);
  if (created.code !== 201) throw new Error('Expected a stored offering');
  const { id } = created.data;
  const missing = newId();

  const own = await viewerA.call(GetOffering, { id });
  expect(own).toEqual({ code: 200, data: created.data });
  if (own.code !== 200) throw new Error('Expected the viewer to read the offering');
  expect(own.data.createdAt).toBeInstanceOf(Date);
  expect(own.data).toMatchObject({ ...input, organizationId: organizationA, links: [], status: OfferingStatus.Draft });
  expect(own.data).not.toHaveProperty('vectorStoreId');
  const foreign = await viewerB.call(GetOffering, { id });
  const absent = await viewerB.call(GetOffering, { id: missing });
  const notFound = { code: 404, error: 'Resource.NOT_FOUND', traceId: expect.stringMatching(/.+/) };
  expect(foreign).toStrictEqual(notFound);
  expect(absent).toStrictEqual(notFound);
  const wireData = {
    ...created.data, createdAt: created.data.createdAt.toISOString(), updatedAt: created.data.updatedAt.toISOString(),
  };
  expect(responses).toStrictEqual([
    { method: 'POST', hasBody: true, path: '/offerings', tenant: organizationA, status: 201, body: { code: 201, data: wireData } },
    { method: 'GET', hasBody: false, path: '/offerings/' + id, tenant: organizationA, status: 200, body: { code: 200, data: wireData } },
    { method: 'GET', hasBody: false, path: '/offerings/' + id, tenant: organizationB, status: 404, body: notFound },
    { method: 'GET', hasBody: false, path: '/offerings/' + missing, tenant: organizationB, status: 404, body: notFound },
  ]);

  const editorB = writer.as({ user: 'editor-b', tenant: organizationB, role: 'EDITOR' });
  const links = ['https://example.test/offering'];
  const local = await editorB.call(CreateOffering, { ...input, name: 'Tenant B offering', links });
  if (local.code !== 201) throw new Error('Expected a stored offering in tenant B');
  expect(local.data).toMatchObject({ organizationId: organizationB, links });
  expect(await viewerB.call(GetOffering, { id: local.data.id })).toEqual({ code: 200, data: local.data });
  return created.data;
}
