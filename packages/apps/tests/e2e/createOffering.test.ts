import {
  createClient, type RequestOf, type ResponseDataOf, type ResponseTypeUnionOf,
} from '@epsilon-asi/apps';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { CreateOffering, OfferingStatus, OfferingType } from '../../examples/crud-api/common/src/resources/Offering.js';

const baseUrl = 'https://offerings.example.test';
const organizationId = '018f515e-0cca-7000-8000-000000000001';
const offeringId = '018f515e-0cca-7000-8000-000000000002';
const input = { name: 'Starter', description: 'Trial plan', type: OfferingType.Service };
const instant = '2026-11-19T13:15:00.000Z';

type CreateHandler = (request: RequestOf<typeof CreateOffering>) => ResponseDataOf<typeof CreateOffering>;
const handleCreate = ((request) => ({
  ...request, id: offeringId, organizationId, status: OfferingStatus.Draft,
  vectorStoreId: 'private-index', createdAt: new Date(instant), updatedAt: new Date(instant),
})) satisfies CreateHandler;

describe('CreateOffering through the public package entry', () => {
  it('sends the resource contract and decodes its projected 201 response', async () => {
    const respond: typeof fetch = async (url, init) => {
      const http = new Request(url, init);
      expect(http.method).toBe('POST');
      expect(http.url).toBe(baseUrl + '/offerings');
      expect(http.headers.get('authorization')).toBe('Bearer editor-token');
      expect(http.headers.get('X-Organization-Id')).toBe(organizationId);
      expect(http.headers.get('content-type')).toContain('application/json');
      const body = await http.json();
      expect(body).toMatchObject(input);
      expect(body).not.toHaveProperty('id');
      expect(body).not.toHaveProperty('organizationId');
      const request = CreateOffering.fromContent({ params: {}, query: {}, body, headers: {} });
      expectTypeOf(request).toEqualTypeOf<RequestOf<typeof CreateOffering>>();
      expectTypeOf(request.links).toEqualTypeOf<string[]>();
      expect(request).toEqual({ ...input, links: [] });

      const row = handleCreate(request);
      expectTypeOf<() => { name: string }>().not.toExtend<CreateHandler>();
      expectTypeOf<ResponseDataOf<typeof CreateOffering>>().not.toHaveProperty('vectorStoreId');
      const response = Response.json(CreateOffering.Response.encode({ code: 201, data: row }), { status: 201 });
      const wire = await response.clone().json();
      expect(wire).toMatchObject({ code: 201, data: { createdAt: instant } });
      expect(wire.data).not.toHaveProperty('vectorStoreId');
      return response;
    };
    const transport = vi.fn(respond);
    const client = createClient({
      baseUrl, tenant: () => organizationId, tokens: { get: () => ({ accessToken: 'editor-token' }) }, fetch: transport,
    });
    const result = await client.call(CreateOffering, input);
    expectTypeOf(result).toEqualTypeOf<ResponseTypeUnionOf<typeof CreateOffering>>();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.code).toBe(201);
    if (result.code !== 201) throw new Error('Expected the created offering');
    expectTypeOf(result.data).toEqualTypeOf<ResponseDataOf<typeof CreateOffering>>();
    expect(result.data).toEqual({
      ...input, id: offeringId, organizationId, status: OfferingStatus.Draft,
      links: [], createdAt: new Date(instant), updatedAt: new Date(instant),
    });
  });

  it('returns a server validation issue to the caller with its flat field path', async () => {
    const failure = {
      code: 422, error: 'Offering.INVALID', traceId: 'req-22',
      issues: [{ path: 'name', message: 'Name is already in use', code: 'custom' }],
    };
    const client = createClient({ baseUrl, fetch: async () => Response.json(failure, { status: 422 }) });
    const result = await client.call(CreateOffering, input);
    expect(result).toEqual(failure);
    if (result.code === 422) expectTypeOf(result.issues[0].path).toEqualTypeOf<string>();
  });

  it('propagates a transport rejection and rejects forbidden create fields before sending', async () => {
    const offline = new TypeError('offline');
    const transport = vi.fn(async () => { throw offline; });
    const client = createClient({ baseUrl, fetch: transport });
    await expect(client.call(CreateOffering, input)).rejects.toBe(offline);
    // @ts-expect-error The primary key is assigned by the server.
    await expect(client.call(CreateOffering, { ...input, id: offeringId })).rejects.toThrow();
    // @ts-expect-error The tenant travels in the client header.
    await expect(client.call(CreateOffering, { ...input, organizationId })).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
