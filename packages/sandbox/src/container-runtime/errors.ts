import { SandboxError, type CommandExecutionResult } from '../shared/index.js';

/**
 * Base class for container-domain errors. Backend commands that fail are reported with the shared
 * `CommandFailedError`, and commands that cannot run with `CommandExecutionError`.
 */
export class ContainerRuntimeError extends SandboxError {}

/** Backend output could not be parsed. */
export class ContainerParseError extends ContainerRuntimeError {
  readonly parser: string;
  readonly payload: string;

  constructor(parser: string, message: string, payload: string, options?: ErrorOptions) {
    super(`${parser}: ${message}`, options);
    this.parser = parser;
    this.payload = payload;
  }
}

/** The image is missing locally and the pull policy is `never`. */
export class ImageUnavailableError extends ContainerRuntimeError {
  readonly image: string;

  constructor(image: string) {
    super(`Image not present locally and pull policy forbids pulling: ${image}`);
    this.image = image;
  }
}

/** Base class for `waitForHealthy` failures. */
export class ContainerHealthError extends ContainerRuntimeError {
  readonly containerId: string;

  constructor(containerId: string, message: string) {
    super(message);
    this.containerId = containerId;
  }
}

export class ContainerUnhealthyError extends ContainerHealthError {
  constructor(containerId: string) {
    super(containerId, `Container became unhealthy: ${containerId}`);
  }
}

export class ContainerHealthTimeoutError extends ContainerHealthError {
  constructor(containerId: string, timeoutMs: number) {
    super(containerId, `Timed out waiting for container health: ${containerId} after ${timeoutMs}ms`);
  }
}

/** The container does not exist. Every container operation of every runtime rejects with this. */
export class ContainerNotFoundError extends ContainerRuntimeError {
  readonly containerId: string;
  /** The backend command that reported the missing container, when there was one. */
  readonly result: CommandExecutionResult | undefined;

  constructor(containerId: string, result?: CommandExecutionResult, options?: ErrorOptions) {
    super(`Container not found: ${containerId}`, options);
    this.containerId = containerId;
    this.result = result;
  }
}

/** Work inside `withContainer` succeeded but stopping or removing the container failed. */
export class ContainerCleanupError extends ContainerRuntimeError {
  readonly containerId: string;
  readonly cleanupErrors: readonly unknown[];

  constructor(containerId: string, cleanupErrors: readonly unknown[]) {
    super(`Cleanup failed for container: ${containerId}`);
    this.containerId = containerId;
    this.cleanupErrors = [...cleanupErrors];
  }
}
