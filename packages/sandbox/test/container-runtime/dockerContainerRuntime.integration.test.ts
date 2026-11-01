import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';

import {
  ContainerCommandExecutor,
  ContainerNotFoundError,
  DockerContainerRuntime,
} from '../../src/container-runtime/index.js';

const IMAGE = 'node:24.15.0-bookworm-slim';

const describeIntegration = process.env.SANDBOX_CONTAINER_RUNTIME_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('DockerContainerRuntime integration', () => {
  const temporaryDirectories: string[] = [];
  const runtime = new DockerContainerRuntime();

  async function createWorkspace(): Promise<string> {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'container-runtime-workspace-'));
    temporaryDirectories.push(workspace);
    return workspace;
  }

  afterAll(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map(async (directory) => {
        await rm(directory, { recursive: true, force: true });
      }),
    );
  });

  it('creates a real container, execs in the workspace, and copies artifacts in and out', async () => {
    const workspace = await createWorkspace();
    const copiedOut = path.join(workspace, 'copied-out.txt');
    const hostInput = path.join(workspace, 'host-input.txt');
    await writeFile(hostInput, 'host hello\n', 'utf8');

    await expect(runtime.isAvailable()).resolves.toBe(true);

    await runtime.withContainer(
      {
        image: IMAGE,
        workspacePath: workspace,
        workspaceMountPath: '/workspace',
        init: true,
        command: ['sleep', 'infinity'],
        pullPolicy: 'missing',
      },
      async (handle) => {
        const version = await runtime.execInWorkspace(handle, ['node', '--version']);
        expect(version.exitCode).toBe(0);
        expect(version.stdout).toContain('v24.');

        const workspaceRead = await runtime.execShellInWorkspace(handle, 'cat /workspace/host-input.txt');
        expect(workspaceRead.stdout).toContain('host hello');

        await runtime.copyToContainer({
          containerId: handle.id,
          sourcePath: hostInput,
          targetPath: '/tmp/copied-in.txt',
        });
        const copiedIn = await runtime.exec({ containerId: handle.id, command: ['cat', '/tmp/copied-in.txt'] });
        expect(copiedIn.stdout).toContain('host hello');

        const produceArtifact = await runtime.exec({
          containerId: handle.id,
          command: ['/bin/sh', '-lc', "printf 'container hello\n' > /tmp/copied-out.txt"],
        });
        expect(produceArtifact.exitCode).toBe(0);

        await runtime.copyFromContainer({
          containerId: handle.id,
          sourcePath: '/tmp/copied-out.txt',
          targetPath: copiedOut,
        });
        await expect(readFile(copiedOut, 'utf8')).resolves.toBe('container hello\n');

        const failing = await runtime.exec({ containerId: handle.id, command: ['/bin/sh', '-c', 'exit 3'] });
        expect(failing.exitCode).toBe(3);

        const snapshot = await runtime.captureContainerSnapshot(handle.id);
        expect(snapshot.inspection.id).toBe(handle.id);
        expect(snapshot.filesystemChanges).toContainEqual({ kind: 'A', path: '/tmp/copied-out.txt' });
      },
    );
  }, 180_000);

  it('labels, lists, waits for and cleans up coding-agent containers', async () => {
    const workspace = await createWorkspace();
    const handle = await runtime.createCodingAgentContainer({ image: IMAGE, workspacePath: workspace });

    try {
      await expect(runtime.isContainerRunning(handle.id)).resolves.toBe(true);
      const containers = await runtime.listCodingAgentContainers();
      expect(containers.map((container) => container.id)).toContain(handle.id);
      expect(containers.find((container) => container.id === handle.id)?.labels).toMatchObject({
        'sandbox.kind': 'coding-agent',
        'sandbox.profile': 'general',
      });

      await runtime.killContainer(handle.id, 'SIGKILL');
      await expect(runtime.waitForExit(handle.id)).resolves.toMatchObject({ containerId: handle.id });
    } finally {
      await runtime.removeContainer(handle.id, { force: true });
    }

    await expect(runtime.containerExists(handle.id)).resolves.toBe(false);
    await expect(runtime.inspectContainer(handle.id)).rejects.toBeInstanceOf(ContainerNotFoundError);
    await expect(runtime.stopContainer(handle.id)).rejects.toBeInstanceOf(ContainerNotFoundError);
  }, 180_000);

  it('runs host-style commands inside the container through ContainerCommandExecutor', async () => {
    const workspace = await createWorkspace();
    await mkdir(path.join(workspace, 'pkg'));
    await writeFile(path.join(workspace, 'pkg', 'marker.txt'), 'in pkg\n', 'utf8');

    let executor: ContainerCommandExecutor | undefined;
    await runtime.withContainer({ image: IMAGE, workspacePath: workspace, init: true }, async (container) => {
      executor = new ContainerCommandExecutor({ runtime, container, env: { GREETING: 'hi' } });

      const pwd = await executor.run('pwd', [], { cwd: path.join(workspace, 'pkg') });
      expect(pwd).toMatchObject({ command: ['pwd'], cwd: '/workspace/pkg', exitCode: 0, stdout: '/workspace/pkg\n' });

      const viaRealPath = await executor.run('cat', ['marker.txt'], {
        cwd: await realpath(path.join(workspace, 'pkg')),
      });
      expect(viaRealPath).toMatchObject({ cwd: '/workspace/pkg', stdout: 'in pkg\n' });

      const envAndStdin = await executor.run('/bin/sh', ['-c', 'echo "$GREETING $EXTRA"; cat'], {
        env: { EXTRA: 'there' },
        stdin: 'piped',
      });
      expect(envAndStdin).toMatchObject({ cwd: '/workspace', exitCode: 0, stdout: 'hi there\npiped' });

      await expect(executor.run('/bin/sh', ['-c', 'exit 4'])).resolves.toMatchObject({ exitCode: 4 });
      await expect(executor.run('sleep', ['30'], { timeoutMs: 300 })).resolves.toMatchObject({ timedOut: true });
    });

    await expect(executor?.run('pwd', [])).rejects.toBeInstanceOf(ContainerNotFoundError);
  }, 180_000);
});
