import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { it } from 'vitest';

const run = promisify(execFile);
const packageDir = fileURLToPath(new URL('../../', import.meta.url));

it('discovers the emitted OfferingRoutes beside the API entry in native Node', async () => {
  // Keep Node package resolution identical to a build under examples/crud-api/dist.
  const cache = join(packageDir, '.cache');
  await mkdir(cache, { recursive: true });
  const output = await mkdtemp(join(cache, 'offering-api-'));
  try {
    await run(process.execPath, [
      'node_modules/typescript/bin/tsc', '-p', 'examples/crud-api/tsconfig.json', '--outDir', output,
    ], { cwd: packageDir, timeout: 30_000 });
    await run(process.execPath, ['tests/e2e/emittedOffering.fixture.mjs', output], {
      cwd: packageDir, timeout: 15_000, killSignal: 'SIGKILL',
    });
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}, 50_000);
