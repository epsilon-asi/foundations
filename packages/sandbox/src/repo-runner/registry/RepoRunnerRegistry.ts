import type { RepoRunnerFactory, RepoRunnerRegistryContract } from '../contracts/registry.js';
import type { RepoRunner } from '../contracts/runner.js';
import { RepoRunnerError } from '../errors/repoRunnerErrors.js';

/** Registry of runner factories keyed by kind; registration order is detection priority. */
export class RepoRunnerRegistry implements RepoRunnerRegistryContract {
  readonly #factories = new Map<string, RepoRunnerFactory>();

  /** Registers the factory for `kind`, replacing (in place) any factory already registered for it. */
  public register(kind: string, factory: RepoRunnerFactory): void {
    this.#factories.set(kind, factory);
  }

  public has(kind: string): boolean {
    return this.#factories.has(kind);
  }

  public kinds(): readonly string[] {
    return [...this.#factories.keys()];
  }

  /** @throws RepoRunnerError when no factory is registered for `kind`. */
  public create(kind: string, repoPath: string): RepoRunner {
    const factory = this.#factories.get(kind);
    if (factory === undefined) {
      throw new RepoRunnerError(`No runner registered for kind "${kind}".`);
    }
    return factory(repoPath);
  }

  /** @throws RepoRunnerError when no registered runner detects the repository. */
  public async detect(repoPath: string): Promise<RepoRunner> {
    for (const factory of this.#factories.values()) {
      const runner = factory(repoPath);
      if (await runner.detect()) {
        return runner;
      }
    }
    throw new RepoRunnerError(`No registered runner detected a compatible repository at ${repoPath}.`);
  }
}
