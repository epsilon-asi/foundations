import path from 'node:path';

import {
  ChildProcessCommandExecutor,
  ensureSuccess,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type CommandExecutor,
} from '../shared/index.js';
import { omitUndefined } from '../shared/objects.js';
import { AbstractContainerRuntime } from './abstractContainerRuntime.js';
import { DEFAULT_CONTAINER_WORKSPACE_PATH } from './defaults.js';
import {
  buildDockerCopyFromContainerArgs,
  buildDockerCopyToContainerArgs,
  buildDockerCreateArgs,
  buildDockerDiffArgs,
  buildDockerExecArgs,
  buildDockerImageInspectArgs,
  buildDockerInfoArgs,
  buildDockerInspectArgs,
  buildDockerKillArgs,
  buildDockerListArgs,
  buildDockerLogsArgs,
  buildDockerPauseArgs,
  buildDockerPullArgs,
  buildDockerRemoveArgs,
  buildDockerStartArgs,
  buildDockerStopArgs,
  buildDockerUnpauseArgs,
  buildDockerWaitArgs,
} from './dockerCommandBuilder.js';
import {
  parseDockerCreate,
  parseDockerDiff,
  parseDockerInfo,
  parseDockerInspect,
  parseDockerListJsonLines,
  parseDockerWait,
} from './dockerParsing.js';
import { ContainerNotFoundError } from './errors.js';
import type {
  ContainerCopyOptions,
  ContainerCreateOptions,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerFilesystemChange,
  ContainerHandle,
  ContainerInspection,
  ContainerLogsOptions,
  ContainerRemoveOptions,
  ContainerStopOptions,
  ContainerWaitResult,
  DockerContainerRuntimeOptions,
  ListContainersOptions,
} from './types.js';

const DEFAULT_DOCKER_EXECUTABLE = 'docker';
// Only CLI error lines on stderr count, so output from a command run via `exec` is never mistaken for a CLI error.
const CONTAINER_NOT_FOUND_OUTPUT =
  /^Error(?: response from daemon)?: .*(?:no such container|no such object|container .* not found)/im;
const IMAGE_NOT_FOUND_OUTPUT = /^Error(?: response from daemon)?: .*(?:no such image|no such object)/im;

function failedWithOutput(result: CommandExecutionResult, pattern: RegExp): boolean {
  return result.exitCode !== 0 && pattern.test(result.stderr);
}

function assertContainerFound(containerId: string, result: CommandExecutionResult): void {
  if (failedWithOutput(result, CONTAINER_NOT_FOUND_OUTPUT)) {
    throw new ContainerNotFoundError(containerId, result);
  }
}

/**
 * Container runtime backed by the Docker CLI (or any Docker-compatible CLI via `executable`). Every CLI call goes
 * through the injected `CommandExecutor`; commands that must succeed throw `CommandFailedError`, and a CLI that
 * cannot be spawned rejects with `CommandExecutionError`.
 */
export class DockerContainerRuntime extends AbstractContainerRuntime {
  override readonly kind = 'docker';
  protected readonly executor: CommandExecutor;
  protected readonly executable: string;

  constructor(options: DockerContainerRuntimeOptions = {}) {
    super();
    this.executor = options.executor ?? new ChildProcessCommandExecutor();
    this.executable = options.executable ?? DEFAULT_DOCKER_EXECUTABLE;
  }

