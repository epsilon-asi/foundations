import { describe, expect, it } from 'vitest';
import {
  AbstractContainerRuntime,
  ContainerHealthTimeoutError,
  DEFAULT_CONTAINER_WORKSPACE_PATH,
  ContainerNotFoundError,
  ContainerUnhealthyError,
  ImageUnavailableError,
  ContainerCleanupError,
} from '../../src/container-runtime/index.js';
import type {
  ContainerCopyOptions,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerFilesystemChange,
  ContainerInspection,
  ContainerLogsOptions,
  ContainerRemoveOptions,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerWaitResult,
  ListContainersOptions,
} from '../../src/container-runtime/index.js';

class FakeRuntime extends AbstractContainerRuntime {
  override readonly kind = 'fake';

  constructor() {
    super();
  }

  readonly calls: string[] = [];
  readonly removeOptions: (ContainerRemoveOptions | undefined)[] = [];
  imageExistsValue = true;
  startError: Error | undefined;
  lastCreateOptions: ContainerCreateOptions | undefined;
  lastListOptions: ListContainersOptions | undefined;
  logsValue = 'container logs';
  diffValue: ContainerFilesystemChange[] = [{ kind: 'C', path: '/workspace/changed.txt' }];
  inspectValue: ContainerInspection = {
    id: 'container-1',
    image: 'node:24.15.0',
    mounts: [],
    labels: {},
    state: {
      status: 'running',
      running: true,
      health: 'healthy',
    },
    raw: {},
  };

  private readonly inspectQueue: (ContainerInspection | Error)[] = [];
  private readonly execQueue: ContainerExecResult[] = [];
  private readonly stopErrors: Error[] = [];
  private readonly removeErrors: Error[] = [];

  queueInspection(value: ContainerInspection | Error): void {
    this.inspectQueue.push(value);
  }

  queueExecResult(value: Partial<ContainerExecResult>): void {
    this.execQueue.push({
      binary: 'fake',
      args: value.args ?? [],
      command: value.command ?? ['fake'],
      cwd: value.cwd ?? '/',
      exitCode: value.exitCode ?? 0,
      signal: value.signal ?? null,
      stdout: value.stdout ?? '',
      stderr: value.stderr ?? '',
      durationMs: value.durationMs ?? 1,
      timedOut: value.timedOut ?? false,
      containerId: value.containerId ?? 'container-1',
    });
  }

  queueStopError(error: Error): void {
    this.stopErrors.push(error);
  }

  queueRemoveError(error: Error): void {
    this.removeErrors.push(error);
  }

  override async isAvailable(): Promise<boolean> {
    return true;
  }

  override async imageExists(image: string): Promise<boolean> {
    this.calls.push(`imageExists:${image}`);
    return this.imageExistsValue;
  }

  override async pullImage(image: string): Promise<void> {
    this.calls.push(`pullImage:${image}`);
  }

  override async createContainer(options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.calls.push(`create:${options.image}`);
    this.lastCreateOptions = options;
    return {
      id: 'container-1',
      image: options.image,
      workspacePath: options.workspacePath,
      workspaceMountPath: options.workspaceMountPath ?? DEFAULT_CONTAINER_WORKSPACE_PATH,
      state: 'created',
      ...(options.name !== undefined ? { name: options.name } : {}),
    };
  }

  override async startContainer(containerId: string): Promise<void> {
    this.calls.push(`start:${containerId}`);
    if (this.startError !== undefined) {
      throw this.startError;
    }
  }

  override async stopContainer(containerId: string): Promise<void> {
    this.calls.push(`stop:${containerId}`);

    const error = this.stopErrors.shift();
    if (error !== undefined) {
      throw error;
    }
  }

  override async removeContainer(containerId: string, options?: ContainerRemoveOptions): Promise<void> {
    this.calls.push(`remove:${containerId}`);
    this.removeOptions.push(options);

    const error = this.removeErrors.shift();
    if (error !== undefined) {
      throw error;
    }
  }

  override async inspectContainer(containerId: string): Promise<ContainerInspection> {
    this.calls.push(`inspect:${containerId}`);

    const queued = this.inspectQueue.shift();
    if (queued instanceof Error) {
      throw queued;
    }
    if (queued !== undefined) {
      return queued;
    }

    return this.inspectValue;
  }

