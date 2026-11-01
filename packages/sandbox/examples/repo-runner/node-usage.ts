/**
 * Example: driving a known Node/TypeScript repository directly.
 */
import { NodeTypescriptRepoRunner, type RepoRunnerOptions, type RepoTaskResult } from '../../src/repo-runner/index.js';

/**
 * Installs dependencies (`npm ci` when a lockfile exists), then runs lint, test and build with a 10-minute default
 * timeout. Scripts the repository does not define are reported as skipped; a failing command throws
 * `CommandFailedError`.
 */
export async function verifyNodeRepository(
  repoPath: string,
  options: RepoRunnerOptions = {},
): Promise<RepoTaskResult[]> {
  const runner = new NodeTypescriptRepoRunner(repoPath, { defaultTimeoutMs: 10 * 60_000, ...options });
  await runner.assertDetected();

  const results = [await runner.installDependencies()];
  for (const task of ['lint', 'test', 'build']) {
    results.push(await runner.runNamedTask(task, { missingTaskBehavior: 'skip' }));
  }
  return results;
}
