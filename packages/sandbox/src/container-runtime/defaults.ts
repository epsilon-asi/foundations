import type { ContainerCleanupOptions, ContainerTmpfsMountSpec, ImagePullPolicy } from './types.js';

/** Container path the workspace is mounted at (and the default workdir) when none is given. */
export const DEFAULT_CONTAINER_WORKSPACE_PATH = '/workspace';

/** Command that keeps an otherwise idle container running. */
export const DEFAULT_CONTAINER_KEEPALIVE_COMMAND = ['sleep', 'infinity'] as const;

/** Writable `/tmp` tmpfs mount added by the coding-agent profiles. */
export const DEFAULT_CONTAINER_TMPFS_MOUNT: Readonly<ContainerTmpfsMountSpec> = {
  targetPath: '/tmp',
  options: 'rw,nosuid,nodev,size=268435456',
};

/** Pull policy used when a create request does not specify one. */
export const DEFAULT_IMAGE_PULL_POLICY: ImagePullPolicy = 'missing';

/** Cleanup applied by `withContainer` / `runInContainer` when none is given: stop, then force-remove. */
export const DEFAULT_CONTAINER_CLEANUP: Readonly<ContainerCleanupOptions> = { stop: true, remove: true, force: true };

/**
 * Label keys the coding-agent profiles stamp on every container. The `sandbox.*` values are stored on existing
 * containers, so they stay stable.
 */
export const CONTAINER_LABELS = {
  kind: 'sandbox.kind',
  workspace: 'sandbox.workspace',
  profile: 'sandbox.profile',
  securityProfile: 'sandbox.security-profile',
  packageManager: 'sandbox.package-manager',
} as const;

/** Value of the `sandbox.kind` label for containers built by the coding-agent profiles. */
export const CODING_AGENT_CONTAINER_KIND = 'coding-agent';

/** Returns `command` when it has tokens, otherwise the keepalive command. */
export function resolveContainerCommand(command: readonly string[] | undefined): string[] {
  return [...(command !== undefined && command.length > 0 ? command : DEFAULT_CONTAINER_KEEPALIVE_COMMAND)];
}
