import {
  type AbstractContainerRuntime,
  DockerContainerRuntime,
  buildCodingAgentContainerOptions,
} from '../../src/container-runtime/index.js';

/** Secure container: no network, read-only root filesystem and a read-only workspace. Returns the Node.js version. */
export async function secureReadonlyContainerExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<string> {
  const options = buildCodingAgentContainerOptions({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
    workspaceReadOnly: true,
    secureDefaults: true,
  });

  return await runtime.withContainer(options, async (handle) => {
    const result = await runtime.execInWorkspace(handle, ['node', '--version']);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout);
    }
    return result.stdout.trim();
  });
}
