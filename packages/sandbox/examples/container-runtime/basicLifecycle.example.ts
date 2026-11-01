import { type AbstractContainerRuntime, DockerContainerRuntime } from '../../src/container-runtime/index.js';

/** Explicit lifecycle: create, start and exec, then always stop and remove. Returns the container's Node.js version. */
export async function basicLifecycleExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<string> {
  const handle = await runtime.createContainer({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
    workspaceMountPath: '/workspace',
    init: true,
    command: ['sleep', 'infinity'],
  });

  try {
    await runtime.startContainer(handle.id);

    const version = await runtime.execInWorkspace(handle, ['node', '--version']);
    if (version.exitCode !== 0) {
      throw new Error(version.stderr || version.stdout);
    }
    return version.stdout.trim();
  } finally {
    await runtime.stopContainer(handle.id, { timeoutSeconds: 5 });
    await runtime.removeContainer(handle.id, { force: true, volumes: true });
  }
}
