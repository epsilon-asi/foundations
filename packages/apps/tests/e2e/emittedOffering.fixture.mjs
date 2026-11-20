import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@epsilon-asi/apps';

const output = process.argv[2];
const { startOfferingApi } = await import(pathToFileURL(join(output, 'api/src/main.js')));
const { CreateOffering, DeleteOffering, GetOffering, ListOfferings, OfferingType, UpdateOffering } = await import(pathToFileURL(join(output, 'common/src/resources/Offering.js')));
const organization = '018f515e-0cca-7000-8000-000000000001';
const api = await startOfferingApi({
  port: 0, host: '127.0.0.1', env: { APP_ENV: 'test' },
  verifiers: [{ testOnly: true, verify: token => token === 'admin-token' ? { kind: 'user', userId: 'alice' } : undefined }],
  membership: ({ principal, tenantId }) => principal.userId === 'alice' && tenantId === organization ? { role: 'ADMINISTRATOR' } : undefined,
});
try {
  const client = createClient({
    baseUrl: api.url, tenant: () => organization, tokens: { get: () => ({ accessToken: 'admin-token' }) },
  });
  const reply = await client.call(CreateOffering, { name: 'Starter', description: 'Trial plan', type: OfferingType.Service });
  assert.equal(reply.code, 201);
  assert.equal(reply.data.organizationId, organization);
  assert.equal(reply.data.name, 'Starter');
  assert.deepEqual(reply.data.links, []);
  assert.ok(reply.data.createdAt instanceof Date);
  const found = await client.call(GetOffering, { id: reply.data.id });
  assert.equal(found.code, 200);
  assert.deepEqual(found.data, reply.data);
  const patched = await client.call(UpdateOffering, { id: reply.data.id, name: 'Team' });
  assert.deepEqual(patched, { code: 200, data: { ...reply.data, name: 'Team' } });
  assert.deepEqual(await client.call(GetOffering, { id: reply.data.id }), patched);
  assert.deepEqual(await client.call(ListOfferings, { where: { type: { $eq: OfferingType.Service } }, orderBy: { name: 'asc', createdAt: 'desc' }, perPage: 1 }), {
    code: 200, data: { offerings: [patched.data], count: 1 },
  });
  assert.deepEqual(await client.call(DeleteOffering, { id: reply.data.id }), { code: 200 });
  assert.equal((await client.call(GetOffering, { id: reply.data.id })).code, 404);
  assert.deepEqual(await client.call(ListOfferings, {}), { code: 200, data: { offerings: [], count: 0 } });
} finally {
  await api.close();
}
