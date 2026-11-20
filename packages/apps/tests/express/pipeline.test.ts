import { request as httpRequest, type IncomingMessage } from 'node:http';
import { json } from 'node:stream/consumers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '../../src/client/createClient.js';
import { createApi, type Api } from '../../src/express/createApi.js';
import { createRouteSystem } from '../../src/express/routes.js';
import type { Editable, Id, Tenant } from '../../src/model/access.js';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import { defineErrors } from '../../src/responses/defineErrors.js';
import { failure } from '../../src/responses/failure.js';
import type { ResourceTenancy } from '../../src/tenancy/endpointScope.js';

describe('HTTP resource request pipeline', () => {
  const resources = createResourceSystem({ tenant: () => Workspace, roles: ['GUEST', 'READER', 'MEMBER', 'ADMIN'] });
  const { Prop, Resource, endpoints } = resources;
  @Resource()
  class Workspace { @Prop.string({ crud: 'id' }) id!: Id<string>; }
  @Resource()
  class Task {
    @Prop.number({ crud: 'id', min: 1 }) key!: Id<number>;
    @Prop.string({ crud: 'tenant' }) workspaceId!: Tenant<string>;
    @Prop.string({ crud: 'editable' }) title!: Editable<string>;
    @Prop.string({ crud: 'editable', optional: true }) flag?: Editable<string>;
  }
  const { CreateTask, GetTask, UpdateTask, DeleteTask, ListTasks } = endpoints(Task, {
    name: 'Task', operations: { Create: true, Get: true, List: true, Update: true, Delete: true },
    access: { read: 'READER', write: 'MEMBER', delete: 'ADMIN', fields: { flag: { write: 'ADMIN' } } },
  });
  const Tasks = defineErrors('Task', { DUPLICATE: { code: 409 } });
  const routeSystem = createRouteSystem();
  const handled = vi.fn();
  @routeSystem.Routes()
  class TaskRoutes {
    create = routeSystem.handler(CreateTask, { handle: (request, ctx) => {
      handled(request, ctx);
      if (request.title === 'missing') return failure.notFound();
      if (request.title === 'duplicate') throw new Tasks.Duplicate();
      if (request.title === 'private') throw new Error('private database detail');
      return { ...request, key: 17, workspaceId: ctx.tenant.id };
    } });
    get = routeSystem.handler(GetTask, { handle: (request, ctx) => {
      handled(request, ctx);
      return { key: request.key, workspaceId: ctx.tenant.id, title: 'Read task' };
    } });
    update = routeSystem.handler(UpdateTask, { handle: (request, ctx) => {
      handled(request, ctx);
      return { title: 'Existing title', ...request, workspaceId: ctx.tenant.id };
    } });
    delete = routeSystem.handler(DeleteTask, { handle: (request, ctx) => { handled(request, ctx); } });
    list = routeSystem.handler(ListTasks, { handle: (request, ctx) => {
      handled(request, ctx);
      return { tasks: [], count: 0 };
    } });
  }
  let api: Api;
  let url: URL;
  const verify = vi.fn((token: string) => {
    if (token === 'unavailable') throw new Error('private credential store name');
    return { kind: 'user' as const, userId: token };
  });
  const client = (token: string) => createClient({
    baseUrl: url, tokens: { get: () => ({ accessToken: token }) }, tenant: () => 'a',
  });
  beforeAll(async () => {
    api = await createApi({
      resources, routeSystem, routes: [TaskRoutes], verifiers: [{ verify }], bodyLimit: 128, host: '127.0.0.1',
      membership: ({ principal }) => {
        if (principal.userId === 'outage') throw new Error('private membership store name');
        return { role: principal.userId };
      },
    });
    url = await api.listen(0);
  });
  afterAll(async () => { await api?.close(); });

  it('decodes a GET path parameter into the model key and enforces the read role before validation', async () => {
    handled.mockClear();
    const load = (path: string, role: string) => fetch(new URL(path, url), {
      headers: { Authorization: 'Bearer ' + role, 'X-Workspace-Id': 'a' },
    });
    const denied = await load('/tasks/0', 'GUEST');
    expect(await denied.json()).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
    const badKey = await load('/tasks/0', 'READER');
    expect(await badKey.json()).toMatchObject({ code: 422, issues: [{ path: 'key' }] });
    const badQuery = await load('/tasks/17?title=other', 'READER');
    expect(await badQuery.json()).toMatchObject({ code: 422, issues: [{ path: 'title' }] });
    expect(handled).not.toHaveBeenCalled();

    const result = await client('READER').call(GetTask, { key: 17 });
    expect(result).toEqual({ code: 200, data: { key: 17, workspaceId: 'a', title: 'Read task' } });
    expect(handled).toHaveBeenCalledExactlyOnceWith({ key: 17 }, expect.objectContaining({ tenant: { id: 'a' } }));
  });

  it('returns typed envelopes for item path errors, unexpected bodies and reads with cache headers', async () => {
    const headers = { Authorization: 'Bearer READER', 'X-Workspace-Id': 'a' };
    const invalid = await fetch(new URL('/tasks/%', url), { headers });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 400, error: 'Request.INVALID_PATH' });
    const unexpected = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = httpRequest(new URL('/tasks/17', url), { method: 'GET', headers: { ...headers, 'Content-Length': 2 } }, resolve);
      req.on('error', reject);
      req.end('{}');
    });
    expect(unexpected.statusCode).toBe(400);
    expect(await json(unexpected)).toMatchObject({ code: 400, error: 'Request.UNEXPECTED_BODY' });
    const read = await fetch(new URL('/tasks/17', url), {
      headers: { ...headers, 'If-None-Match': '*', 'Cache-Control': 'max-age=0' },
    });
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ code: 200, data: { title: 'Read task' } });
  });

  it('checks read access before decoding a list query and validates offset paging for the handler', async () => {
    handled.mockClear();
    const load = (query: string, role: string) => fetch(new URL('/tasks' + query, url), {
      headers: { Authorization: 'Bearer ' + role, 'X-Workspace-Id': 'a' },
    });
    const denied = await load('?page=-1', 'GUEST');
    expect(denied.status).toBe(403);
    for (const [query, path] of [['?page=-1', 'page'], ['?perPage=0', 'perPage'], ['?page=0&page=1', 'page'], ['?workspaceId=b', 'workspaceId']]) {
      const invalid = await load(query, 'READER');
      expect(invalid.status).toBe(422);
      expect(await invalid.json()).toMatchObject({ code: 422, issues: [{ path }] });
    }
    expect(handled).not.toHaveBeenCalled();
    expect(await (await load('', 'READER')).json()).toEqual({ code: 200, data: { tasks: [], count: 0 } });
    expect(handled).toHaveBeenCalledExactlyOnceWith({ page: 0, perPage: 20 }, expect.objectContaining({ tenant: { id: 'a' } }));
  });

  it('enforces declared field write roles after decoding and supplies the derived tenant context', async () => {
    handled.mockClear();
    const input = { title: 'task', flag: 'on' };
    const blocked = await client('MEMBER').call(CreateTask, input);
    expect(blocked).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
    expect(handled).not.toHaveBeenCalled();
    expect((await client('MEMBER').call(CreateTask, { title: 'allowed' })).code).toBe(201);
    expect((await client('ADMIN').call(CreateTask, input)).code).toBe(201);
    expect(handled).toHaveBeenLastCalledWith(input, expect.objectContaining({
      workspace: { id: 'a' }, principal: { kind: 'user', userId: 'ADMIN' }, membership: { role: 'ADMIN' },
    }));
  });

  it('checks delete access before rejecting a body and maps invalid item IDs to the request field', async () => {
    handled.mockClear();
    const remove = (key: number, token?: string, body?: string) => fetch(new URL('/tasks/' + key, url), {
      method: 'DELETE', body, headers: { 'X-Workspace-Id': 'a', ...(token && { Authorization: 'Bearer ' + token }) },
    });
    expect(await (await remove(17, undefined, '{}')).json()).toMatchObject({ code: 401 });
    expect(await (await remove(17, 'MEMBER', '{}')).json()).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
    expect(await (await remove(17, 'ADMIN', '{}')).json()).toMatchObject({ code: 400, error: 'Request.UNEXPECTED_BODY' });
    expect(await (await remove(0, 'ADMIN')).json()).toMatchObject({ code: 422, issues: [{ path: 'key' }] });
    expect(handled).not.toHaveBeenCalled();
    expect(await client('ADMIN').call(DeleteTask, { key: 17 })).toStrictEqual({ code: 200 });
    expect(handled).toHaveBeenCalledExactlyOnceWith({ key: 17 }, expect.objectContaining({ tenant: { id: 'a' } }));
  });

  it('applies field write roles to the fields supplied in a PATCH', async () => {
    handled.mockClear();
    const input = { key: 17, flag: 'on' };
    expect(await client('MEMBER').call(UpdateTask, input)).toMatchObject({ code: 403, error: 'Auth.FORBIDDEN' });
    expect(handled).not.toHaveBeenCalled();
    expect((await client('MEMBER').call(UpdateTask, { key: 17, title: 'Renamed' })).code).toBe(200);
    expect(await client('ADMIN').call(UpdateTask, input)).toMatchObject({ code: 200, data: { key: 17, flag: 'on' } });
    expect(handled).toHaveBeenLastCalledWith(input, expect.objectContaining({ tenant: { id: 'a' } }));
  });

  it('limits bytes before verification and returns a flat validation issue for an unrecognized query field', async () => {
    verify.mockClear();
    const large = await client('MEMBER').call(CreateTask, { title: 'x'.repeat(300) });
    expect(large).toMatchObject({ code: 400, error: 'Request.BODY_TOO_LARGE' });
    expect(verify).not.toHaveBeenCalled();
    const headers = { Authorization: 'Bearer MEMBER', 'X-Workspace-Id': 'a', 'Content-Type': 'application/json' };
    const invalid = await fetch(new URL('/tasks', url), { method: 'POST', headers, body: '{' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 400, error: 'Request.INVALID_JSON' });
    const unexpected = await fetch(new URL('/tasks?flag=on', url), { method: 'POST', headers, body: '{"title":"ok"}' });
    expect(unexpected.status).toBe(422);
    expect(await unexpected.json()).toMatchObject({ code: 422, issues: [{ path: 'flag' }] });
  });

  it('reports unavailable verification and membership stores without disclosing private errors', async () => {
    for (const [token, name] of [['unavailable', 'Session.UNAVAILABLE'], ['outage', 'Tenant.UNAVAILABLE']]) {
      const result = await client(token).call(CreateTask, { title: 'test' });
      expect(result).toEqual({ code: 503, error: name, traceId: expect.any(String) });
    }
  });

  it('maps declared domain errors, handler failures and unexpected exceptions to their wire responses', async () => {
    for (const [title, code, error] of [
      ['duplicate', 409, 'Task.DUPLICATE'], ['missing', 404, 'Resource.NOT_FOUND'], ['private', 500, 'Server.INTERNAL'],
    ] as const) {
      expect(await client('MEMBER').call(CreateTask, { title })).toEqual({ code, error, traceId: expect.any(String) });
    }
  });
});

