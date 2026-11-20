import { expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createClient } from '../../src/client/createClient.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import { dateWireCodec } from '../../src/wire/date.js';

const instant = '2026-11-19T12:00:00.000Z';
const body = z.strictObject({ dueAt: dateWireCodec });
const response = z.strictObject({ code: z.literal(201), data: body });
const contract = {
  Method: 'post', Path: '/deliveries', Route: { scope: 'tenant' },
  TenantHeader: 'X-Workspace-Id', ApiVersion: '2026-11-19',
  ResponseTypeUnion: responseTypeUnion({ response, failures: [401, 422] }),
  toContent: (request: z.output<typeof body>) => ({
    params: {}, query: {}, headers: {}, body: body.encode(request),
  }),
} as const;
const input = { dueAt: new Date(instant) };
const created = () => Response.json({ code: 201, data: { dueAt: instant } }, { status: 201 });
const getContract = {
  ...contract, Method: 'get', Path: '/deliveries/:deliveryId',
  ResponseTypeUnion: responseTypeUnion({
    response: z.strictObject({ code: z.literal(200), data: body }), failures: [404],
  }),
  toContent: ({ key }: { key: string }) => ({ params: { deliveryId: key }, query: {}, headers: {}, body: {} }),
} as const;

it('sends the mapped GET parameter as one URL segment and decodes the response with the usual credentials', async () => {
  const send = vi.fn<typeof fetch>(async (url, init) => {
    expect(String(url)).toBe('https://example.test/api/v1/deliveries/box%20%C3%A9%2F4%3Ftag%23frag%25');
    expect(init?.method).toBe('GET');
    expect(init).not.toHaveProperty('body');
    const headers = new Headers(init?.headers);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer alice');
    expect(headers.get('X-Workspace-Id')).toBe('tenant-a');
    expect(headers.get('X-Api-Version')).toBe('2026-11-19');
    return Response.json({ code: 200, data: { dueAt: instant } }, { status: 200 });
  });
  const client = createClient({
    baseUrl: 'https://example.test/api/v1', fetch: send, tenant: () => 'tenant-a', tokens: { get: () => ({ accessToken: 'alice' }) },
  });
  const reply = await client.call(getContract, { key: 'box é/4?tag#frag%' });
  expect(send).toHaveBeenCalledTimes(1);
  expectTypeOf(reply.code).toEqualTypeOf<200 | 404>();
  expect(reply).toEqual({ code: 200, data: input });
});

it.each(['', '.', '..'])('rejects an item key that cannot round-trip as a URL segment: %j', async key => {
  const send = vi.fn<typeof fetch>();
  const client = createClient({ baseUrl: 'https://example.test/api', fetch: send });
  await expect(client.call(getContract, { key })).rejects.toThrow(/path parameter/);
  expect(send).not.toHaveBeenCalled();
});

it('rejects a GET contract whose wire parameter disagrees with its declared path', async () => {
  const send = vi.fn<typeof fetch>();
  const client = createClient({ baseUrl: 'https://example.test/api', fetch: send });
  await expect(client.call({ ...getContract, Path: '/deliveries/:otherId' }, { key: 'one' })).rejects.toThrow(/path parameter/);
  expect(send).not.toHaveBeenCalled();
});

it('sends the List query on a bodyless collection GET under the API prefix', async () => {
  const list = {
    ...getContract, Path: '/deliveries', Route: { scope: 'tenant', operation: 'List' },
    toContent: ({ page, perPage }: { page: number; perPage: number }) => ({
      params: {}, query: { page: String(page), perPage: String(perPage) }, headers: {}, body: {},
    }),
    ResponseTypeUnion: z.strictObject({ code: z.literal(200), data: z.strictObject({ deliveries: z.array(body), count: z.number() }) }),
  } as const;
  const send = vi.fn<typeof fetch>(async (url, init) => {
    const sent = new URL(String(url));
    expect(sent.pathname).toBe('/api/v1/deliveries');
    expect([...sent.searchParams]).toEqual([['page', '2'], ['perPage', '3']]);
    expect(init?.method).toBe('GET');
    expect(init).not.toHaveProperty('body');
    const headers = new Headers(init?.headers);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('X-Workspace-Id')).toBe('tenant-a');
    expect(headers.get('Authorization')).toBe('Bearer alice');
    return Response.json({ code: 200, data: { deliveries: [{ dueAt: instant }], count: 7 } });
  });
  const client = createClient({
    baseUrl: 'https://example.test/api/v1', fetch: send, tenant: () => 'tenant-a', tokens: { get: () => ({ accessToken: 'alice' }) },
  });
  expect(await client.call(list, { page: 2, perPage: 3 })).toEqual({ code: 200, data: { deliveries: [input], count: 7 } });
});

it('sends a bodyless DELETE to the encoded item URL and decodes an empty success', async () => {
  const remove = {
    ...getContract, Method: 'delete',
    ResponseTypeUnion: responseTypeUnion({ response: z.strictObject({ code: z.literal(200) }), failures: [404] }),
  } as const;
  const send = vi.fn<typeof fetch>(async (url, init) => {
    expect(String(url)).toBe('https://example.test/api/deliveries/box%2F4');
    expect(init?.method).toBe('DELETE');
    expect(init).not.toHaveProperty('body');
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    return Response.json({ code: 200 });
  });
  const client = createClient({ baseUrl: 'https://example.test/api/', fetch: send });
  const request = { key: 'box/4' };
  expect(await client.call(remove, request)).toStrictEqual({ code: 200 });
  await expect(client.call({
    ...remove, toContent: (input: typeof request) => ({ ...remove.toContent(input), body: { extra: true } }),
  }, request)).rejects.toThrow('DELETE expects an empty body');
  expect(send).toHaveBeenCalledTimes(1);
});

