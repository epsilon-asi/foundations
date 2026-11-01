export type {
  CodingAgentContainerOptions,
  ContainerBindMountSpec,
  ContainerCleanupOptions,
  ContainerCommand,
  ContainerCopyOptions,
  ContainerCopySpec,
  ContainerCreateOptions,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerFilesystemChange,
  ContainerHandle,
  ContainerHandleState,
  ContainerInspection,
  ContainerLogsOptions,
  ContainerMountInfo,
  ContainerRemoveOptions,
  ContainerResourceLimits,
  ContainerSecurityOptions,
  ContainerSnapshot,
  ContainerStateInfo,
  ContainerStopOptions,
  ContainerTmpfsMountSpec,
  ContainerWaitResult,
  DockerContainerListSummary,
  DockerContainerRuntimeOptions,
  DockerDaemonInfo,
  ImagePullPolicy,
  ListContainersOptions,
  NodePackageManager,
  NodeTypescriptContainerOptions,
  RunInContainerOptions,
  RunInContainerResult,
  WaitForHealthyOptions,
  WorkspaceExecOptions,
  WorkspaceHandle,
} from './types.js';

export {
  ContainerCleanupError,
  ContainerHealthError,
  ContainerHealthTimeoutError,
  ContainerNotFoundError,
  ContainerParseError,
  ContainerRuntimeError,
  ContainerUnhealthyError,
  ImageUnavailableError,
} from './errors.js';

export {
  CODING_AGENT_CONTAINER_KIND,
  CONTAINER_LABELS,
  DEFAULT_CONTAINER_CLEANUP,
  DEFAULT_CONTAINER_KEEPALIVE_COMMAND,
  DEFAULT_CONTAINER_TMPFS_MOUNT,
  DEFAULT_CONTAINER_WORKSPACE_PATH,
  DEFAULT_IMAGE_PULL_POLICY,
} from './defaults.js';

export {
  buildCodingAgentContainerOptions,
  buildNodeTypescriptContainerOptions,
  SECURE_READONLY_SECURITY_OPTIONS,
} from './codingAgentProfiles.js';

export {
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
  formatDockerBindMount,
  formatDockerTmpfsMount,
} from './dockerCommandBuilder.js';

export {
  parseDockerCreate,
  parseDockerDiff,
  parseDockerInfo,
  parseDockerInspect,
  parseDockerListJsonLines,
  parseDockerWait,
} from './dockerParsing.js';

export { AbstractContainerRuntime } from './abstractContainerRuntime.js';
export { DockerContainerRuntime } from './dockerContainerRuntime.js';
export { ContainerCommandExecutor } from './containerCommandExecutor.js';
export type { ContainerCommandExecutorOptions } from './containerCommandExecutor.js';

// Shared-layer symbols this library's API uses, so the subpath is self-sufficient.
export {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  CommandFailedError,
  SandboxError,
  ensureSuccess,
  isSuccessfulResult,
} from '../shared/index.js';
export type {
  CommandExecutionOptions,
  CommandExecutionResult,
  CommandExecutor,
  EnvironmentOverrides,
} from '../shared/index.js';
