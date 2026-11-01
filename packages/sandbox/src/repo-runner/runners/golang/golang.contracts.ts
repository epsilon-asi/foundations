import type { InstallPlan } from '../../contracts/runner.js';

/** The `go.mod` directives the Go runner reads. */
export interface GoModFile {
  /** `module` path, e.g. `example.com/project`. */
  readonly modulePath: string;
  /** `go` directive (minimum Go version), or `null` when absent. */
  readonly goVersion: string | null;
  /** `toolchain` directive, or `null` when absent. */
  readonly toolchain: string | null;
}

export interface GoRepoConfig {
  readonly kind: 'golang';
  readonly goModPath: string;
  readonly goMod: GoModFile;
  readonly lockfile: 'go.sum' | null;
}

/** `go mod download`. */
export interface GoInstallPlan extends InstallPlan {
  readonly mode: 'download';
}
