import { setTimeout as delay } from 'node:timers/promises';

import { isSuccessfulResult } from '../shared/index.js';
import { omitUndefined } from '../shared/objects.js';
import { buildCodingAgentContainerOptions } from './codingAgentProfiles.js';
import {
  CODING_AGENT_CONTAINER_KIND,
  CONTAINER_LABELS,
  DEFAULT_CONTAINER_CLEANUP,
  DEFAULT_IMAGE_PULL_POLICY,
} from './defaults.js';
import {
  ContainerCleanupError,
  ContainerHealthTimeoutError,
  ContainerNotFoundError,
  ContainerUnhealthyError,
  ImageUnavailableError,
} from './errors.js';
import type {
  CodingAgentContainerOptions,
  ContainerCleanupOptions,
  ContainerCommand,
  ContainerCopyOptions,
  ContainerCreateOptions,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerFilesystemChange,
  ContainerHandle,
  ContainerInspection,
  ContainerLogsOptions,
  ContainerRemoveOptions,
  ContainerSnapshot,
  ContainerStopOptions,
  ContainerWaitResult,
  ImagePullPolicy,
  ListContainersOptions,
  RunInContainerOptions,
  RunInContainerResult,
  WaitForHealthyOptions,
  WorkspaceExecOptions,
  WorkspaceHandle,
} from './types.js';

const DEFAULT_WAIT_FOR_HEALTHY: Required<WaitForHealthyOptions> = {
  timeoutMs: 30_000,
  pollIntervalMs: 500,
  treatMissingHealthcheckAsSuccess: true,
};

/** Number of trailing log lines included in a container snapshot. */
const SNAPSHOT_LOG_TAIL_LINES = 500;

/**
 * Backend-agnostic container runtime. Subclasses implement the container primitives (create, exec, inspect, ...);
 * this class composes them into workflows (image policy, workspace exec, health waits, scoped cleanup).
 *
 * Contract for implementations: operations on a container that does not exist must reject with
 * `ContainerNotFoundError`; `exec` reports non-zero exit codes in its result instead of throwing.
 */
export abstract class AbstractContainerRuntime<TInspection extends ContainerInspection = ContainerInspection> {
  /** Backend identifier, e.g. `docker`. */
  abstract readonly kind: string;

  abstract isAvailable(): Promise<boolean>;
  abstract imageExists(image: string): Promise<boolean>;
  abstract pullImage(image: string): Promise<void>;
  abstract createContainer(options: ContainerCreateOptions): Promise<ContainerHandle>;
  abstract startContainer(containerId: string): Promise<void>;
  abstract stopContainer(containerId: string, options?: ContainerStopOptions): Promise<void>;
  abstract removeContainer(containerId: string, options?: ContainerRemoveOptions): Promise<void>;
  abstract inspectContainer(containerId: string): Promise<TInspection>;
  abstract listContainers(options?: ListContainersOptions): Promise<TInspection[]>;
  abstract exec(options: ContainerExecOptions): Promise<ContainerExecResult>;
  abstract getLogs(containerId: string, options?: ContainerLogsOptions): Promise<string>;
  abstract waitForExit(containerId: string): Promise<ContainerWaitResult>;
  abstract copyToContainer(options: ContainerCopyOptions): Promise<void>;
  abstract copyFromContainer(options: ContainerCopyOptions): Promise<void>;
  abstract diffContainer(containerId: string): Promise<ContainerFilesystemChange[]>;
  abstract pauseContainer(containerId: string): Promise<void>;
  abstract unpauseContainer(containerId: string): Promise<void>;
  abstract killContainer(containerId: string, signal?: string): Promise<void>;

  /** Makes `image` available locally according to `pullPolicy`; throws `ImageUnavailableError` under `never`. */
  async ensureImage(image: string, pullPolicy: ImagePullPolicy = DEFAULT_IMAGE_PULL_POLICY): Promise<void> {
    if (pullPolicy !== 'always' && (await this.imageExists(image))) {
      return;
    }
    if (pullPolicy === 'never') {
      throw new ImageUnavailableError(image);
    }
    await this.pullImage(image);
  }

  /** Ensures the image, creates and starts the container. A container that fails to start is removed. */
  async createStartedContainer(options: ContainerCreateOptions): Promise<ContainerHandle> {
    await this.ensureImage(options.image, options.pullPolicy);

    const handle = await this.createContainer(options);
    try {
      await this.startContainer(handle.id);
    } catch (error: unknown) {
      await this.cleanupContainer(handle.id, { ...DEFAULT_CONTAINER_CLEANUP, stop: false });
      throw error;
    }

    return { ...handle, state: 'running' };
  }

  /** `createStartedContainer` with `buildCodingAgentContainerOptions` applied. */
  async createCodingAgentContainer(options: CodingAgentContainerOptions): Promise<ContainerHandle> {
    return await this.createStartedContainer(buildCodingAgentContainerOptions(options));
  }

  async containerExists(containerId: string): Promise<boolean> {
    return (await this.inspectContainerIfExists(containerId)) !== undefined;
  }

  async isContainerRunning(containerId: string): Promise<boolean> {
    const inspection = await this.inspectContainer(containerId);
    return inspection.state?.running === true;
  }

  /** Lists every container (running or not) labelled as a coding-agent container. */
  async listCodingAgentContainers(): Promise<TInspection[]> {
    return await this.listContainers({
      all: true,
      filters: { label: `${CONTAINER_LABELS.kind}=${CODING_AGENT_CONTAINER_KIND}` },
    });
  }

