import { DEFAULT_CONTAINER_WORKSPACE_PATH, resolveContainerCommand } from './defaults.js';
import { assertNonEmptyArray } from './internal.js';
import type {
  ContainerBindMountSpec,
  ContainerCopyOptions,
  ContainerExecOptions,
  ContainerLogsOptions,
  ContainerRemoveOptions,
  ContainerCreateOptions,
  ContainerStopOptions,
  ContainerTmpfsMountSpec,
  ListContainersOptions,
} from './types.js';

/** `[name]` when `enabled` is exactly `true`. */
function flag(name: string, enabled: boolean | undefined): string[] {
  return enabled === true ? [name] : [];
}

/** `[name, value]` when `value` is defined. */
function option(name: string, value: string | number | undefined): string[] {
  return value === undefined ? [] : [name, String(value)];
}

/** `[name, v1, name, v2, ...]`. */
function repeatedOption(name: string, values: readonly string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => [name, value]);
}

/** One `name key=value` pair per entry; array values repeat the key. */
function keyValueOptions(
  name: string,
  entries: Readonly<Record<string, string | readonly string[]>> | undefined,
): string[] {
  return Object.entries(entries ?? {}).flatMap(([key, values]) =>
    repeatedOption(
      name,
      (typeof values === 'string' ? [values] : values).map((value) => `${key}=${value}`),
    ),
  );
}

/** `container <verb> [...flags] <containerId>`. */
function containerCommand(verb: string, containerId: string, flags: readonly string[] = []): string[] {
  return ['container', verb, ...flags, containerId];
}

export function formatDockerBindMount(spec: ContainerBindMountSpec): string {
  return [
    'type=bind',
    `src=${spec.sourcePath}`,
    `dst=${spec.targetPath}`,
    ...flag('readonly', spec.readOnly),
    ...(spec.bindPropagation === undefined ? [] : [`bind-propagation=${spec.bindPropagation}`]),
  ].join(',');
}

export function formatDockerTmpfsMount(spec: ContainerTmpfsMountSpec): string {
  return spec.options === undefined ? spec.targetPath : `${spec.targetPath}:${spec.options}`;
}

export function buildDockerCreateArgs(options: ContainerCreateOptions): string[] {
  const { security, resources } = options;
  const workspaceMountPath = options.workspaceMountPath ?? DEFAULT_CONTAINER_WORKSPACE_PATH;
  const workspaceMount: ContainerBindMountSpec = {
    sourcePath: options.workspacePath,
    targetPath: workspaceMountPath,
    readOnly: options.workspaceReadOnly === true,
  };

  return [
    'container',
    'create',
    ...option('--name', options.name),
    ...option('--platform', options.platform),
    ...flag('--init', options.init),
    ...flag('--tty', options.tty),
    ...option('--workdir', options.workdir ?? workspaceMountPath),
    ...option('--network', security?.network),
    ...option('--user', security?.user),
    ...flag('--read-only', security?.readOnlyRootFilesystem),
    ...flag('--privileged', security?.privileged),
    ...repeatedOption('--cap-add', security?.capAdd),
    ...repeatedOption('--cap-drop', security?.capDrop),
    ...repeatedOption('--security-opt', security?.securityOpt),
    ...option('--memory', resources?.memory),
    ...option('--cpus', resources?.cpus),
    ...option('--pids-limit', resources?.pidsLimit),
    ...keyValueOptions('--env', options.env),
    ...keyValueOptions('--label', options.labels),
    ...repeatedOption('--mount', [workspaceMount, ...(options.additionalMounts ?? [])].map(formatDockerBindMount)),
    ...repeatedOption('--tmpfs', options.tmpfsMounts?.map(formatDockerTmpfsMount)),
    ...option('--entrypoint', options.entrypoint),
    ...(options.extraCreateArgs ?? []),
    options.image,
    ...resolveContainerCommand(options.command),
  ];
}

export function buildDockerStartArgs(containerId: string): string[] {
  return containerCommand('start', containerId);
}

export function buildDockerStopArgs(containerId: string, options: ContainerStopOptions = {}): string[] {
  return containerCommand('stop', containerId, option('--time', options.timeoutSeconds));
}

export function buildDockerRemoveArgs(containerId: string, options: ContainerRemoveOptions = {}): string[] {
  return containerCommand('rm', containerId, [
    ...flag('--force', options.force),
    ...flag('--volumes', options.volumes),
  ]);
}

/** Throws `TypeError` when `options.command` is empty. Passing `stdin` implies `--interactive`. */
export function buildDockerExecArgs(options: ContainerExecOptions): string[] {
  assertNonEmptyArray(options.command, 'docker exec requires at least one command token');

  return [
    'container',
    'exec',
    ...flag('--interactive', options.interactive === true || options.stdin !== undefined),
    ...flag('--tty', options.tty),
    ...flag('--detach', options.detach),
    ...flag('--privileged', options.privileged),
    ...option('--user', options.user),
    ...option('--workdir', options.cwd),
    ...keyValueOptions('--env', options.env),
    ...(options.extraExecArgs ?? []),
    options.containerId,
    ...options.command,
  ];
}

export function buildDockerLogsArgs(containerId: string, options: ContainerLogsOptions = {}): string[] {
  return containerCommand('logs', containerId, [
    ...flag('--follow', options.follow),
    ...option('--tail', options.tail),
    ...flag('--timestamps', options.timestamps),
    ...option('--since', options.since),
    ...option('--until', options.until),
  ]);
}

export function buildDockerInspectArgs(containerId: string): string[] {
  return containerCommand('inspect', containerId);
}

export function buildDockerListArgs(options: ListContainersOptions = {}): string[] {
  return [
    'container',
    'ls',
    '--format',
    '{{json .}}',
    ...flag('--all', options.all),
    ...keyValueOptions('--filter', options.filters),
  ];
}

export function buildDockerWaitArgs(containerId: string): string[] {
  return containerCommand('wait', containerId);
}

export function buildDockerCopyToContainerArgs(options: ContainerCopyOptions): string[] {
  return ['container', 'cp', options.sourcePath, `${options.containerId}:${options.targetPath}`];
}

export function buildDockerCopyFromContainerArgs(options: ContainerCopyOptions): string[] {
  return ['container', 'cp', `${options.containerId}:${options.sourcePath}`, options.targetPath];
}

export function buildDockerDiffArgs(containerId: string): string[] {
  return containerCommand('diff', containerId);
}

export function buildDockerPauseArgs(containerId: string): string[] {
  return containerCommand('pause', containerId);
}

export function buildDockerUnpauseArgs(containerId: string): string[] {
  return containerCommand('unpause', containerId);
}

export function buildDockerKillArgs(containerId: string, signal?: string): string[] {
  return containerCommand('kill', containerId, option('--signal', signal));
}

export function buildDockerPullArgs(image: string): string[] {
  return ['image', 'pull', image];
}

export function buildDockerImageInspectArgs(image: string): string[] {
  return ['image', 'inspect', image];
}

export function buildDockerInfoArgs(): string[] {
  return ['info', '--format', '{{json .}}'];
}