it('checks resource ownership independently of a tenant scope override and rejects credential headers', async () => {
  async function start(tenancy: ResourceTenancy, owner?: string, header?: string) {
    const resources = createResourceSystem({
      roles: ['EDITOR'], tenant: { resource: () => Workspace, header },
    });
    const { Resource, Prop, endpoints } = resources;
    @Resource()
    class Workspace { @Prop.string({ crud: 'id' }) id!: Id<string>; }
    @Resource({ tenancy, owner })
    class Entry {
      @Prop.string({ crud: 'id' }) id!: Id<string>;
      @Prop.string({ crud: 'tenant' }) workspaceId!: Tenant<string>;
      @Prop.string() userId!: string;
    }
    const { CreateEntry } = endpoints(Entry, {
      name: 'Entry', scope: 'tenant', access: { write: 'EDITOR' },
      operations: { Create: true, Get: false, List: false, Update: false, Delete: false },
    });
    const routeSystem = createRouteSystem();
    @routeSystem.Routes()
    class EntryRoutes { create = routeSystem.handler(CreateEntry, { handle: () => failure.notFound() }); }
    return createApi({ resources, routes: [EntryRoutes], routeSystem, verifiers: [{ verify: () => undefined }], membership: () => undefined });
  }
  for (const [tenancy, owner] of [['account', 'userId'], ['shared'], ['self'], ['owned', 'userId']] as const) {
    await expect(start(tenancy, owner)).rejects.toThrow('requires a tenant-owned resource without a separate owner field');
  }
  await expect(start('owned', undefined, 'aUtHoRiZaTiOn')).rejects.toThrow('cannot use credential header');
});
