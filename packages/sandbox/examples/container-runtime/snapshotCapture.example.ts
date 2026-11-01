import {
  type AbstractContainerRuntime,
  type ContainerSnapshot,
  DockerContainerRuntime,
} from '../../src/container-runtime/index.js';

/** Writes a file in the workspace, then captures inspection data, logs and filesystem changes. */
export async function snapshotCaptureExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<ContainerSnapshot> {
  const handle = await runtime.createCodingAgentContainer({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
  });

  try {
    await runtime.execShellInWorkspace(handle, "printf 'hello\\n' > /workspace/example-output.txt");
    return await runtime.captureContainerSnapshot(handle.id);
  } finally {
    await runtime.stopContainer(handle.id);
    await runtime.removeContainer(handle.id, { force: true });
  }
}
