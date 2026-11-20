import { createTestApp } from '@epsilon-asi/apps/testing';
import { it, onTestFinished } from 'vitest';
import { OfferingRoutes } from '../../examples/crud-api/api/src/routes/OfferingRoutes.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { observeOfferingHttp } from './offeringIsolation.fixture.js';
import { verifyFilteredOfferingList, verifyOfferingList } from './offeringList.fixture.js';

it('lists only the selected tenant’s offerings and total count on every offset page', async () => {
  const { transport, responses } = observeOfferingHttp();
  const app = await createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' }, fetch: transport });
  onTestFinished(() => app.close());
  await verifyOfferingList({ writer: app, responses });
});

it('filters and sorts the tenant’s offerings through the typed client', async () => {
  const http = observeOfferingHttp();
  const app = await createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' }, fetch: http.transport });
  onTestFinished(() => app.close());
  await verifyFilteredOfferingList({ writer: app, ...http });
});
