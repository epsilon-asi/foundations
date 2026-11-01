import type { TaskTable } from '../../contracts/runner.js';
import { AbstractRepoRunner } from '../AbstractRepoRunner.js';
import type { PythonRepoConfig, PythonVersionSnapshot, UvInstallPlan } from './python.contracts.js';
import {
  extractVersionSnapshot,
  getPythonScriptDefinitions,
  hasUvConfiguration,
  isBuildableProject,
  readPyprojectToml,
} from './pyprojectTomlReader.js';
import { buildUvTaskTable, UV_SYNC_PLAN } from './uvCommands.js';

const PYPROJECT = 'pyproject.toml';
const UV_LOCK = 'uv.lock';

/**
 * Runner for Python projects managed by uv: a `pyproject.toml` plus either `uv.lock`, a `[tool.uv]`
 * table, or the `uv_build` backend. Install is `uv sync`; tasks come from {@link buildUvTaskTable}.
 */
export class PythonRepoRunner extends AbstractRepoRunner<PythonRepoConfig, UvInstallPlan> {
  public readonly kind = 'python-uv';

  public async detect(): Promise<boolean> {
    if (!(await this.hasFile(PYPROJECT))) {
      return false;
    }
    return (await this.hasFile(UV_LOCK)) || hasUvConfiguration(await readPyprojectToml(this.resolvePath(PYPROJECT)));
  }

  public async getVersionSnapshot(): Promise<PythonVersionSnapshot> {
    return (await this.getRepoConfig()).versions;
  }

  protected async loadRepoConfig(): Promise<PythonRepoConfig> {
    const pyprojectPath = this.resolvePath(PYPROJECT);
    const manifest = await readPyprojectToml(pyprojectPath);
    return {
      kind: this.kind,
      manifest,
      versions: extractVersionSnapshot(manifest),
      scripts: getPythonScriptDefinitions(manifest),
      lockfile: (await this.hasFile(UV_LOCK)) ? UV_LOCK : null,
      pyprojectPath,
      hasBuildSystem: manifest.buildSystem !== undefined,
      isPackageProject: isBuildableProject(manifest),
    };
  }

  protected resolveTasks(config: PythonRepoConfig): TaskTable {
    return buildUvTaskTable(config.manifest);
  }

  protected resolveInstallPlan(): UvInstallPlan {
    return UV_SYNC_PLAN;
  }
}
