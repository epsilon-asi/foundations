import type { InstallPlan } from '../../contracts/runner.js';

/** The `pyproject.toml` tables the Python runner reads, with keys converted to camelCase. */
export interface PythonProjectManifest {
  readonly project?: {
    readonly name?: string;
    readonly version?: string;
    readonly requiresPython?: string;
    readonly dependencies?: readonly string[];
    readonly optionalDependencies?: Readonly<Record<string, readonly string[]>>;
    readonly scripts?: Readonly<Record<string, string>>;
    readonly guiScripts?: Readonly<Record<string, string>>;
  };
  /** PEP 735 dependency groups; `{ include-group = "..." }` entries are omitted. */
  readonly dependencyGroups?: Readonly<Record<string, readonly string[]>>;
  readonly buildSystem?: {
    readonly requires?: readonly string[];
    readonly buildBackend?: string;
  };
  /** The raw `[tool]` table; only `tool.uv.package` is validated. */
  readonly tool?: Readonly<Record<string, unknown>> & {
    readonly uv?: Readonly<Record<string, unknown>> & { readonly package?: boolean };
  };
}

/** Declared project metadata with every collection present (empty when absent). */
export interface PythonVersionSnapshot {
  readonly name: string | null;
  readonly version: string | null;
  readonly requiresPython: string | null;
  readonly dependencies: readonly string[];
  readonly optionalDependencies: Readonly<Record<string, readonly string[]>>;
  readonly dependencyGroups: Readonly<Record<string, readonly string[]>>;
  readonly buildBackend: string | null;
  readonly buildRequirements: readonly string[];
}

export interface PythonRepoConfig {
  readonly kind: 'python-uv';
  readonly manifest: PythonProjectManifest;
  readonly versions: PythonVersionSnapshot;
  /** `[project.scripts]` entry points. */
  readonly scripts: Readonly<Record<string, string>>;
  readonly lockfile: 'uv.lock' | null;
  readonly pyprojectPath: string;
  readonly hasBuildSystem: boolean;
  /** Whether uv builds/installs the project itself (a `[build-system]` or `tool.uv.package = true`). */
  readonly isPackageProject: boolean;
}

/** `uv sync`. */
export interface UvInstallPlan extends InstallPlan {
  readonly mode: 'sync';
}
