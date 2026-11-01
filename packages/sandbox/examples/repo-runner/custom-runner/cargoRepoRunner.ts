/**
 * Example: adding an ecosystem (Rust / cargo) by extending `AbstractRepoRunner`.
 *
 * A runner only answers four questions; the base class does the rest (config memoization, task listing,
 * MissingTaskError vs. skipped results, argument forwarding, install, timeouts, command execution, and
 * CommandFailedError unless `allowNonZeroExit`):
 *   detect()              – is this a cargo repository?
 *   loadRepoConfig()      – what does its manifest say?
 *   resolveTasks()        – which tasks exist, and which command runs each?
 *   resolveInstallPlan()  – how are dependencies installed?
 */
import { readFile } from 'node:fs/promises';

import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';

import {
  AbstractRepoRunner,
  createDefaultRepoRunnerRegistry,
  RepoConfigParseError,
  type InstallPlan,
  type RepoRunnerOptions,
  type RepoRunnerRegistry,
  type TaskTable,
} from '../../../src/repo-runner/index.js';

export interface CargoRepoConfig {
  readonly kind: 'rust-cargo';
  /** `[package].name`, or `null` for a virtual workspace manifest. */
  readonly packageName: string | null;
  readonly isWorkspace: boolean;
  readonly lockfile: 'Cargo.lock' | null;
}

const cargoManifestSchema = z.looseObject({
  package: z.looseObject({ name: z.string() }).optional(),
  workspace: z.looseObject({}).optional(),
});

const CARGO_TASKS: TaskTable = new Map([
  ['build', { binary: 'cargo', args: ['build'] }],
  ['check', { binary: 'cargo', args: ['check'] }],
  // `cargo test <filter> -- <test-binary args>`: forwarded args go to cargo itself.
  ['test', { binary: 'cargo', args: ['test'] }],
  ['clippy', { binary: 'cargo', args: ['clippy', '--all-targets'] }],
  ['fmt', { binary: 'cargo', args: ['fmt', '--check'] }],
]);

export class CargoRepoRunner extends AbstractRepoRunner<CargoRepoConfig> {
  public readonly kind = 'rust-cargo';

  public detect(): Promise<boolean> {
    return this.hasFile('Cargo.toml');
  }

  protected async loadRepoConfig(): Promise<CargoRepoConfig> {
    const manifestPath = this.resolvePath('Cargo.toml');
    let manifest: z.infer<typeof cargoManifestSchema>;
    try {
      manifest = cargoManifestSchema.parse(parseToml(await readFile(manifestPath, 'utf8')));
    } catch (error) {
      throw new RepoConfigParseError(manifestPath, error instanceof Error ? error.message : String(error), {
        cause: error,
      });
    }

    return {
      kind: this.kind,
      packageName: manifest.package?.name ?? null,
      isWorkspace: manifest.workspace !== undefined,
      lockfile: (await this.hasFile('Cargo.lock')) ? 'Cargo.lock' : null,
    };
  }

  protected resolveTasks(): TaskTable {
    return CARGO_TASKS;
  }

  /** `cargo fetch`, pinned to the lockfile when there is one. */
  protected resolveInstallPlan(config: CargoRepoConfig): InstallPlan {
    return { binary: 'cargo', args: config.lockfile === null ? ['fetch'] : ['fetch', '--locked'], mode: 'fetch' };
  }
}

/** The default registry plus the cargo runner (checked after the built-in runners); all share `options`. */
export function createRegistryWithCargo(options: RepoRunnerOptions = {}): RepoRunnerRegistry {
  const registry = createDefaultRepoRunnerRegistry(options);
  registry.register('rust-cargo', (repoPath) => new CargoRepoRunner(repoPath, options));
  return registry;
}