  override async listContainers(options?: ListContainersOptions): Promise<ContainerInspection[]> {
    this.calls.push('list');
    this.lastListOptions = options;
    return [this.inspectValue];
  }

  override async exec(options: ContainerExecOptions): Promise<ContainerExecResult> {
    this.calls.push(`exec:${options.command.join(' ')}`);

    const queued = this.execQueue.shift();
    if (queued !== undefined) {
      return {
        ...queued,
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        containerId: options.containerId,
      };
    }

    return {
      binary: 'fake',
      args: [...options.command],
      command: ['fake', ...options.command],
      cwd: options.cwd ?? '/',
      exitCode: 0,
      signal: null,
      stdout: options.command.join(' '),
      stderr: '',
      durationMs: 1,
      timedOut: false,
      containerId: options.containerId,
    };
  }

  override async getLogs(containerId: string, _options?: ContainerLogsOptions): Promise<string> {
    this.calls.push(`logs:${containerId}`);
    return this.logsValue;
  }

  override async waitForExit(containerId: string): Promise<ContainerWaitResult> {
    this.calls.push(`wait:${containerId}`);
    return {
      containerId,
      exitCode: 0,
    };
  }

  override async copyToContainer(_options: ContainerCopyOptions): Promise<void> {
    this.calls.push('copyTo');
  }

  override async copyFromContainer(_options: ContainerCopyOptions): Promise<void> {
    this.calls.push('copyFrom');
  }

  override async diffContainer(containerId: string): Promise<ContainerFilesystemChange[]> {
    this.calls.push(`diff:${containerId}`);
    return this.diffValue;
  }

  override async pauseContainer(containerId: string): Promise<void> {
    this.calls.push(`pause:${containerId}`);
  }

  override async unpauseContainer(containerId: string): Promise<void> {
    this.calls.push(`unpause:${containerId}`);
  }

  override async killContainer(containerId: string): Promise<void> {
    this.calls.push(`kill:${containerId}`);
  }
}

