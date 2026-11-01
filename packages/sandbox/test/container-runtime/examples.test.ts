import { describe, expect, it } from 'vitest';
import { DockerContainerRuntime } from '../../src/container-runtime/index.js';
import { basicLifecycleExample } from '../../examples/container-runtime/basicLifecycle.example.js';
import { codingAgentWorkspaceExample } from '../../examples/container-runtime/codingAgentWorkspace.example.js';
import { containerCommandExecutorExample } from '../../examples/container-runtime/containerCommandExecutor.example.js';
import { copyArtifactsExample } from '../../examples/container-runtime/copyArtifacts.example.js';
import {
  RecordingExampleRuntime,
  runCustomRuntimeExample,
} from '../../examples/container-runtime/customRuntime.example.js';
import { nodeInstallTestBuildExample } from '../../examples/container-runtime/nodeInstallTestBuild.example.js';
import { runSequenceExample } from '../../examples/container-runtime/runSequence.example.js';
import { secureReadonlyContainerExample } from '../../examples/container-runtime/secureReadonlyContainer.example.js';
import { serviceHealthcheckExample } from '../../examples/container-runtime/serviceHealthcheck.example.js';
import { snapshotCaptureExample } from '../../examples/container-runtime/snapshotCapture.example.js';
import { fakeDockerCli, type FakeDockerCliOptions } from './fixtures/fakeDockerCli.js';
import { RecordingCommandExecutor } from './fixtures/recordingCommandExecutor.js';

/** A real Docker runtime whose CLI calls are answered by a fake daemon and recorded. */
function fakeDocker(options?: FakeDockerCliOptions): {
  executor: RecordingCommandExecutor;
  runtime: DockerContainerRuntime;
} {
  const executor = new RecordingCommandExecutor(fakeDockerCli(options));
  return { executor, runtime: new DockerContainerRuntime({ executor }) };
}

function argsOf(executor: RecordingCommandExecutor, verb: string): string[][] {
  return executor.calls.filter((call) => call.args.slice(0, 2).join(' ') === verb).map((call) => call.args);
}

const TEARDOWN = ['container stop', 'container rm'];
const STARTUP = ['image inspect', 'container create', 'container start'];