  /** `true` when the daemon answers `docker info`; never throws. */
  override async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runChecked(buildDockerInfoArgs(), 'Docker is not available');
      parseDockerInfo(result.stdout);
      return true;
    } catch {
      return false;
    }
  }

  override async imageExists(image: string): Promise<boolean> {
    const result = await this.run(buildDockerImageInspectArgs(image));
    if (failedWithOutput(result, IMAGE_NOT_FOUND_OUTPUT)) {
      return false;
    }
    ensureSuccess(result, `Failed to inspect Docker image ${image}`);
    return true;
  }

  override async pullImage(image: string): Promise<void> {
    await this.runChecked(buildDockerPullArgs(image), `Failed to pull Docker image ${image}`);
  }

  /** Resolves `workspacePath` to an absolute host path before creating the container. */
  override async createContainer(options: ContainerCreateOptions): Promise<ContainerHandle> {
    const workspacePath = path.resolve(options.workspacePath);
    const workspaceMountPath = options.workspaceMountPath ?? DEFAULT_CONTAINER_WORKSPACE_PATH;
    const result = await this.runChecked(
      buildDockerCreateArgs({ ...options, workspacePath, workspaceMountPath }),
      `Failed to create container from image ${options.image}`,
    );
    const id = parseDockerCreate(result.stdout);
    return {
      id,
      image: options.image,
      workspacePath,
      workspaceMountPath,
      state: 'created',
      ...omitUndefined({ name: options.name }),
    };
  }

  override async startContainer(containerId: string): Promise<void> {
    await this.runForContainer(containerId, buildDockerStartArgs(containerId), 'Failed to start container');
  }

  override async stopContainer(containerId: string, options: ContainerStopOptions = {}): Promise<void> {
    await this.runForContainer(containerId, buildDockerStopArgs(containerId, options), 'Failed to stop container');
  }

  override async removeContainer(containerId: string, options: ContainerRemoveOptions = {}): Promise<void> {
    await this.runForContainer(containerId, buildDockerRemoveArgs(containerId, options), 'Failed to remove container');
  }

  override async inspectContainer(containerId: string): Promise<ContainerInspection> {
    const result = await this.runForContainer(
      containerId,
      buildDockerInspectArgs(containerId),
      'Failed to inspect container',
    );
    return parseDockerInspect(result.stdout);
  }

  /** Lists matching containers and inspects them in parallel, skipping any that disappear meanwhile. */
  override async listContainers(options: ListContainersOptions = {}): Promise<ContainerInspection[]> {
    const result = await this.runChecked(buildDockerListArgs(options), 'Failed to list containers');
    const inspections = await Promise.all(
      parseDockerListJsonLines(result.stdout).map(({ id }) => this.inspectContainerIfExists(id)),
    );
    return inspections.filter((inspection) => inspection !== undefined);
  }

  /**
   * Runs `docker container exec`. Non-zero exit codes and timeouts are returned in the result; only a missing
   * container is thrown (`ContainerNotFoundError`).
   */
  override async exec(options: ContainerExecOptions): Promise<ContainerExecResult> {
    const { containerId, stdin, timeoutMs, signal, maxOutputBytes } = options;
    const result = await this.run(
      buildDockerExecArgs(options),
      omitUndefined({ stdin, timeoutMs, signal, maxOutputBytes }),
    );
    assertContainerFound(containerId, result);
    return { ...result, containerId };
  }

  override async getLogs(containerId: string, options: ContainerLogsOptions = {}): Promise<string> {
    const args = buildDockerLogsArgs(containerId, options);
    const result = await this.runForContainer(containerId, args, 'Failed to fetch logs for container');
    return result.stdout;
  }

  override async waitForExit(containerId: string): Promise<ContainerWaitResult> {
    const result = await this.runForContainer(
      containerId,
      buildDockerWaitArgs(containerId),
      'Failed to wait for container',
    );
    return { containerId, exitCode: parseDockerWait(result.stdout) };
  }

  override async copyToContainer(options: ContainerCopyOptions): Promise<void> {
    const args = buildDockerCopyToContainerArgs(options);
    await this.runForContainer(options.containerId, args, 'Failed to copy files to container');
  }

  override async copyFromContainer(options: ContainerCopyOptions): Promise<void> {
    const args = buildDockerCopyFromContainerArgs(options);
    await this.runForContainer(options.containerId, args, 'Failed to copy files from container');
  }

  override async diffContainer(containerId: string): Promise<ContainerFilesystemChange[]> {
    const args = buildDockerDiffArgs(containerId);
    const result = await this.runForContainer(containerId, args, 'Failed to diff filesystem of container');
    return parseDockerDiff(result.stdout);
  }

  override async pauseContainer(containerId: string): Promise<void> {
    await this.runForContainer(containerId, buildDockerPauseArgs(containerId), 'Failed to pause container');
  }

  override async unpauseContainer(containerId: string): Promise<void> {
    await this.runForContainer(containerId, buildDockerUnpauseArgs(containerId), 'Failed to unpause container');
  }

  override async killContainer(containerId: string, signal?: string): Promise<void> {
    await this.runForContainer(containerId, buildDockerKillArgs(containerId, signal), 'Failed to kill container');
  }

  /** Runs the CLI. Non-zero exits are returned; spawn failures reject with `CommandExecutionError`. */
  private async run(args: readonly string[], options?: CommandExecutionOptions): Promise<CommandExecutionResult> {
    return await this.executor.run(this.executable, args, options);
  }

  /** Runs a command that must succeed. */
  private async runChecked(args: readonly string[], failureMessage: string): Promise<CommandExecutionResult> {
    return ensureSuccess(await this.run(args), failureMessage);
  }

  /** Runs a command against one container: "no such container" → `ContainerNotFoundError`, other failures throw. */
  private async runForContainer(
    containerId: string,
    args: readonly string[],
    failureMessage: string,
  ): Promise<CommandExecutionResult> {
    const result = await this.run(args);
    assertContainerFound(containerId, result);
    return ensureSuccess(result, `${failureMessage} ${containerId}`);
  }
}
