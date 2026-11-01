import { type AbstractContainerRuntime, DockerContainerRuntime } from '../../src/container-runtime/index.js';

/** Starts a service with a healthcheck, waits until it is healthy, and returns the reported health. */
export async function serviceHealthcheckExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<string | null | undefined> {
  const handle = await runtime.createStartedContainer({
    image: 'postgres:17',
    workspacePath: '/tmp/empty-workspace',
    workspaceMountPath: '/workspace',
    env: {
      POSTGRES_PASSWORD: 'dev',
    },
    command: ['postgres'],
    extraCreateArgs: ['--health-cmd', 'pg_isready -U postgres', '--health-interval', '2s', '--health-retries', '10'],
  });

  try {
    const inspection = await runtime.waitForHealthy(handle.id, {
      timeoutMs: 60_000,
      pollIntervalMs: 1_000,
      treatMissingHealthcheckAsSuccess: false,
    });
    return inspection.state?.health;
  } finally {
    await runtime.stopContainer(handle.id);
    await runtime.removeContainer(handle.id, { force: true, volumes: true });
  }
}