describe('examples against a fake Docker CLI', () => {
  it('basicLifecycleExample creates, starts, execs and always tears down', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'node --version': { stdout: 'v24.15.0\n' } } });

    await expect(basicLifecycleExample(runtime)).resolves.toBe('v24.15.0');

    expect(executor.verbs).toEqual(['container create', 'container start', 'container exec', ...TEARDOWN]);
    expect(argsOf(executor, 'container exec')).toEqual([
      ['container', 'exec', '--workdir', '/workspace', 'ctr-1', 'node', '--version'],
    ]);
    expect(executor.calls.slice(-2).map((call) => call.args)).toEqual([
      ['container', 'stop', '--time', '5', 'ctr-1'],
      ['container', 'rm', '--force', '--volumes', 'ctr-1'],
    ]);
  });

  it('basicLifecycleExample tears down even when the command fails', async () => {
    const { executor, runtime } = fakeDocker({
      exec: { 'node --version': { exitCode: 127, stderr: 'node: not found' } },
    });

    await expect(basicLifecycleExample(runtime)).rejects.toThrow('node: not found');
    expect(executor.verbs.slice(-2)).toEqual(TEARDOWN);
  });

  it('codingAgentWorkspaceExample creates a secure coding-agent container and runs install + test', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'npm test': { stdout: 'all passed' } } });

    await expect(codingAgentWorkspaceExample(runtime)).resolves.toBe('all passed');

    expect(executor.verbs).toEqual([...STARTUP, 'container exec', 'container exec', 'container exec', ...TEARDOWN]);
    const [create] = argsOf(executor, 'container create');
    expect(create).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop', 'ALL', '--init']));
    expect(create).toContain('sandbox.security-profile=secure-readonly');
    expect(argsOf(executor, 'container exec').map((args) => args.slice(args.indexOf('ctr-1') + 1))).toEqual([
      ['git', 'config', '--global', '--add', 'safe.directory', '/workspace'],
      ['npm', 'ci'],
      ['npm', 'test'],
    ]);
  });

  it('codingAgentWorkspaceExample stops at a failed install and still tears down', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'npm ci': { exitCode: 1, stderr: 'install failed' } } });

    await expect(codingAgentWorkspaceExample(runtime)).rejects.toThrow('install failed');
    expect(argsOf(executor, 'container exec')).toHaveLength(2);
    expect(executor.verbs.slice(-2)).toEqual(TEARDOWN);
  });

  it('containerCommandExecutorExample runs npm test in the mapped workspace directory', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'npm test': { stdout: 'all passed' } } });

    await expect(containerCommandExecutorExample(runtime)).resolves.toMatchObject({
      binary: 'npm',
      args: ['test'],
      command: ['npm', 'test'],
      cwd: '/workspace/packages/app',
      exitCode: 0,
      stdout: 'all passed',
    });

    expect(executor.verbs).toEqual([...STARTUP, 'container exec', ...TEARDOWN]);
    const [exec] = executor.calls.filter((call) => call.args[1] === 'exec');
    expect(exec?.args).toEqual([
      'container',
      'exec',
      '--workdir',
      '/workspace/packages/app',
      '--env',
      'FORCE_COLOR=0',
      'ctr-1',
      'npm',
      'test',
    ]);
    expect(exec?.options).toEqual({ timeoutMs: 600_000 });
  });

  it('copyArtifactsExample copies in, transforms and copies out', async () => {
    const { executor, runtime } = fakeDocker();

    await copyArtifactsExample(runtime);

    expect(executor.verbs).toEqual([...STARTUP, 'container cp', 'container exec', 'container cp', ...TEARDOWN]);
    expect(argsOf(executor, 'container cp')).toEqual([
      ['container', 'cp', '/tmp/host-input.txt', 'ctr-1:/tmp/container-input.txt'],
      ['container', 'cp', 'ctr-1:/tmp/container-output.txt', '/tmp/host-output.txt'],
    ]);
  });

  it('nodeInstallTestBuildExample mounts the npm cache and runs the full sequence in a scoped container', async () => {
    const { executor, runtime } = fakeDocker();

    await expect(nodeInstallTestBuildExample(runtime)).resolves.toEqual([0, 0, 0]);

    expect(executor.verbs).toEqual([...STARTUP, ...Array<string>(4).fill('container exec'), ...TEARDOWN]);
    const [create] = argsOf(executor, 'container create');
    expect(create).toEqual(
      expect.arrayContaining(['NPM_CONFIG_CACHE=/cache/npm', 'type=bind,src=/tmp/npm-cache,dst=/cache/npm']),
    );
    expect(executor.calls.at(-1)?.args).toEqual(['container', 'rm', '--force', 'ctr-1']);
  });

  it('runSequenceExample stops after the first failing command', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'npm run build': { exitCode: 2 } } });

    await expect(runSequenceExample(runtime)).resolves.toEqual([0, 2]);
    expect(argsOf(executor, 'container exec')).toHaveLength(2);
    expect(executor.verbs.slice(-2)).toEqual(TEARDOWN);
  });

  it('secureReadonlyContainerExample mounts the workspace read-only', async () => {
    const { executor, runtime } = fakeDocker({ exec: { 'node --version': { stdout: 'v24.15.0\n' } } });

    await expect(secureReadonlyContainerExample(runtime)).resolves.toBe('v24.15.0');

    const [create] = argsOf(executor, 'container create');
    expect(create).toEqual(expect.arrayContaining(['--read-only', '--network', 'none']));
    expect(create).toContain('type=bind,src=/tmp/my-repo,dst=/workspace,readonly');
    expect(executor.verbs.slice(-2)).toEqual(TEARDOWN);
  });

  it('serviceHealthcheckExample runs the service command and waits for a healthy status', async () => {
    const { executor, runtime } = fakeDocker({ health: 'healthy' });

    await expect(serviceHealthcheckExample(runtime)).resolves.toBe('healthy');

    expect(executor.verbs).toEqual([...STARTUP, 'container inspect', ...TEARDOWN]);
    const [create] = argsOf(executor, 'container create');
    expect(create?.slice(-2)).toEqual(['postgres:17', 'postgres']);
    expect(create).toEqual(expect.arrayContaining(['--health-cmd', 'pg_isready -U postgres']));
  });

  it('snapshotCaptureExample returns parsed inspection, logs and filesystem changes', async () => {
    const { executor, runtime } = fakeDocker();

    const snapshot = await snapshotCaptureExample(runtime);

    expect(snapshot).toMatchObject({
      inspection: { id: 'ctr-1', name: 'ctr-1', state: { running: true } },
      logs: 'ready\n',
      filesystemChanges: [{ kind: 'A', path: '/workspace/example-output.txt' }],
    });
    expect(argsOf(executor, 'container exec')[0]?.slice(-3)).toEqual([
      '/bin/sh',
      '-lc',
      "printf 'hello\\n' > /workspace/example-output.txt",
    ]);
    expect(executor.verbs.slice(-5)).toEqual(['container inspect', 'container logs', 'container diff', ...TEARDOWN]);
  });
});

describe('custom runtime example', () => {
  it('runs a scoped container workflow on the custom backend', async () => {
    await expect(runCustomRuntimeExample()).resolves.toEqual([
      'imageExists:node:24.15.0',
      'create:node:24.15.0',
      'start:recording-1',
      'exec:npm test',
      'stop:recording-1',
      'remove:recording-1',
    ]);
  });

  it('inherits every workflow helper from the abstract runtime', async () => {
    const runtime = new RecordingExampleRuntime();
    const handle = await runtime.createCodingAgentContainer({ image: 'node:24.15.0', workspacePath: '/tmp/repo' });

    const results = await runtime.runCommandSequence(handle, [
      { command: ['npm', 'ci'], cwd: handle.workspaceMountPath },
      { command: ['npm', 'test'], cwd: handle.workspaceMountPath },
    ]);
    await runtime.copyToContainer({ containerId: handle.id, sourcePath: '/host/in', targetPath: '/in' });
    await runtime.copyFromContainer({ containerId: handle.id, sourcePath: '/out', targetPath: '/host/out' });

    expect(handle.workspaceMountPath).toBe('/workspace');
    expect(results.map((result) => result.stdout)).toEqual(['npm ci', 'npm test']);
    expect(runtime.events.slice(-4)).toEqual([
      'exec:npm ci',
      'exec:npm test',
      'copyTo:recording-1:/in',
      'copyFrom:recording-1:/out',
    ]);
    await expect(runtime.isContainerRunning(handle.id)).resolves.toBe(true);
  });
});
