import { createTestApp } from '@epsilon-asi/apps/testing';
import { it, onTestFinished } from 'vitest';
import { OfferingRoutes } from '../../examples/crud-api/api/src/routes/OfferingRoutes.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { verifyOfferingDeletion } from './offeringDelete.fixture.js';
import { observeOfferingHttp } from './offeringIsolation.fixture.js';

it('deletes the selected offering only for an authorized tenant administrator over HTTP', async () => {
  const { transport, responses } = observeOfferingHttp();
  const app = await createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' }, fetch: transport });
  onTestFinished(() => app.close());
  await verifyOfferingDeletion({ writer: app, responses });
});
