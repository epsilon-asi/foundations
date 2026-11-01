/**
 * Example: letting the registry pick the runner for an arbitrary repository.
 */
import {
  createDefaultRepoRunnerRegistry,
  type InstallPlan,
  type RepoRunnerOptions,
  type RepoTaskDefinitions,
} from '../../src/repo-runner/index.js';

export interface RepositorySummary {
  readonly kind: string;
  readonly installPlan: InstallPlan;
  readonly tasks: RepoTaskDefinitions;
}

/** Detects the ecosystem of `repoPath` and reports how it would be installed and which tasks it offers. */
export async function describeRepository(repoPath: string, options?: RepoRunnerOptions): Promise<RepositorySummary> {
  const runner = await createDefaultRepoRunnerRegistry(options).detect(repoPath);
  return {
    kind: runner.kind,
    installPlan: await runner.getPreferredInstallPlan(),
    tasks: await runner.getTaskDefinitions(),
  };
}
