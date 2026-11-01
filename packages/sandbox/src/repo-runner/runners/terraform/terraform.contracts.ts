import type { InstallPlan } from '../../contracts/runner.js';

export interface TerraformRepoConfig {
  readonly kind: 'terraform';
  /** `*.tf` file names in the repository root, sorted. */
  readonly configFiles: readonly string[];
  readonly lockfile: '.terraform.lock.hcl' | null;
  /** First `required_version` constraint found in the root configuration, or `null`. */
  readonly requiredVersion: string | null;
}

/** `terraform init -input=false -backend=false`. */
export interface TerraformInstallPlan extends InstallPlan {
  readonly mode: 'init';
}
