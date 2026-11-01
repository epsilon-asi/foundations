import path from 'node:path';
import { omitUndefined } from '../shared/objects.js';
import {
  CODING_AGENT_CONTAINER_KIND,
  CONTAINER_LABELS,
  DEFAULT_CONTAINER_TMPFS_MOUNT,
  DEFAULT_CONTAINER_WORKSPACE_PATH,
  DEFAULT_IMAGE_PULL_POLICY,
  resolveContainerCommand,
} from './defaults.js';
import type {
  CodingAgentContainerOptions,
  ContainerBindMountSpec,
  ContainerCreateOptions,
  ContainerSecurityOptions,
  ContainerTmpfsMountSpec,
  NodePackageManager,
  NodeTypescriptContainerOptions,
} from './types.js';

/** Baseline for untrusted code: no network, read-only root filesystem, no capabilities, no privilege escalation. */
export const SECURE_READONLY_SECURITY_OPTIONS: Readonly<ContainerSecurityOptions> = {
  network: 'none',
  readOnlyRootFilesystem: true,
  capDrop: ['ALL'],
  securityOpt: ['no-new-privileges=true'],
};

const SECURE_READONLY_PROFILE_NAME = 'secure-readonly';

interface NodeCacheConfiguration {
  readonly targetPath: string;
  readonly env: Readonly<Record<string, string>>;
}

const NODE_PACKAGE_MANAGER_CACHES: Readonly<Record<NodePackageManager, NodeCacheConfiguration>> = {
  npm: { targetPath: '/cache/npm', env: { NPM_CONFIG_CACHE: '/cache/npm' } },
  pnpm: { targetPath: '/cache/pnpm', env: { PNPM_STORE_DIR: '/cache/pnpm/store' } },
  yarn: { targetPath: '/cache/yarn', env: { YARN_CACHE_FOLDER: '/cache/yarn' } },
  bun: { targetPath: '/cache/bun', env: { BUN_INSTALL_CACHE_DIR: '/cache/bun' } },
};

/** What a named profile layers between the coding-agent defaults and the caller's options. */
interface ContainerProfile {
  readonly name: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly labels?: Readonly<Record<string, string>>;
  readonly additionalMounts?: readonly ContainerBindMountSpec[];
}

/** Order-preserving union of two string lists; `undefined` when both are empty. */
function mergeStringArrays(
  base: readonly string[] | undefined,
  override: readonly string[] | undefined,
): string[] | undefined {
  const merged = [...new Set([...(base ?? []), ...(override ?? [])])];
  return merged.length > 0 ? merged : undefined;
}

/** Scalar fields from `override` win; list fields are merged. `undefined` when nothing is set. */
function mergeSecurityOptions(
  base: Readonly<ContainerSecurityOptions> | undefined,
  override: ContainerSecurityOptions | undefined,
): ContainerSecurityOptions | undefined {
  const security = omitUndefined({
    ...base,
    ...omitUndefined(override ?? {}),
    capAdd: mergeStringArrays(base?.capAdd, override?.capAdd),
    capDrop: mergeStringArrays(base?.capDrop, override?.capDrop),
    securityOpt: mergeStringArrays(base?.securityOpt, override?.securityOpt),
  });
  return Object.keys(security).length > 0 ? security : undefined;
}

/** Later mounts replace earlier ones with the same target path. */
function mergeTmpfsMounts(...groups: (readonly ContainerTmpfsMountSpec[] | undefined)[]): ContainerTmpfsMountSpec[] {
  const byTargetPath = new Map(groups.flatMap((group) => group ?? []).map((mount) => [mount.targetPath, { ...mount }]));
  return [...byTargetPath.values()];
}

function buildProfileContainerOptions(
  options: CodingAgentContainerOptions,
  profile: ContainerProfile,
): ContainerCreateOptions {
  const workspaceMountPath = options.workspaceMountPath ?? DEFAULT_CONTAINER_WORKSPACE_PATH;
  const secureDefaults = options.secureDefaults === true;

  return {
    image: options.image,
    workspacePath: path.resolve(options.workspacePath),
    workspaceMountPath,
    workdir: options.workdir ?? workspaceMountPath,
    env: { CI: '1', ...profile.env, ...options.env },
    labels: {
      [CONTAINER_LABELS.kind]: CODING_AGENT_CONTAINER_KIND,
      [CONTAINER_LABELS.workspace]: workspaceMountPath,
      ...profile.labels,
      ...options.labels,
      [CONTAINER_LABELS.profile]: profile.name,
      ...(secureDefaults ? { [CONTAINER_LABELS.securityProfile]: SECURE_READONLY_PROFILE_NAME } : {}),
    },
    init: true,
    pullPolicy: options.pullPolicy ?? DEFAULT_IMAGE_PULL_POLICY,
    tmpfsMounts: mergeTmpfsMounts([DEFAULT_CONTAINER_TMPFS_MOUNT], options.tmpfsMounts),
    additionalMounts: [...(options.additionalMounts ?? []), ...(profile.additionalMounts ?? [])],
    command: resolveContainerCommand(options.command),
    ...omitUndefined({
      workspaceReadOnly: options.workspaceReadOnly === true ? true : undefined,
      name: options.name,
      resources: options.resources,
      security: mergeSecurityOptions(secureDefaults ? SECURE_READONLY_SECURITY_OPTIONS : undefined, options.security),
      extraCreateArgs: options.extraCreateArgs?.slice(),
    }),
  };
}

/**
 * Create options for a general coding-agent container: workspace mounted at `/workspace`, `CI=1`, `--init`,
 * a keepalive command, a tmpfs `/tmp`, and `sandbox.*` labels. `secureDefaults` adds the secure read-only baseline.
 */
export function buildCodingAgentContainerOptions(options: CodingAgentContainerOptions): ContainerCreateOptions {
  return buildProfileContainerOptions(options, { name: 'general' });
}

/** Coding-agent options plus Node.js defaults and, when `installCachePath` is set, a package-manager cache mount. */
export function buildNodeTypescriptContainerOptions(options: NodeTypescriptContainerOptions): ContainerCreateOptions {
  const { packageManager = 'npm', installCachePath } = options;
  const cache = NODE_PACKAGE_MANAGER_CACHES[packageManager];
  const useCache = installCachePath !== undefined;

  return buildProfileContainerOptions(options, {
    name: 'node-typescript',
    env: { NODE_ENV: 'development', npm_config_update_notifier: 'false', ...(useCache ? cache.env : {}) },
    labels: { [CONTAINER_LABELS.packageManager]: packageManager },
    additionalMounts: useCache ? [{ sourcePath: path.resolve(installCachePath), targetPath: cache.targetPath }] : [],
  });
}
