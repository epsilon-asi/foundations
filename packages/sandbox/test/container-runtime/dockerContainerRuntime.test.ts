import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CommandExecutionError,
  CommandFailedError,
  ContainerNotFoundError,
  ContainerParseError,
  ContainerRuntimeError,
  DockerContainerRuntime,
} from '../../src/container-runtime/index.js';
import type {
  CommandExecutionOptions,
  CommandExecutionResult,
  CommandExecutor,
} from '../../src/container-runtime/index.js';
import { RecordingCommandExecutor } from './fixtures/recordingCommandExecutor.js';

const NOT_FOUND = { exitCode: 1, stderr: 'Error response from daemon: No such container: abc123' };

/** Every container-scoped operation, invoked against container `abc123`. */
const CONTAINER_OPERATIONS: [string, (runtime: DockerContainerRuntime) => Promise<unknown>][] = [
  ['startContainer', (runtime) => runtime.startContainer('abc123')],
  ['stopContainer', (runtime) => runtime.stopContainer('abc123')],
  ['removeContainer', (runtime) => runtime.removeContainer('abc123')],
  ['inspectContainer', (runtime) => runtime.inspectContainer('abc123')],
  ['getLogs', (runtime) => runtime.getLogs('abc123')],
  ['waitForExit', (runtime) => runtime.waitForExit('abc123')],
  ['diffContainer', (runtime) => runtime.diffContainer('abc123')],
  ['pauseContainer', (runtime) => runtime.pauseContainer('abc123')],
  ['unpauseContainer', (runtime) => runtime.unpauseContainer('abc123')],
  ['killContainer', (runtime) => runtime.killContainer('abc123')],
  [
    'copyToContainer',
    (runtime) => runtime.copyToContainer({ containerId: 'abc123', sourcePath: '/a', targetPath: '/b' }),
  ],
  [
    'copyFromContainer',
    (runtime) => runtime.copyFromContainer({ containerId: 'abc123', sourcePath: '/a', targetPath: '/b' }),
  ],
  ['exec', (runtime) => runtime.exec({ containerId: 'abc123', command: ['pwd'] })],
];