describe('AbstractContainerRuntime', () => {
  it('pulls missing images when pullPolicy=missing', async () => {
    const runtime = new FakeRuntime();
    runtime.imageExistsValue = false;

    await runtime.ensureImage('node:24.15.0', 'missing');

    expect(runtime.calls).toEqual(['imageExists:node:24.15.0', 'pullImage:node:24.15.0']);
  });

  it('pulls without checking local presence when pullPolicy=always', async () => {
    const runtime = new FakeRuntime();

    await runtime.ensureImage('node:24.15.0', 'always');

    expect(runtime.calls).toEqual(['pullImage:node:24.15.0']);
  });

  it('throws ImageUnavailableError when pullPolicy=never and the image is missing', async () => {
    const runtime = new FakeRuntime();
    runtime.imageExistsValue = false;

    await expect(runtime.ensureImage('node:24.15.0', 'never')).rejects.toBeInstanceOf(ImageUnavailableError);
  });

  it('creates and starts a container with deterministic ordering', async () => {
    const runtime = new FakeRuntime();
    const handle = await runtime.createStartedContainer({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      workspaceMountPath: '/workspace',
    });

    expect(handle).toMatchObject({
      id: 'container-1',
      image: 'node:24.15.0',
      workspaceMountPath: '/workspace',
      state: 'running',
    });
    expect(runtime.calls).toEqual(['imageExists:node:24.15.0', 'create:node:24.15.0', 'start:container-1']);
  });

  it('creates coding-agent containers through the shared profile helper', async () => {
    const runtime = new FakeRuntime();

    const handle = await runtime.createCodingAgentContainer({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      secureDefaults: true,
    });

    expect(handle.workspaceMountPath).toBe('/workspace');
    expect(runtime.lastCreateOptions).toMatchObject({
      workspaceMountPath: '/workspace',
      workdir: '/workspace',
      init: true,
      pullPolicy: 'missing',
      labels: {
        'sandbox.kind': 'coding-agent',
        'sandbox.profile': 'general',
        'sandbox.security-profile': 'secure-readonly',
      },
      env: {
        CI: '1',
      },
      security: {
        network: 'none',
        readOnlyRootFilesystem: true,
      },
      command: ['sleep', 'infinity'],
    });
  });

  it('reports container existence by translating not-found inspections', async () => {
    const runtime = new FakeRuntime();
    runtime.queueInspection(new ContainerNotFoundError('container-1'));

    await expect(runtime.containerExists('container-1')).resolves.toBe(false);
    await expect(runtime.containerExists('container-2')).resolves.toBe(true);
  });

  it('reports whether a container is running from inspection state', async () => {
    const runtime = new FakeRuntime();

    await expect(runtime.isContainerRunning('container-1')).resolves.toBe(true);

    runtime.inspectValue = {
      ...runtime.inspectValue,
      state: {
        ...runtime.inspectValue.state,
        running: false,
      },
    };

    await expect(runtime.isContainerRunning('container-1')).resolves.toBe(false);
  });

  it('lists coding-agent containers with the expected label filter', async () => {
    const runtime = new FakeRuntime();

    const containers = await runtime.listCodingAgentContainers();

    expect(containers).toHaveLength(1);
    expect(runtime.lastListOptions).toEqual({
      all: true,
      filters: {
        label: 'sandbox.kind=coding-agent',
      },
    });
  });

  it('execs directly inside the workspace mount', async () => {
    const runtime = new FakeRuntime();

    const result = await runtime.execInWorkspace(
      { id: 'container-1', workspaceMountPath: '/workspace' },
      ['npm', 'test'],
      {
        env: {
          CI: '1',
        },
      },
    );

    expect(result).toMatchObject({
      containerId: 'container-1',
      cwd: '/workspace',
      stdout: 'npm test',
    });
    expect(runtime.calls).toEqual(['exec:npm test']);
  });

  it('wraps shell commands via /bin/sh -lc in the workspace', async () => {
    const runtime = new FakeRuntime();

    await runtime.execShellInWorkspace(
      { id: 'container-1', workspaceMountPath: '/workspace' },
      'npm test && npm run build',
    );

    expect(runtime.calls).toEqual(['exec:/bin/sh -lc npm test && npm run build']);
  });

  it('configures git safe.directory for the workspace path', async () => {
    const runtime = new FakeRuntime();

    await runtime.configureGitSafeDirectory({ id: 'container-1', workspaceMountPath: '/workspace' });

    expect(runtime.calls).toEqual(['exec:git config --global --add safe.directory /workspace']);
  });

  it('short-circuits command sequences after a non-zero or timed-out command', async () => {
    const runtime = new FakeRuntime();
    runtime.queueExecResult({
      exitCode: 0,
      command: ['fake', 'npm', 'ci'],
      args: ['npm', 'ci'],
      stdout: 'installed',
    });
    runtime.queueExecResult({
      exitCode: 124,
      command: ['fake', 'npm', 'test'],
      args: ['npm', 'test'],
      stdout: '',
      stderr: 'timed out',
      timedOut: true,
    });

    const results = await runtime.runCommandSequence({ id: 'container-1' }, [
      { command: ['npm', 'ci'] },
      { command: ['npm', 'test'] },
      { command: ['npm', 'run', 'build'] },
    ]);

    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({
      exitCode: 124,
      timedOut: true,
    });
    expect(runtime.calls).toEqual(['exec:npm ci', 'exec:npm test']);
  });

  it('waits until a container becomes healthy', async () => {
    const runtime = new FakeRuntime();
    runtime.queueInspection({
      ...runtime.inspectValue,
      state: {
        status: 'running',
        running: true,
        health: 'starting',
      },
    });
    runtime.queueInspection(runtime.inspectValue);

    const inspection = await runtime.waitForHealthy('container-1', {
      timeoutMs: 100,
      pollIntervalMs: 1,
    });

    expect(inspection.state?.health).toBe('healthy');
    expect(runtime.calls).toEqual(['inspect:container-1', 'inspect:container-1']);
  });

  it('throws when a container becomes unhealthy', async () => {
    const runtime = new FakeRuntime();
    runtime.queueInspection({
      ...runtime.inspectValue,
      state: {
        status: 'running',
        running: true,
        health: 'unhealthy',
      },
    });

    await expect(
      runtime.waitForHealthy('container-1', {
        timeoutMs: 20,
        pollIntervalMs: 1,
      }),
    ).rejects.toBeInstanceOf(ContainerUnhealthyError);
  });

  it('returns immediately when no healthcheck is present and that behavior is allowed', async () => {
    const runtime = new FakeRuntime();
    runtime.queueInspection({
      ...runtime.inspectValue,
      state: {
        status: 'running',
        running: true,
        health: null,
      },
    });

    const inspection = await runtime.waitForHealthy('container-1', {
      treatMissingHealthcheckAsSuccess: true,
      timeoutMs: 20,
      pollIntervalMs: 1,
    });

    expect(inspection.state?.health).toBeNull();
  });

  it('times out when no healthcheck is present and the caller requires one', async () => {
    const runtime = new FakeRuntime();
    runtime.inspectValue = {
      ...runtime.inspectValue,
      state: {
        status: 'running',
        running: true,
        health: null,
      },
    };

    await expect(
      runtime.waitForHealthy('container-1', {
        treatMissingHealthcheckAsSuccess: false,
        timeoutMs: 10,
        pollIntervalMs: 1,
      }),
    ).rejects.toBeInstanceOf(ContainerHealthTimeoutError);
  });

  it('captures a snapshot from inspect, logs, and diff', async () => {
    const runtime = new FakeRuntime();

    const snapshot = await runtime.captureContainerSnapshot('container-1');

    expect(snapshot).toEqual({
      inspection: runtime.inspectValue,
      logs: 'container logs',
      filesystemChanges: [{ kind: 'C', path: '/workspace/changed.txt' }],
    });
    expect(runtime.calls).toEqual(['inspect:container-1', 'logs:container-1', 'diff:container-1']);
  });

  it('cleans up successful withContainer calls by stopping then removing', async () => {
    const runtime = new FakeRuntime();

    const value = await runtime.withContainer(
      {
        image: 'node:24.15.0',
        workspacePath: '/tmp/repo',
      },
      async (handle: ContainerHandle) => handle.id,
    );

    expect(value).toBe('container-1');
    expect(runtime.calls).toEqual([
      'imageExists:node:24.15.0',
      'create:node:24.15.0',
      'start:container-1',
      'stop:container-1',
      'remove:container-1',
    ]);
  });

  it('ignores not-found cleanup races', async () => {
    const runtime = new FakeRuntime();
    runtime.queueStopError(new ContainerNotFoundError('container-1'));
    runtime.queueRemoveError(new ContainerNotFoundError('container-1'));

    await expect(
      runtime.withContainer(
        {
          image: 'node:24.15.0',
          workspacePath: '/tmp/repo',
        },
        async () => 'ok',
      ),
    ).resolves.toBe('ok');
  });

  it('does not let cleanup failures mask the primary work failure', async () => {
    const runtime = new FakeRuntime();
    runtime.queueStopError(new Error('stop failed'));
    runtime.queueRemoveError(new Error('remove failed'));

    await expect(
      runtime.withContainer(
        {
          image: 'node:24.15.0',
          workspacePath: '/tmp/repo',
        },
        async () => {
          throw new Error('work failed');
        },
      ),
    ).rejects.toThrow('work failed');
  });

  it('raises ContainerCleanupError when work succeeds but cleanup fails', async () => {
    const runtime = new FakeRuntime();
    runtime.queueStopError(new Error('stop failed'));
    runtime.queueRemoveError(new Error('remove failed'));

    try {
      await runtime.withContainer(
        {
          image: 'node:24.15.0',
          workspacePath: '/tmp/repo',
        },
        async () => 'done',
      );
      throw new Error('expected withContainer to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ContainerCleanupError);
      expect(error).toMatchObject({
        containerId: 'container-1',
      });

      const cleanupError = error as ContainerCleanupError;
      expect(cleanupError.cleanupErrors).toHaveLength(2);
      expect(
        cleanupError.cleanupErrors.map((entry) => (entry instanceof Error ? entry.message : String(entry))),
      ).toEqual(['stop failed', 'remove failed']);
    }
  });

  it('runInContainer returns the handle and exec result', async () => {
    const runtime = new FakeRuntime();

    const result = await runtime.runInContainer({
      container: {
        image: 'node:24.15.0',
        workspacePath: '/tmp/repo',
      },
      exec: {
        command: ['npm', 'test'],
      },
    });

    expect(result.handle).toMatchObject({
      id: 'container-1',
      state: 'running',
    });
    expect(result.exec).toMatchObject({
      containerId: 'container-1',
      stdout: 'npm test',
    });
  });

  it('skips pulling when the image is already present under missing and never policies', async () => {
    const runtime = new FakeRuntime();

    await runtime.ensureImage('node:24.15.0');
    await runtime.ensureImage('node:24.15.0', 'never');

    expect(runtime.calls).toEqual(['imageExists:node:24.15.0', 'imageExists:node:24.15.0']);
  });

  it('honours the pull policy from the create options', async () => {
    const runtime = new FakeRuntime();

    await runtime.createStartedContainer({ image: 'node:24.15.0', workspacePath: '/tmp/repo', pullPolicy: 'always' });

    expect(runtime.calls).toEqual(['pullImage:node:24.15.0', 'create:node:24.15.0', 'start:container-1']);
  });

  it('force-removes a created container that fails to start and rethrows the start error', async () => {
    const runtime = new FakeRuntime();
    runtime.startError = new Error('start failed');

    await expect(runtime.createStartedContainer({ image: 'node:24.15.0', workspacePath: '/tmp/repo' })).rejects.toThrow(
      'start failed',
    );
    expect(runtime.calls).toEqual([
      'imageExists:node:24.15.0',
      'create:node:24.15.0',
      'start:container-1',
      'remove:container-1',
    ]);
    expect(runtime.removeOptions).toEqual([{ force: true }]);
  });

  it('rethrows non-not-found inspection errors from containerExists', async () => {
    const runtime = new FakeRuntime();
    runtime.queueInspection(new Error('daemon down'));

    await expect(runtime.containerExists('container-1')).rejects.toThrow('daemon down');
  });

  it('applies default health polling options', async () => {
    const runtime = new FakeRuntime();

    await expect(runtime.waitForHealthy('container-1')).resolves.toBe(runtime.inspectValue);
  });

  it('removes with force by default and passes explicit cleanup options through', async () => {
    const runtime = new FakeRuntime();
    const options = { image: 'node:24.15.0', workspacePath: '/tmp/repo' };

    await runtime.withContainer(options, async () => 'default');
    await runtime.withContainer(options, async () => 'custom', { stop: false, force: false, volumes: true });

    expect(runtime.removeOptions).toEqual([{ force: true }, { force: false, volumes: true }]);
    expect(runtime.calls.filter((call) => call.startsWith('stop'))).toEqual(['stop:container-1']);
  });

  it('skips removal when cleanup.remove is false', async () => {
    const runtime = new FakeRuntime();

    await runtime.withContainer({ image: 'node:24.15.0', workspacePath: '/tmp/repo' }, async () => 'kept', {
      remove: false,
    });

    expect(runtime.calls.at(-1)).toBe('stop:container-1');
  });

  it('treats a work function that throws undefined as a failure and still cleans up', async () => {
    const runtime = new FakeRuntime();
    let settled: { status: 'fulfilled' | 'rejected'; value: unknown } | undefined;

    await runtime
      .withContainer({ image: 'node:24.15.0', workspacePath: '/tmp/repo' }, async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- the bug being guarded against
        throw undefined;
      })
      .then(
        (value) => (settled = { status: 'fulfilled', value }),
        (reason: unknown) => (settled = { status: 'rejected', value: reason }),
      );

    expect(settled).toEqual({ status: 'rejected', value: undefined });
    expect(runtime.calls.slice(-2)).toEqual(['stop:container-1', 'remove:container-1']);
  });

  it('runInContainer applies the provided cleanup options', async () => {
    const runtime = new FakeRuntime();

    await runtime.runInContainer({
      container: { image: 'node:24.15.0', workspacePath: '/tmp/repo' },
      exec: { command: ['true'] },
      cleanup: { stop: false, remove: true },
    });

    expect(runtime.calls.slice(-2)).toEqual(['exec:true', 'remove:container-1']);
    expect(runtime.removeOptions).toEqual([{}]);
  });
});
