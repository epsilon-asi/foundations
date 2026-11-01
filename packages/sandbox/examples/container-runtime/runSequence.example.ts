import { type AbstractContainerRuntime, DockerContainerRuntime } from '../../src/container-runtime/index.js';

/** Runs install, build and test in order, stopping at the first failure. Returns the exit codes of the commands that ran. */
export async function runSequenceExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<(number | null)[]> {
  const handle = await runtime.createCodingAgentContainer({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
  });

  try {
    const results = await runtime.runCommandSequence(handle, [
      { command: ['npm', 'ci'], cwd: handle.workspaceMountPath },
      { command: ['npm', 'run', 'build'], cwd: handle.workspaceMountPath },
      { command: ['npm', 'test'], cwd: handle.workspaceMountPath },
    ]);
    return results.map((result) => result.exitCode);
  } finally {
    await runtime.stopContainer(handle.id);
    await runtime.removeContainer(handle.id, { force: true });
  }
}