describe('DockerContainerRuntime', () => {
  it('checks Docker availability through docker info --format json', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      stdout: JSON.stringify({
        ID: 'daemon-1',
        ServerVersion: '28.1.0',
      }),
    });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.isAvailable()).resolves.toBe(true);

    expect(executor.calls[0]).toEqual({
      binary: 'docker',
      args: ['info', '--format', '{{json .}}'],
    });
  });

  it('returns false from isAvailable when docker info fails', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 1,
      stderr: 'Cannot connect to the Docker daemon',
    });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.isAvailable()).resolves.toBe(false);
  });

  it('checks local image presence with docker image inspect', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: 0 });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.imageExists('node:24.15.0')).resolves.toBe(true);
    expect(executor.calls[0]?.args).toEqual(['image', 'inspect', 'node:24.15.0']);
  });

  it('returns false when docker reports a missing image', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 1,
      stderr: 'Error response from daemon: No such image: missing:latest',
    });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.imageExists('missing:latest')).resolves.toBe(false);
  });

  it('throws CommandFailedError when image inspection fails for another reason', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 125,
      stderr: 'daemon unavailable',
    });

    const error: unknown = await new DockerContainerRuntime({ executor })
      .imageExists('node:24.15.0')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect((error as Error).message).toBe(
      'Failed to inspect Docker image node:24.15.0: docker image inspect node:24.15.0 failed (exit code 125)\ndaemon unavailable',
    );
  });

  it('pulls images through the pure pull builder', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: 0 });

    const runtime = new DockerContainerRuntime({ executor });
    await runtime.pullImage('node:24.15.0');

    expect(executor.calls[0]?.args).toEqual(['image', 'pull', 'node:24.15.0']);
  });

  it('creates containers using the pure create builder and returns a normalized handle', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'abc123\n' });

    const runtime = new DockerContainerRuntime({ executor });
    const handle = await runtime.createContainer({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      workspaceMountPath: '/workspace',
      init: true,
      labels: {
        role: 'test',
      },
    });

    expect(handle).toEqual({
      id: 'abc123',
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      workspaceMountPath: '/workspace',
      state: 'created',
    });

    const args = executor.calls[0]?.args ?? [];
    expect(args.slice(0, 2)).toEqual(['container', 'create']);
    expect(args).toContain('--mount');
    expect(args).toContain('--label');
    expect(args.slice(-3)).toEqual(['node:24.15.0', 'sleep', 'infinity']);
  });

  it('throws a parse error when docker create returns an empty container id', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: '\n' });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(
      runtime.createContainer({
        image: 'node:24.15.0',
        workspacePath: '/tmp/repo',
      }),
    ).rejects.toBeInstanceOf(ContainerRuntimeError);
  });

  it('starts, stops, removes, pauses, unpauses, and kills containers with the expected CLI arguments', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue();
    executor.enqueue();
    executor.enqueue();
    executor.enqueue();
    executor.enqueue();
    executor.enqueue();

    const runtime = new DockerContainerRuntime({ executor });
    await runtime.startContainer('abc123');
    await runtime.stopContainer('abc123', { timeoutSeconds: 5 });
    await runtime.removeContainer('abc123', { force: true, volumes: true });
    await runtime.pauseContainer('abc123');
    await runtime.unpauseContainer('abc123');
    await runtime.killContainer('abc123', 'SIGKILL');

    expect(executor.calls.map((call) => call.args)).toEqual([
      ['container', 'start', 'abc123'],
      ['container', 'stop', '--time', '5', 'abc123'],
      ['container', 'rm', '--force', '--volumes', 'abc123'],
      ['container', 'pause', 'abc123'],
      ['container', 'unpause', 'abc123'],
      ['container', 'kill', '--signal', 'SIGKILL', 'abc123'],
    ]);
  });

  it('parses inspect output into normalized inspections', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      stdout: JSON.stringify([
        {
          Id: 'abc123',
          Name: '/container-1',
          Config: {
            Image: 'node:24.15.0',
            Labels: {
              'sandbox.kind': 'coding-agent',
            },
          },
          State: {
            Status: 'running',
            Running: true,
            ExitCode: 0,
            Health: {
              Status: 'healthy',
            },
          },
          Mounts: [
            {
              Source: '/host/repo',
              Destination: '/workspace',
              RW: true,
              Type: 'bind',
              Mode: 'rw',
            },
          ],
        },
      ]),
    });

    const runtime = new DockerContainerRuntime({ executor });
    const inspection = await runtime.inspectContainer('abc123');

    expect(inspection).toMatchObject({
      id: 'abc123',
      name: 'container-1',
      image: 'node:24.15.0',
      labels: {
        'sandbox.kind': 'coding-agent',
      },
      state: {
        status: 'running',
        running: true,
        health: 'healthy',
      },
      mounts: [
        {
          source: '/host/repo',
          destination: '/workspace',
          rw: true,
          type: 'bind',
        },
      ],
    });
  });

  it('translates missing-container inspect failures into ContainerNotFoundError', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 1,
      stderr: 'Error response from daemon: No such container: abc123',
    });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.inspectContainer('abc123')).rejects.toBeInstanceOf(ContainerNotFoundError);
  });

  it('lists containers by parsing json lines and inspecting each id', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      stdout: [
        JSON.stringify({ ID: 'c1', Image: 'node:24', Names: 'one' }),
        JSON.stringify({ ID: 'c2', Image: 'node:24', Names: 'two' }),
      ].join('\n'),
    });
    executor.enqueue({
      stdout: JSON.stringify([{ Id: 'c1', Config: { Labels: {} }, Mounts: [] }]),
    });
    executor.enqueue({
      exitCode: 1,
      stderr: 'Error response from daemon: No such container: c2',
    });

    const runtime = new DockerContainerRuntime({ executor });
    const containers = await runtime.listContainers({
      all: true,
      filters: {
        label: ['sandbox.kind=coding-agent', 'sandbox.profile=general'],
      },
    });

    expect(containers).toHaveLength(1);
    expect(containers[0]?.id).toBe('c1');
    expect(executor.calls[0]?.args).toEqual([
      'container',
      'ls',
      '--format',
      '{{json .}}',
      '--all',
      '--filter',
      'label=sandbox.kind=coding-agent',
      '--filter',
      'label=sandbox.profile=general',
    ]);
  });

  it('execs with workdir, env, tty, stdin, user, and extra args', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 2,
      stdout: 'partial',
      stderr: 'failed',
      durationMs: 8,
    });

    const runtime = new DockerContainerRuntime({ executor });
    const result = await runtime.exec({
      containerId: 'abc123',
      command: ['npm', 'test'],
      cwd: '/workspace',
      env: {
        CI: '1',
      },
      tty: true,
      stdin: 'input',
      user: 'node',
      extraExecArgs: ['--detach-keys', 'ctrl-x'],
      timeoutMs: 5000,
    });

    expect(result).toMatchObject({
      containerId: 'abc123',
      exitCode: 2,
      stdout: 'partial',
      stderr: 'failed',
      durationMs: 8,
      timedOut: false,
    });
    expect(executor.calls[0]).toEqual({
      binary: 'docker',
      args: [
        'container',
        'exec',
        '--interactive',
        '--tty',
        '--user',
        'node',
        '--workdir',
        '/workspace',
        '--env',
        'CI=1',
        '--detach-keys',
        'ctrl-x',
        'abc123',
        'npm',
        'test',
      ],
      options: {
        stdin: 'input',
        timeoutMs: 5000,
      },
    });
  });

  it('translates missing-container exec failures into ContainerNotFoundError', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({
      exitCode: 1,
      stderr: 'Error response from daemon: No such container: abc123',
    });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(
      runtime.exec({
        containerId: 'abc123',
        command: ['pwd'],
      }),
    ).rejects.toBeInstanceOf(ContainerNotFoundError);
  });

  it('gets logs and returns stdout', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'hello\n' });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.getLogs('abc123', { tail: 100, timestamps: true })).resolves.toBe('hello\n');
    expect(executor.calls[0]?.args).toEqual(['container', 'logs', '--tail', '100', '--timestamps', 'abc123']);
  });

  it('waits for exit and parses the numeric exit code', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: '17\n' });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.waitForExit('abc123')).resolves.toEqual({
      containerId: 'abc123',
      exitCode: 17,
    });
  });

  it('throws when docker wait returns a non-numeric exit code', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'not-a-number\n' });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.waitForExit('abc123')).rejects.toBeInstanceOf(ContainerRuntimeError);
  });

  it('copies files to and from containers with the pure copy builders', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue();
    executor.enqueue();

    const runtime = new DockerContainerRuntime({ executor });
    await runtime.copyToContainer({
      containerId: 'abc123',
      sourcePath: '/host/input.txt',
      targetPath: '/workspace/input.txt',
    });
    await runtime.copyFromContainer({
      containerId: 'abc123',
      sourcePath: '/workspace/output.txt',
      targetPath: '/host/output.txt',
    });

    expect(executor.calls[0]?.args).toEqual(['container', 'cp', '/host/input.txt', 'abc123:/workspace/input.txt']);
    expect(executor.calls[1]?.args).toEqual(['container', 'cp', 'abc123:/workspace/output.txt', '/host/output.txt']);
  });

  it('parses filesystem changes from docker diff', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'A /workspace/a\nD /workspace/b\n' });

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.diffContainer('abc123')).resolves.toEqual([
      { kind: 'A', path: '/workspace/a' },
      { kind: 'D', path: '/workspace/b' },
    ]);
  });

  it('propagates spawn failures from the executor unchanged', async () => {
    const executor = new RecordingCommandExecutor();
    const spawnFailure = new CommandExecutionError('spawn failed', {
      binary: 'docker',
      args: ['container', 'ls'],
      cwd: '/x',
    });
    executor.enqueueError(spawnFailure);

    const runtime = new DockerContainerRuntime({ executor });
    await expect(runtime.listContainers()).rejects.toBe(spawnFailure);
  });

  it.each(CONTAINER_OPERATIONS)('%s maps "No such container" to ContainerNotFoundError', async (_name, operation) => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue(NOT_FOUND);

    const error: unknown = await operation(new DockerContainerRuntime({ executor })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ContainerNotFoundError);
    expect(error).toMatchObject({ containerId: 'abc123', result: { exitCode: 1 } });
  });

  it('reports other container command failures as CommandFailedError with the result', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: 125, stdout: 'out', stderr: 'daemon exploded' });

    const error: unknown = await new DockerContainerRuntime({ executor })
      .startContainer('abc123')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error).not.toBeInstanceOf(ContainerRuntimeError);
    expect((error as CommandFailedError).message).toBe(
      'Failed to start container abc123: docker container start abc123 failed (exit code 125)\ndaemon exploded',
    );
    expect((error as CommandFailedError).result).toMatchObject({
      command: ['docker', 'container', 'start', 'abc123'],
      exitCode: 125,
      stdout: 'out',
    });
  });

  it('treats a timed-out command as a failure even with exit code 0', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: 0, timedOut: true });

    await expect(new DockerContainerRuntime({ executor }).pullImage('node:24')).rejects.toThrow(
      'Failed to pull Docker image node:24: docker image pull node:24 failed (timed out)',
    );
  });

  it('returns timed-out and failing exec results instead of throwing', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: null, timedOut: true, cwd: '/host' });

    const result = await new DockerContainerRuntime({ executor }).exec({
      containerId: 'abc123',
      command: ['sleep', '9'],
    });

    expect(result).toEqual({
      binary: 'docker',
      args: ['container', 'exec', 'abc123', 'sleep', '9'],
      command: ['docker', 'container', 'exec', 'abc123', 'sleep', '9'],
      cwd: '/host',
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      durationMs: 1,
      timedOut: true,
      containerId: 'abc123',
    });
    expect(executor.calls[0]?.options).toEqual({});
  });

  it('does not mistake output of the exec-ed command for a missing container', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ exitCode: 1, stdout: 'No such container', stderr: 'grep: No such object found' });

    const result = await new DockerContainerRuntime({ executor }).exec({
      containerId: 'abc123',
      command: ['./check.sh'],
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('No such container');
  });

  it('passes the abort signal and output limit through to the executor', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue();
    const controller = new AbortController();

    await new DockerContainerRuntime({ executor }).exec({
      containerId: 'abc123',
      command: ['pwd'],
      signal: controller.signal,
      maxOutputBytes: 1024,
    });

    expect(executor.calls[0]?.options).toEqual({ signal: controller.signal, maxOutputBytes: 1024 });
  });

  it('inspects listed containers in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const executor: CommandExecutor = {
      async run(
        binary: string,
        args: readonly string[],
        _options?: CommandExecutionOptions,
      ): Promise<CommandExecutionResult> {
        const base = {
          binary,
          args,
          command: [binary, ...args],
          cwd: '/host',
          exitCode: 0,
          signal: null,
          stderr: '',
          durationMs: 1,
          timedOut: false,
        };
        if (args[1] === 'ls') {
          return { ...base, stdout: ['c1', 'c2', 'c3'].map((id) => JSON.stringify({ ID: id })).join('\n') };
        }
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { ...base, stdout: JSON.stringify([{ Id: args.at(-1) }]) };
      },
    };

    const containers = await new DockerContainerRuntime({ executor }).listContainers();

    expect(containers.map((container) => container.id)).toEqual(['c1', 'c2', 'c3']);
    expect(maxInFlight).toBe(3);
  });

  it('propagates inspection failures other than not-found from listContainers', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: JSON.stringify({ ID: 'c1' }) });
    executor.enqueue({ exitCode: 125, stderr: 'daemon exploded' });

    await expect(new DockerContainerRuntime({ executor }).listContainers()).rejects.toThrow(
      'Failed to inspect container c1: docker container inspect c1 failed (exit code 125)',
    );
  });

  it('uses a custom executable and resolves relative workspace paths', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'abc123\n' });

    const runtime = new DockerContainerRuntime({ executor, executable: 'podman' });
    const handle = await runtime.createContainer({
      image: 'node:24',
      workspacePath: 'relative/repo',
      name: 'container-1',
    });

    expect(runtime.kind).toBe('docker');
    expect(executor.calls[0]?.binary).toBe('podman');
    expect(handle).toEqual({
      id: 'abc123',
      image: 'node:24',
      workspacePath: path.resolve('relative/repo'),
      workspaceMountPath: '/workspace',
      state: 'created',
      name: 'container-1',
    });
  });

  it('reports an empty create output as a parse error', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: '  ' });

    await expect(
      new DockerContainerRuntime({ executor }).createContainer({ image: 'node:24', workspacePath: '/tmp/repo' }),
    ).rejects.toBeInstanceOf(ContainerParseError);
  });

  it('returns false from isAvailable when docker info is not JSON', async () => {
    const executor = new RecordingCommandExecutor();
    executor.enqueue({ stdout: 'not json' });

    await expect(new DockerContainerRuntime({ executor }).isAvailable()).resolves.toBe(false);
  });

  it('rethrows executor errors that are not CommandExecutionError unchanged', async () => {
    const executor = new RecordingCommandExecutor();
    const failure = new Error('executor bug');
    executor.enqueueError(failure);

    await expect(new DockerContainerRuntime({ executor }).pullImage('node:24')).rejects.toBe(failure);
  });

  it('spawns the real CLI through the default executor', async () => {
    const runtime = new DockerContainerRuntime({ executable: 'binary-that-does-not-exist-123' });

    await expect(runtime.isAvailable()).resolves.toBe(false);
    const error: unknown = await runtime.pullImage('node:24').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error).toMatchObject({
      message: 'Failed to execute command: binary-that-does-not-exist-123',
      binary: 'binary-that-does-not-exist-123',
      args: ['image', 'pull', 'node:24'],
    });
  });
});
