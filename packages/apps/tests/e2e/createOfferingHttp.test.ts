import { createApi, type TokenVerifier } from '@epsilon-asi/apps/express';
import { createTestApp } from '@epsilon-asi/apps/testing';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as rows from '../../examples/crud-api/api/src/exampleOffering.js';
import { OfferingRoutes } from '../../examples/crud-api/api/src/routes/OfferingRoutes.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { CreateOffering, OfferingStatus, OfferingType } from '../../examples/crud-api/common/src/resources/Offering.js';

const organizationA = '018f515e-0cca-7000-8000-000000000001';
const organizationB = '018f515e-0cca-7000-8000-000000000002';
const input = { name: 'Starter', description: 'Trial plan', type: OfferingType.Service };
const apiOptions = { resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' } };

async function start(transport?: typeof fetch) {
  const app = await createTestApp({ ...apiOptions, fetch: transport });
  onTestFinished(() => app.close());
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe('CreateOffering on a listening API', () => {
  it('creates one row in the authenticated organization and projects it before sending HTTP 201', async () => {
    const handler = vi.spyOn(rows, 'exampleOffering');
    const transport = vi.fn<typeof fetch>(async (url, options) => {
      expect(new URL(String(url)).hostname).toBe('127.0.0.1');
      const response = await fetch(url, options);
      const raw = await response.clone().json();
      const stored = handler.mock.results[0].value;
      expect(response.status).toBe(201);
      expect(response.headers.has('set-cookie')).toBe(false);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(stored.vectorStoreId).toBeTruthy();
      expect(raw.data).not.toHaveProperty('vectorStoreId');
      expect(raw).toMatchObject({ code: 201, data: { organizationId: organizationA, createdAt: stored.createdAt.toISOString() } });
      return response;
    });
    const app = await start(transport);
    const editor = app.as({ user: 'alice', tenant: organizationA, role: 'EDITOR' });
    const result = await editor.call(CreateOffering, input);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledExactlyOnceWith({ ...input, links: [] }, organizationA);
    expect(result.code).toBe(201);
    if (result.code !== 201) throw new Error('Expected a created offering');
    expect(result.data).toMatchObject({ ...input, organizationId: organizationA, status: OfferingStatus.Draft,
      links: [], createdAt: handler.mock.results[0].value.createdAt });
    expect(result.data.createdAt).toBeInstanceOf(Date);
  });

  it('authenticates and checks the role before validating the same invalid HTTP body', async () => {
    const handler = vi.spyOn(rows, 'exampleOffering');
    let credential: 'issued' | 'missing' | 'invalid' = 'issued';
    const statuses: number[] = [];
    const app = await start(async (url, options) => {
      const headers = new Headers(options?.headers);
      if (credential === 'missing') headers.delete('Authorization');
      if (credential === 'invalid') headers.set('Authorization', 'Bearer unknown-test-token');
      const response = await fetch(url, { ...options, headers, body: JSON.stringify({ ...input, name: '' }) });
      statuses.push(response.status);
      return response;
    });
    const editor = app.as({ user: 'alice', tenant: organizationA, role: 'EDITOR' });
    const invalid = await editor.call(CreateOffering, input);
    expect(invalid).toMatchObject({ code: 422, traceId: expect.stringMatching(/.+/), issues: [{ path: 'name' }] });
    credential = 'missing';
    const anonymous = await editor.call(CreateOffering, input);
    expect(anonymous).toMatchObject({ code: 401, error: 'Auth.UNAUTHENTICATED', traceId: expect.stringMatching(/.+/) });
    credential = 'invalid';
    expect(await editor.call(CreateOffering, input)).toMatchObject({ code: 401, error: 'Auth.UNAUTHENTICATED' });
    credential = 'issued';
    app.as({ user: 'alice', tenant: organizationA, role: 'VIEWER' });
    expect(await editor.call(CreateOffering, input)).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
    expect(statuses).toEqual([422, 401, 401, 403]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('requires membership in the selected tenant, even when another tenant grants the same user an editor role', async () => {
    const handler = vi.spyOn(rows, 'exampleOffering');
    let selection: string | undefined = organizationB;
    const app = await start(async (url, options) => {
      const headers = new Headers(options?.headers);
      if (selection) headers.set('X-Organization-Id', selection);
      else headers.delete('X-Organization-Id');
      return fetch(url, { ...options, headers });
    });
    const alice = app.as({ user: 'alice', tenant: organizationA, role: 'EDITOR' });
    const bob = app.as({ user: 'bob', tenant: organizationB, role: 'EDITOR' });
    expect(await alice.call(CreateOffering, input)).toMatchObject({ code: 404, error: 'Resource.NOT_FOUND' });
    selection = undefined;
    expect(await alice.call(CreateOffering, input)).toMatchObject({ code: 400, error: 'Tenant.REQUIRED' });
    expect(handler).not.toHaveBeenCalled();
    selection = organizationB;
    expect(await bob.call(CreateOffering, input)).toMatchObject({ code: 201, data: { organizationId: organizationB } });
    expect(handler).toHaveBeenCalledExactlyOnceWith({ ...input, links: [] }, organizationB);
  });

  it('keeps issued credentials local to each listening test app', async () => {
    let issued: string | null = null;
    const first = await start((url, options) => {
      issued = new Headers(options?.headers).get('Authorization');
      return fetch(url, options);
    });
    const actor = { user: 'alice', tenant: organizationA, role: 'EDITOR' };
    expect(await first.as(actor).call(CreateOffering, input)).toMatchObject({ code: 201 });
    const handler = vi.spyOn(rows, 'exampleOffering');
    const second = await start((url, options) => {
      const headers = new Headers(options?.headers);
      if (!issued) throw new Error('Expected credentials from the first app');
      headers.set('Authorization', issued);
      return fetch(url, { ...options, headers });
    });
    expect(await second.as(actor).call(CreateOffering, input)).toMatchObject({ code: 401, error: 'Auth.UNAUTHENTICATED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('validates the contract inventory and authentication configuration before listening', async () => {
    const verifier: TokenVerifier = { testOnly: true, verify: () => undefined };
    const configured = { ...apiOptions, verifiers: [verifier], membership: () => undefined };
    await expect(createApi({ ...configured, routes: [] })).rejects.toThrow(/missing handlers.*CreateOffering/i);
    await expect(createApi({ ...configured, verifiers: [] })).rejects.toThrow(/CreateOffering.*authentication verifier/);
    for (const env of [{}, { APP_ENV: 'production' }, { APP_ENV: 'development' }]) {
      await expect(createApi({ ...configured, env })).rejects.toThrow(/test verifier requires APP_ENV=test/);
    }
  });
});