it('uses the declared request conversion and decodes a success envelope from the injected transport', async () => {
  const send = vi.fn<typeof fetch>(async (url, init) => {
    expect(String(url)).toBe('https://example.test/api/v1/deliveries');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ dueAt: instant });
    return created();
  });
  const client = createClient({ baseUrl: 'https://example.test/api/v1', fetch: send });
  const reply = await client.call(contract, input);
  expect(reply).toEqual({ code: 201, data: input });
  expectTypeOf(reply.code).toEqualTypeOf<201 | 401 | 422>();
  if (reply.code === 201) expectTypeOf(reply.data.dueAt).toEqualTypeOf<Date>();
  if (false) {
    // @ts-expect-error The caller supplies the decoded date.
    await client.call(contract, { dueAt: instant });
    // @ts-expect-error The endpoint counts only its declared fields.
    await client.call(contract, { ...input, priority: 1 });
  }
});

it('copies instance defaults and resolves current credentials, tenant and version on each request', async () => {
  const observed: Headers[] = [];
  const send: typeof fetch = async (_url, init) => {
    observed.push(new Headers(init?.headers));
    return created();
  };
  const headers = new Headers({ 'X-Client': 'first' });
  let tenant: string | undefined = 'one';
  let token: string | undefined = 'alpha';
  const first = createClient({
    baseUrl: 'https://example.test/', fetch: send, headers, tenant: () => tenant, version: '2026-11-10',
    tokens: { get: async () => token === undefined ? undefined : { accessToken: token } },
  });
  headers.set('X-Client', 'second');
  const second = createClient({ baseUrl: 'https://example.test', fetch: send, headers });
  await first.call(contract, input);
  tenant = 'two';
  token = 'beta';
  await first.call(contract, input);
  await second.call(contract, input);
  tenant = undefined;
  token = undefined;
  await first.call(contract, input);
  const values = observed.map(header =>
    ['X-Client', 'X-Workspace-Id', 'Authorization', 'X-Api-Version'].map(key => header.get(key)));
  expect(values).toEqual([
    ['first', 'one', 'Bearer alpha', '2026-11-10'],
    ['first', 'two', 'Bearer beta', '2026-11-10'],
    ['second', null, null, '2026-11-19'],
    ['first', null, null, '2026-11-10'],
  ]);
});

it('reads the tenant only for tenant-scoped endpoints with a declared header', async () => {
  const tenant = vi.fn(() => 'organization-a');
  const client = createClient({ baseUrl: 'https://example.test', tenant, fetch: async (_url, init) => {
    expect(new Headers(init?.headers).has('X-Workspace-Id')).toBe(false);
    return created();
  } });
  await client.call({ ...contract, Route: { scope: 'account' } }, input);
  await client.call({ ...contract, Route: { scope: 'public' } }, input);
  const { TenantHeader: _header, ...unscoped } = contract;
  await client.call(unscoped, input);
  expect(tenant).not.toHaveBeenCalled();
});

it('resolves declared HTTP failure envelopes and propagates transport failures', async () => {
  const failure = { code: 422, traceId: 'trace-1', error: 'Delivery.INVALID', issues: [
    { path: 'dueAt', code: 'custom', message: 'Date outside delivery window' },
  ] };
  const offline = new TypeError('offline');
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(failure, { status: 422 }))
    .mockRejectedValueOnce(offline);
  const client = createClient({ baseUrl: 'https://example.test', fetch: send });
  await expect(client.call(contract, input)).resolves.toEqual(failure);
  await expect(client.call(contract, input)).rejects.toBe(offline);
});

it('rejects an HTTP status that contradicts the decoded envelope', async () => {
  const client = createClient({ baseUrl: 'https://example.test', fetch: async () =>
    Response.json({ code: 201, data: { dueAt: instant } }, { status: 200 }) });
  await expect(client.call(contract, input)).rejects.toThrow(/200.*201/);
});

it('rejects a response missing the fields required by its failure schema', async () => {
  const client = createClient({ baseUrl: 'https://example.test', fetch: async () =>
    Response.json({ code: 422, error: 'Delivery.INVALID', traceId: 'trace-1' }, { status: 422 }) });
  await expect(client.call(contract, input)).rejects.toBeInstanceOf(z.ZodError);
});

it.each(['https://elsewhere.test/other', '//elsewhere.test/other', '/https://elsewhere.test/other', '/../outside'])(
  'keeps requests within the configured API root for %s', async Path => {
    const send = vi.fn<typeof fetch>();
    const client = createClient({ baseUrl: 'https://example.test/api/', fetch: send, tokens: { get: () => ({ accessToken: 'token' }) } });
    await expect(client.call({ ...contract, Path }, input)).rejects.toThrow(/API base URL/);
    expect(send).not.toHaveBeenCalled();
  },
);
