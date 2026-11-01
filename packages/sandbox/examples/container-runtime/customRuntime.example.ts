import { AbstractContainerRuntime, DEFAULT_CONTAINER_WORKSPACE_PATH } from '../../src/container-runtime/index.js';
import type {
  ContainerCopyOptions,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerFilesystemChange,
  ContainerInspection,
  ContainerLogsOptions,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerWaitResult,
  ListContainersOptions,
} from '../../src/container-runtime/index.js';

/**
 * A backend that only records what it was asked to do. Real backends implement the same primitives against their
 * API; every workflow helper (`createCodingAgentContainer`, `execInWorkspace`, `withContainer`, ...) is inherited.
 */
export class RecordingExampleRuntime extends AbstractContainerRuntime {
  override readonly kind = 'recording-example';

  readonly events: string[] = [];

  override async isAvailable(): Promise<boolean> {
    return true;
  }

  override async imageExists(image: string): Promise<boolean> {
    this.events.push(`imageExists:${image}`);
    return true;
  }

  override async pullImage(image: string): Promise<void> {
    this.events.push(`pullImage:${image}`);
  }

  override async createContainer(options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.events.push(`create:${options.image}`);
    return {
      id: 'recording-1',
      image: options.image,
      workspacePath: options.workspacePath,
      workspaceMountPath: options.workspaceMountPath ?? DEFAULT_CONTAINER_WORKSPACE_PATH,
      state: 'created',
      ...(options.name !== undefined ? { name: options.name } : {}),
    };
  }

  override async startContainer(containerId: string): Promise<void> {
    this.events.push(`start:${containerId}`);
  }

  override async stopContainer(containerId: string): Promise<void> {
    this.events.push(`stop:${containerId}`);
  }

  override async removeContainer(containerId: string): Promise<void> {
    this.events.push(`remove:${containerId}`);
  }

  override async inspectContainer(containerId: string): Promise<ContainerInspection> {
    return {
      id: containerId,
      mounts: [],
      labels: {},
      state: {
        status: 'running',
        running: true,
      },
      raw: {},
    };
  }

  override async listContainers(_options?: ListContainersOptions): Promise<ContainerInspection[]> {
    return [];
  }

  override async exec(options: ContainerExecOptions): Promise<ContainerExecResult> {
    this.events.push(`exec:${options.command.join(' ')}`);
    return {
      binary: 'recording-example',
      args: [...options.command],
      command: ['recording-example', ...options.command],
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

  override async getLogs(_containerId: string, _options?: ContainerLogsOptions): Promise<string> {
    return '';
  }

  override async waitForExit(containerId: string): Promise<ContainerWaitResult> {
    return {
      containerId,
      exitCode: 0,
    };
  }

  override async copyToContainer(options: ContainerCopyOptions): Promise<void> {
    this.events.push(`copyTo:${options.containerId}:${options.targetPath}`);
  }

  override async copyFromContainer(options: ContainerCopyOptions): Promise<void> {
    this.events.push(`copyFrom:${options.containerId}:${options.sourcePath}`);
  }

  override async diffContainer(_containerId: string): Promise<ContainerFilesystemChange[]> {
    return [];
  }

  override async pauseContainer(containerId: string): Promise<void> {
    this.events.push(`pause:${containerId}`);
  }

  override async unpauseContainer(containerId: string): Promise<void> {
    this.events.push(`unpause:${containerId}`);
  }

  override async killContainer(containerId: string): Promise<void> {
    this.events.push(`kill:${containerId}`);
  }
}

/** Runs a scoped container workflow on the custom backend and returns what the backend was asked to do. */
export async function runCustomRuntimeExample(): Promise<string[]> {
  const runtime = new RecordingExampleRuntime();

  await runtime.withContainer({ image: 'node:24.15.0', workspacePath: '/tmp/example-repo' }, async (handle) => {
    await runtime.execInWorkspace(handle, ['npm', 'test']);
  });

  return runtime.events;
}
