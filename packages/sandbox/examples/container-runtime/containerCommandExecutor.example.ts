import path from 'node:path';

import {
  type AbstractContainerRuntime,
  type CommandExecutionResult,
  ContainerCommandExecutor,
  DockerContainerRuntime,
  buildCodingAgentContainerOptions,
} from '../../src/container-runtime/index.js';

/**
 * Runs a host-style command inside a container. `ContainerCommandExecutor` implements the shared `CommandExecutor`,
 * so anything that accepts an executor can run in the container; host paths under the workspace map to the mount.
 * Returns the result of `npm test` run in `/workspace/packages/app`.
 */
export async function containerCommandExecutorExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<CommandExecutionResult> {
  const workspacePath = '/tmp/my-repo';
  const options = buildCodingAgentContainerOptions({ image: 'node:24.15.0-bookworm-slim', workspacePath });

  return await runtime.withContainer(options, async (container) => {
    const executor = new ContainerCommandExecutor({ runtime, container, env: { FORCE_COLOR: '0' } });
    return await executor.run('npm', ['test'], {
      cwd: path.join(workspacePath, 'packages', 'app'),
      timeoutMs: 600_000,
    });
  });
}
