import { type AbstractContainerRuntime, DockerContainerRuntime } from '../../src/container-runtime/index.js';

/** Coding-agent container over a bind-mounted checkout: install and test, then tear down. Returns the test output. */
export async function codingAgentWorkspaceExample(
  runtime: AbstractContainerRuntime = new DockerContainerRuntime(),
): Promise<string> {
  const handle = await runtime.createCodingAgentContainer({
    image: 'node:24.15.0-bookworm-slim',
    workspacePath: '/tmp/my-repo',
    secureDefaults: true,
  });

  try {
    await runtime.configureGitSafeDirectory(handle);

    const install = await runtime.execInWorkspace(handle, ['npm', 'ci']);
    if (install.exitCode !== 0) {
      throw new Error(install.stderr || install.stdout);
    }

    const test = await runtime.execInWorkspace(handle, ['npm', 'test']);
    if (test.exitCode !== 0) {
      throw new Error(test.stderr || test.stdout);
    }
    return test.stdout;
  } finally {
    await runtime.stopContainer(handle.id);
    await runtime.removeContainer(handle.id, { force: true });
  }
}
