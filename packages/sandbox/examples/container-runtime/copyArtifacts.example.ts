import { type AbstractContainerRuntime, DockerContainerRuntime } from '../../src/container-runtime/index.js';

/** Copies a host file into a running container, transforms it there, and copies the result back out. */
export async function copyArtifactsExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<void> {
  const handle = await runtime.createCodingAgentContainer({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
  });

  try {
    await runtime.copyToContainer({
      containerId: handle.id,
      sourcePath: '/tmp/host-input.txt',
      targetPath: '/tmp/container-input.txt',
    });

    const transform = await runtime.exec({
      containerId: handle.id,
      command: ['/bin/sh', '-lc', 'cat /tmp/container-input.txt > /tmp/container-output.txt'],
    });
    if (transform.exitCode !== 0) {
      throw new Error(transform.stderr || transform.stdout);
    }

    await runtime.copyFromContainer({
      containerId: handle.id,
      sourcePath: '/tmp/container-output.txt',
      targetPath: '/tmp/host-output.txt',
    });
  } finally {
    await runtime.stopContainer(handle.id);
    await runtime.removeContainer(handle.id, { force: true });
  }
}
