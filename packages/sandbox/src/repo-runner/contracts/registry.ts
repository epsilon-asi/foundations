import type { RepoRunner } from './runner.js';

/** Creates a runner for the repository at `repoPath`. */
export type RepoRunnerFactory<TRunner extends RepoRunner = RepoRunner> = (repoPath: string) => TRunner;

/** Maps runner kinds to factories and picks the right runner for a repository. */
export interface RepoRunnerRegistryContract {
  /** Registers (or replaces) the factory for `kind`. Registration order is detection priority. */
  register(kind: string, factory: RepoRunnerFactory): void;
  has(kind: string): boolean;
  /** Registered kinds in detection order. */
  kinds(): readonly string[];
  create(kind: string, repoPath: string): RepoRunner;
  /** Returns the first registered runner whose `detect()` succeeds for `repoPath`. */
  detect(repoPath: string): Promise<RepoRunner>;
}
