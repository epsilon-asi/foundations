import {
  type AbstractContainerRuntime,
  DockerContainerRuntime,
  buildNodeTypescriptContainerOptions,
} from '../../src/container-runtime/index.js';

/**
 * Node/TypeScript install, test and build in a scoped container with a host npm cache mount.
 * Returns the exit code of every command that ran (the sequence stops at the first failure).
 */
export async function nodeInstallTestBuildExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<(number | null)[]> {
  const options = buildNodeTypescriptContainerOptions({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
    packageManager: 'npm',
    installCachePath: '/tmp/npm-cache',
  });

  return await runtime.withContainer(options, async (handle) => {
    await runtime.configureGitSafeDirectory(handle);

    const results = await runtime.runCommandSequence(handle, [
      { command: ['npm', 'ci'], cwd: handle.workspaceMountPath },
      { command: ['npm', 'test'], cwd: handle.workspaceMountPath },
      { command: ['npm', 'run', 'build'], cwd: handle.workspaceMountPath },
    ]);
    return results.map((result) => result.exitCode);
  });
}
