import type { CommandExecutionResult, CommandExecutor } from '../shared/index.js';

/** Constructor options for `DockerContainerRuntime`. */
export interface DockerContainerRuntimeOptions {
  /** Runs the Docker CLI. Default: `ChildProcessCommandExecutor`. */
  readonly executor?: CommandExecutor;
  /** CLI binary to invoke. Default: `docker`; any Docker-compatible CLI works. */
  readonly executable?: string;
}

/** `missing` pulls only when absent locally, `always` pulls every time, `never` fails when absent. */
export type ImagePullPolicy = 'missing' | 'always' | 'never';

export interface ContainerBindMountSpec {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly readOnly?: boolean;
  readonly bindPropagation?: string;
}

export interface ContainerTmpfsMountSpec {
  readonly targetPath: string;
  readonly options?: string;
}

export interface ContainerResourceLimits {
  readonly memory?: string;
  readonly cpus?: number | string;
  readonly pidsLimit?: number;
}

export interface ContainerSecurityOptions {
  readonly network?: string;
  readonly readOnlyRootFilesystem?: boolean;
  readonly user?: string;
  readonly privileged?: boolean;
  readonly capAdd?: readonly string[];
  readonly capDrop?: readonly string[];
  readonly securityOpt?: readonly string[];
}

/** Everything needed to create a container around a host workspace directory. */
export interface ContainerCreateOptions {
  readonly image: string;
  /** Host directory bind-mounted into the container as its workspace. */
  readonly workspacePath: string;
  /** Container path the workspace is mounted at. Default: `/workspace`. */
  readonly workspaceMountPath?: string;
  readonly workspaceReadOnly?: boolean;
  readonly additionalMounts?: readonly ContainerBindMountSpec[];
  readonly tmpfsMounts?: readonly ContainerTmpfsMountSpec[];
  /** Default: the workspace mount path. */
  readonly workdir?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly labels?: Readonly<Record<string, string>>;
  /** Container command. Default: a keepalive (`sleep infinity`). */
  readonly command?: readonly string[];
  readonly entrypoint?: string;
  readonly name?: string;
  readonly tty?: boolean;
  readonly init?: boolean;
  readonly platform?: string;
  /** Used by `createStartedContainer`. Default: `missing`. */
  readonly pullPolicy?: ImagePullPolicy;
  readonly resources?: ContainerResourceLimits;
  readonly security?: ContainerSecurityOptions;
  /** Raw backend arguments appended before the image name. */
  readonly extraCreateArgs?: readonly string[];
}

export type ContainerHandleState = 'created' | 'running' | 'stopped';

export interface ContainerHandle {
  readonly id: string;
  readonly image: string;
  /** Absolute host directory mounted into the container. */
  readonly workspacePath: string;
  /** Container path of the workspace mount. */
  readonly workspaceMountPath: string;
  readonly state: ContainerHandleState;
  readonly name?: string;
}

/** The parts of a handle the workspace helpers need. */
export type WorkspaceHandle = Pick<ContainerHandle, 'id' | 'workspaceMountPath'>;

export interface ContainerStopOptions {
  /** Grace period before the backend kills the container. */
  readonly timeoutSeconds?: number;
}

export interface ContainerRemoveOptions {
  readonly force?: boolean;
  /** Also remove anonymous volumes. */
  readonly volumes?: boolean;
}

export interface ContainerExecOptions {
  readonly containerId: string;
  readonly command: readonly string[];
  /** Working directory inside the container. */
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly user?: string;
  readonly tty?: boolean;
  readonly interactive?: boolean;
  readonly detach?: boolean;
  readonly privileged?: boolean;
  /** Text written to the command's stdin (implies `interactive`). */
  readonly stdin?: string;
  /** Kills the exec client process after this many milliseconds and marks the result `timedOut`. */
  readonly timeoutMs?: number;
  /** Aborting kills the exec client process. */
  readonly signal?: AbortSignal;
  /** Limit on stdout/stderr bytes, enforced by the host executor that runs the exec client. */
  readonly maxOutputBytes?: number;
  readonly extraExecArgs?: readonly string[];
}

/** An exec request whose container is implied (command sequences, `runInContainer`). */
export type ContainerCommand = Omit<ContainerExecOptions, 'containerId'>;

/** Exec options for the workspace helpers, which supply the container, command and cwd. */
export type WorkspaceExecOptions = Omit<ContainerCommand, 'command' | 'cwd'>;

/** Result of a command run inside a container. `binary`/`args`/`command` describe the backend invocation. */
export interface ContainerExecResult extends CommandExecutionResult {
  readonly containerId: string;
}

export interface ContainerLogsOptions {
  readonly follow?: boolean;
  readonly tail?: number | 'all';
  readonly since?: string;
  readonly until?: string;
  readonly timestamps?: boolean;
}

