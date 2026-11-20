import { createTestApp } from '@epsilon-asi/apps/testing';
import { expect, it, onTestFinished } from 'vitest';
import { OfferingRoutes } from '../../examples/crud-api/api/src/routes/OfferingRoutes.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { CreateOffering, GetOffering } from '../../examples/crud-api/common/src/resources/Offering.js';
import { input, observeOfferingHttp, organizationA, verifyOfferingIsolation } from './offeringIsolation.fixture.js';

async function start(transport?: typeof fetch) {
  const app = await createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' }, fetch: transport });
  onTestFinished(() => app.close());
  return app;
}

it('serves the stored row to its tenant and returns the same public 404 for a foreign or missing row', async () => {
  const { transport, responses } = observeOfferingHttp();
  const app = await start(transport);
  await verifyOfferingIsolation({ writer: app, responses });
});

it('scopes the row store to each running app, including when the same organization and user are present in both', async () => {
  const first = await start();
  const second = await start();
  const actor = { user: 'member', tenant: organizationA, role: 'EDITOR' };
  const original = first.as(actor);
  const other = second.as(actor);
  const created = await original.call(CreateOffering, input);
  if (created.code !== 201) throw new Error('Expected the first app to store the offering');
  const lookup = { id: created.data.id };
  expect(await other.call(GetOffering, lookup)).toMatchObject({ code: 404, error: 'Resource.NOT_FOUND' });
  expect(await original.call(GetOffering, lookup)).toMatchObject({ code: 200, data: created.data });
});
