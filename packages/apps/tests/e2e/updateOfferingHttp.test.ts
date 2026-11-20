import { createTestApp } from '@epsilon-asi/apps/testing';
import { it, onTestFinished } from 'vitest';
import { OfferingRoutes } from '../../examples/crud-api/api/src/routes/OfferingRoutes.js';
import { resources } from '../../examples/crud-api/common/src/app.js';
import { observeOfferingPatches, verifyOfferingUpdates } from './offeringUpdate.fixture.js';

it('updates only supplied fields and enforces tenant ownership and the write role over HTTP', async () => {
  const http = observeOfferingPatches();
  const writer = await createTestApp({ resources, routes: [OfferingRoutes], env: { APP_ENV: 'test' }, fetch: http.transport });
  onTestFinished(() => writer.close());
  await verifyOfferingUpdates({ writer, http });
});