export interface ContainerWaitResult {
  readonly containerId: string;
  readonly exitCode: number;
}

/** Source/target paths for `copyToContainer` / `copyFromContainer`. */
export interface ContainerCopyOptions {
  readonly containerId: string;
  readonly sourcePath: string;
  readonly targetPath: string;
}

export interface ContainerCopySpec extends ContainerCopyOptions {
  readonly direction: 'toContainer' | 'fromContainer';
}

export interface ContainerFilesystemChange {
  /** Added, Changed or Deleted. */
  readonly kind: 'A' | 'C' | 'D';
  readonly path: string;
}

export interface ContainerMountInfo {
  readonly source?: string;
  readonly destination?: string;
  readonly mode?: string;
  readonly rw?: boolean;
  readonly type?: string;
}

export interface ContainerStateInfo {
  readonly status?: string;
  readonly running?: boolean;
  readonly paused?: boolean;
  readonly restarting?: boolean;
  readonly oomKilled?: boolean;
  readonly dead?: boolean;
  readonly exitCode?: number;
  /** Healthcheck status; `null` when the container reports health without a status. */
  readonly health?: string | null;
}

export interface ContainerInspection {
  readonly id: string;
  readonly name?: string;
  readonly image?: string;
  readonly state?: ContainerStateInfo;
  readonly mounts: readonly ContainerMountInfo[];
  readonly labels: Readonly<Record<string, string>>;
  /** The backend's unmodified inspection payload. */
  readonly raw: unknown;
}

export interface ContainerSnapshot<TInspection extends ContainerInspection = ContainerInspection> {
  readonly inspection: TInspection;
  readonly logs: string;
  readonly filesystemChanges: readonly ContainerFilesystemChange[];
}

/** Cleanup steps for `withContainer` / `runInContainer`; `stop` and `remove` run unless set to `false`. */
export interface ContainerCleanupOptions extends ContainerRemoveOptions {
  readonly stop?: boolean;
  readonly remove?: boolean;
}

export interface RunInContainerOptions {
  readonly container: ContainerCreateOptions;
  readonly exec: ContainerCommand;
  readonly cleanup?: ContainerCleanupOptions;
}

export interface RunInContainerResult {
  readonly handle: ContainerHandle;
  readonly exec: ContainerExecResult;
}

export interface WaitForHealthyOptions {
  /** Default: 30 000 ms. */
  readonly timeoutMs?: number;
  /** Default: 500 ms. */
  readonly pollIntervalMs?: number;
  /** Return immediately when the container has no healthcheck. Default: `true`. */
  readonly treatMissingHealthcheckAsSuccess?: boolean;
}

export interface ListContainersOptions {
  /** Include stopped containers. */
  readonly all?: boolean;
  /** Backend filters, e.g. `{ label: ['a=b', 'c=d'] }`. */
  readonly filters?: Readonly<Record<string, string | readonly string[]>>;
}

/** Inputs for `buildCodingAgentContainerOptions`; omitted fields get coding-agent defaults. */
export interface CodingAgentContainerOptions extends Pick<
  ContainerCreateOptions,
  | 'image'
  | 'workspacePath'
  | 'workspaceMountPath'
  | 'workspaceReadOnly'
  | 'name'
  | 'env'
  | 'labels'
  | 'security'
  | 'resources'
  | 'tmpfsMounts'
  | 'additionalMounts'
  | 'workdir'
  | 'pullPolicy'
  | 'extraCreateArgs'
  | 'command'
> {
  /** Apply `SECURE_READONLY_SECURITY_OPTIONS` underneath `security`. */
  readonly secureDefaults?: boolean;
}

export type NodePackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface NodeTypescriptContainerOptions extends CodingAgentContainerOptions {
  /** Default: `npm`. */
  readonly packageManager?: NodePackageManager;
  /** Host directory mounted as the package manager's cache. */
  readonly installCachePath?: string;
}

/** One row of `docker container ls --format '{{json .}}'`. */
export interface DockerContainerListSummary {
  readonly id: string;
  readonly image?: string;
  readonly command?: string;
  readonly createdAt?: string;
  readonly names?: string;
  readonly labels?: string;
  readonly mounts?: string;
  readonly state?: string;
  readonly status?: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

/** Selected fields of `docker info --format '{{json .}}'`. */
export interface DockerDaemonInfo {
  readonly id?: string;
  readonly name?: string;
  readonly serverVersion?: string;
  readonly operatingSystem?: string;
  readonly architecture?: string;
  readonly kernelVersion?: string;
  readonly driver?: string;
  readonly cgroupVersion?: string;
  readonly raw: Readonly<Record<string, unknown>>;
}
