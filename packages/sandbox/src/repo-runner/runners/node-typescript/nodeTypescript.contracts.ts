import type { InstallPlan } from '../../contracts/runner.js';

/** The `package.json` fields the Node runner reads (validated; other fields are dropped). */
export interface NodePackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly type?: string;
  readonly packageManager?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly engines?: Readonly<Record<string, string>>;
  /** Workspace globs, either as an array or as `{ packages }` (other keys such as `nohoist` are dropped). */
  readonly workspaces?: readonly string[] | { readonly packages?: readonly string[] };
}

/** Declared versions with every dependency bucket present (empty when absent). */
export interface NodeVersionSnapshot {
  readonly name: string | null;
  readonly version: string | null;
  readonly packageManager: string | null;
  readonly engines: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
}

export interface NodeRepoConfig {
  readonly kind: 'node-typescript';
  readonly manifest: NodePackageManifest;
  readonly versions: NodeVersionSnapshot;
  readonly scripts: Readonly<Record<string, string>>;
  readonly lockfile: 'package-lock.json' | 'npm-shrinkwrap.json' | null;
  /** Absolute path of `tsconfig.json`, or `null` when absent. */
  readonly typescriptConfigPath: string | null;
  /** True when a tsconfig exists, a TypeScript tool is a dependency, or a script invokes one. */
  readonly isTypescriptRepo: boolean;
}

/** `npm ci` when a lockfile exists, otherwise `npm install`. */
export interface NodeInstallPlan extends InstallPlan {
  readonly mode: 'install' | 'ci';
}