  /** Runs `command` with the workspace mount as working directory. */
  async execInWorkspace(
    handle: WorkspaceHandle,
    command: readonly string[],
    options: WorkspaceExecOptions = {},
  ): Promise<ContainerExecResult> {
    return await this.exec({ ...options, containerId: handle.id, command, cwd: handle.workspaceMountPath });
  }

  /** Runs a shell snippet via `/bin/sh -lc` in the workspace. */
  async execShellInWorkspace(
    handle: WorkspaceHandle,
    shellCommand: string,
    options: WorkspaceExecOptions = {},
  ): Promise<ContainerExecResult> {
    return await this.execInWorkspace(handle, ['/bin/sh', '-lc', shellCommand], options);
  }

  /** Marks the workspace as a git `safe.directory` so git accepts a bind mount owned by another uid. */
  async configureGitSafeDirectory(handle: WorkspaceHandle): Promise<ContainerExecResult> {
    return await this.execInWorkspace(handle, [
      'git',
      'config',
      '--global',
      '--add',
      'safe.directory',
      handle.workspaceMountPath,
    ]);
  }

  /** Runs commands in order and stops after the first one that fails or times out (its result is included). */
  async runCommandSequence(
    handle: Pick<ContainerHandle, 'id'>,
    commands: readonly ContainerCommand[],
  ): Promise<ContainerExecResult[]> {
    const results: ContainerExecResult[] = [];
    for (const command of commands) {
      const result = await this.exec({ ...command, containerId: handle.id });
      results.push(result);
      if (!isSuccessfulResult(result)) {
        break;
      }
    }
    return results;
  }

  /** Polls inspection until the healthcheck reports `healthy`; throws on `unhealthy` or timeout. */
  async waitForHealthy(containerId: string, options: WaitForHealthyOptions = {}): Promise<TInspection> {
    const { timeoutMs, pollIntervalMs, treatMissingHealthcheckAsSuccess } = { ...DEFAULT_WAIT_FOR_HEALTHY, ...options };
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const inspection = await this.inspectContainer(containerId);
      const health = inspection.state?.health;

      if (health === 'healthy' || ((health === null || health === undefined) && treatMissingHealthcheckAsSuccess)) {
        return inspection;
      }
      if (health === 'unhealthy') {
        throw new ContainerUnhealthyError(containerId);
      }
      if (Date.now() >= deadline) {
        throw new ContainerHealthTimeoutError(containerId, timeoutMs);
      }
      await delay(pollIntervalMs);
    }
  }

  /** Collects inspection, the last log lines and filesystem changes in parallel. */
  async captureContainerSnapshot(containerId: string): Promise<ContainerSnapshot<TInspection>> {
    const [inspection, logs, filesystemChanges] = await Promise.all([
      this.inspectContainer(containerId),
      this.getLogs(containerId, { tail: SNAPSHOT_LOG_TAIL_LINES }),
      this.diffContainer(containerId),
    ]);
    return { inspection, logs, filesystemChanges };
  }

  /**
   * Creates and starts a container, runs `work`, then cleans up. A failure from `work` always wins; cleanup failures
   * surface as `ContainerCleanupError` only when `work` succeeded. Containers that are already gone are not an error.
   */
  async withContainer<T>(
    options: ContainerCreateOptions,
    work: (handle: ContainerHandle) => Promise<T>,
    cleanup: ContainerCleanupOptions = DEFAULT_CONTAINER_CLEANUP,
  ): Promise<T> {
    const handle = await this.createStartedContainer(options);

    let result: T;
    try {
      result = await work(handle);
    } catch (error: unknown) {
      await this.cleanupContainer(handle.id, cleanup);
      throw error;
    }

    const cleanupErrors = await this.cleanupContainer(handle.id, cleanup);
    if (cleanupErrors.length > 0) {
      throw new ContainerCleanupError(handle.id, cleanupErrors);
    }
    return result;
  }

  /** Runs a single command in a fresh container and cleans up afterwards. */
  async runInContainer(options: RunInContainerOptions): Promise<RunInContainerResult> {
    return await this.withContainer(
      options.container,
      async (handle) => ({ handle, exec: await this.exec({ ...options.exec, containerId: handle.id }) }),
      options.cleanup,
    );
  }

  /** Inspects a container, resolving `undefined` instead of rejecting when it does not exist. */
  protected async inspectContainerIfExists(containerId: string): Promise<TInspection | undefined> {
    try {
      return await this.inspectContainer(containerId);
    } catch (error: unknown) {
      if (error instanceof ContainerNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  /** Stops and/or removes a container, returning (not throwing) every failure except "not found". */
  protected async cleanupContainer(containerId: string, cleanup: ContainerCleanupOptions): Promise<unknown[]> {
    const errors: unknown[] = [];
    const attempt = async (step: () => Promise<void>): Promise<void> => {
      try {
        await step();
      } catch (error: unknown) {
        if (!(error instanceof ContainerNotFoundError)) {
          errors.push(error);
        }
      }
    };

    if (cleanup.stop !== false) {
      await attempt(() => this.stopContainer(containerId));
    }
    if (cleanup.remove !== false) {
      const { force, volumes } = cleanup;
      await attempt(() => this.removeContainer(containerId, omitUndefined({ force, volumes })));
    }
    return errors;
  }
}
