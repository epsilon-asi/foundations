import { ChildProcessCommandExecutor } from '../../shared/index.js';
import type { RepoRunner, RepoRunnerOptions } from '../contracts/runner.js';
import { GoRepoRunner } from '../runners/golang/GoRepoRunner.js';
import { NodeTypescriptRepoRunner } from '../runners/node-typescript/NodeTypescriptRepoRunner.js';
import { PythonRepoRunner } from '../runners/python/PythonRepoRunner.js';
import { TerraformRepoRunner } from '../runners/terraform/TerraformRepoRunner.js';
import { RepoRunnerRegistry } from './RepoRunnerRegistry.js';

type BuiltInRunnerClass = new (repoPath: string, options?: RepoRunnerOptions) => RepoRunner;

/** Built-in runners in detection order: the first whose marker file is present wins. */
const BUILT_IN_RUNNERS: readonly (readonly [kind: string, runner: BuiltInRunnerClass])[] = [
  ['node-typescript', NodeTypescriptRepoRunner],
  ['python-uv', PythonRepoRunner],
  ['golang', GoRepoRunner],
  ['terraform', TerraformRepoRunner],
];

/**
 * A registry with every built-in runner (`node-typescript`, `python-uv`, `golang`, `terraform`). Every runner it
 * creates shares `options`, including one executor (default: a single `ChildProcessCommandExecutor`).
 */
export function createDefaultRepoRunnerRegistry(options: RepoRunnerOptions = {}): RepoRunnerRegistry {
  const runnerOptions: RepoRunnerOptions = {
    ...options,
    executor: options.executor ?? new ChildProcessCommandExecutor(),
  };
  const registry = new RepoRunnerRegistry();
  for (const [kind, Runner] of BUILT_IN_RUNNERS) {
    registry.register(kind, (repoPath) => new Runner(repoPath, runnerOptions));
  }
  return registry;
}
