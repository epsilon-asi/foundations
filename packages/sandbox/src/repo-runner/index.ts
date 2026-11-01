// Shared execution and error primitives this library's API is built on.
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

export type { RepoRunnerFactory, RepoRunnerRegistryContract } from './contracts/registry.js';
export type {
  InstallDependenciesOptions,
  InstallPlan,
  RepoCommandLine,
  RepoCommandOptions,
  RepoRunner,
  RepoRunnerOptions,
  RepoTaskDefinitions,
  RepoTaskResult,
  RunTaskOptions,
  TaskCommand,
  TaskTable,
} from './contracts/runner.js';
export {
  MissingTaskError,
  RepoConfigParseError,
  RepoRunnerError,
  UnsupportedRepositoryError,
} from './errors/repoRunnerErrors.js';
export { RepoRunnerRegistry } from './registry/RepoRunnerRegistry.js';
export { createDefaultRepoRunnerRegistry } from './registry/createDefaultRegistry.js';
export { AbstractRepoRunner, DEFAULT_TASK_TIMEOUT_MS } from './runners/AbstractRepoRunner.js';
export { GoRepoRunner } from './runners/golang/GoRepoRunner.js';
export type { GoInstallPlan, GoModFile, GoRepoConfig } from './runners/golang/golang.contracts.js';
export { NodeTypescriptRepoRunner } from './runners/node-typescript/NodeTypescriptRepoRunner.js';
export type {
  NodeInstallPlan,
  NodePackageManifest,
  NodeRepoConfig,
  NodeVersionSnapshot,
} from './runners/node-typescript/nodeTypescript.contracts.js';
export { PythonRepoRunner } from './runners/python/PythonRepoRunner.js';
export type {
  PythonProjectManifest,
  PythonRepoConfig,
  PythonVersionSnapshot,
  UvInstallPlan,
} from './runners/python/python.contracts.js';
export { TerraformRepoRunner } from './runners/terraform/TerraformRepoRunner.js';
export type { TerraformInstallPlan, TerraformRepoConfig } from './runners/terraform/terraform.contracts.js';
