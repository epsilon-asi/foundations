import type { RepoTaskResult, RunTaskOptions, TaskTable } from '../../contracts/runner.js';
import { AbstractRepoRunner } from '../AbstractRepoRunner.js';
import type {
  NodeInstallPlan,
  NodePackageManifest,
  NodeRepoConfig,
  NodeVersionSnapshot,
} from './nodeTypescript.contracts.js';
import { buildInstallPlan, buildNpmTaskTable } from './npmCommands.js';
import {
  extractVersionSnapshot,
  getDeclaredDependencyVersion,
  getScriptDefinitions,
  readPackageManifest,
} from './packageJsonReader.js';
import { findTypescriptConfig, readTypescriptConfig } from './typescriptConfigReader.js';

/** Lockfiles that make `npm ci` possible, in npm's precedence order. */
const NPM_LOCKFILES = ['npm-shrinkwrap.json', 'package-lock.json'] as const;
const TYPESCRIPT_TOOL_PACKAGES = ['typescript', 'ts-node', 'tsx'];
const TYPESCRIPT_TOOL_COMMAND = /(^|\s)(tsc|ts-node|tsx)(\s|$)/;

function hasTypescriptSignals(manifest: NodePackageManifest): boolean {
  return (
    TYPESCRIPT_TOOL_PACKAGES.some((name) => getDeclaredDependencyVersion(manifest, name) !== null) ||
    Object.values(getScriptDefinitions(manifest)).some((script) => TYPESCRIPT_TOOL_COMMAND.test(script))
  );
}

/**
 * Runner for npm-managed Node.js / TypeScript repositories (detected by `package.json`).
 * Tasks are the `package.json` scripts; install uses `npm ci` when a lockfile exists.
 */
export class NodeTypescriptRepoRunner extends AbstractRepoRunner<NodeRepoConfig, NodeInstallPlan> {
  public readonly kind = 'node-typescript';
  #typescriptConfig: Promise<Record<string, unknown> | null> | undefined;

  public detect(): Promise<boolean> {
    return this.hasFile('package.json');
  }

  public async getVersionSnapshot(): Promise<NodeVersionSnapshot> {
    return (await this.getRepoConfig()).versions;
  }

  public async getDeclaredDependencyVersion(packageName: string): Promise<string | null> {
    return getDeclaredDependencyVersion((await this.getRepoConfig()).manifest, packageName);
  }

  public async getScriptDefinitions(): Promise<Readonly<Record<string, string>>> {
    return (await this.getRepoConfig()).scripts;
  }

  public async hasScript(name: string): Promise<boolean> {
    return Object.hasOwn(await this.getScriptDefinitions(), name);
  }

  /** Parsed `tsconfig.json` (memoized), or `null` when the repository has none. */
  public async getTypescriptConfig(): Promise<Record<string, unknown> | null> {
    const { typescriptConfigPath } = await this.getRepoConfig();
    if (typescriptConfigPath === null) {
      return null;
    }
    this.#typescriptConfig ??= readTypescriptConfig(typescriptConfigPath);
    return this.#typescriptConfig;
  }

  public runLint(options?: RunTaskOptions): Promise<RepoTaskResult> {
    return this.runNamedTask('lint', options);
  }

  public runTypecheck(options?: RunTaskOptions): Promise<RepoTaskResult> {
    return this.runNamedTask('typecheck', options);
  }

  protected async loadRepoConfig(): Promise<NodeRepoConfig> {
    const manifest = await readPackageManifest(this.repoPath);
    const [typescriptConfigPath, lockfile] = await Promise.all([
      findTypescriptConfig(this.repoPath),
      this.findLockfile(),
    ]);
    return {
      kind: this.kind,
      manifest,
      versions: extractVersionSnapshot(manifest),
      scripts: getScriptDefinitions(manifest),
      lockfile,
      typescriptConfigPath,
      isTypescriptRepo: typescriptConfigPath !== null || hasTypescriptSignals(manifest),
    };
  }

  protected resolveTasks(config: NodeRepoConfig): TaskTable {
    return buildNpmTaskTable(config.scripts);
  }

  protected resolveInstallPlan(config: NodeRepoConfig): NodeInstallPlan {
    return buildInstallPlan(config.lockfile !== null);
  }

  private async findLockfile(): Promise<NodeRepoConfig['lockfile']> {
    for (const lockfile of NPM_LOCKFILES) {
      if (await this.hasFile(lockfile)) {
        return lockfile;
      }
    }
    return null;
  }
}
