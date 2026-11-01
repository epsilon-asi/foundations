import type { TaskCommand, TaskTable } from '../../contracts/runner.js';
import { AbstractRepoRunner } from '../AbstractRepoRunner.js';
import type { TerraformInstallPlan, TerraformRepoConfig } from './terraform.contracts.js';
import { findRequiredVersion, listTerraformFiles } from './terraformConfigReader.js';

const TERRAFORM_BINARY = 'terraform';
const TERRAFORM_LOCKFILE = '.terraform.lock.hcl';

/**
 * `terraform init` without prompts and without configuring the backend: providers and modules are
 * downloaded, but no remote state is read, written, or locked.
 */
const TERRAFORM_INSTALL_PLAN: TerraformInstallPlan = {
  binary: TERRAFORM_BINARY,
  args: ['init', '-input=false', '-backend=false'],
  mode: 'init',
};

const VALIDATE: TaskCommand = { binary: TERRAFORM_BINARY, args: ['validate'] };

const TERRAFORM_TASKS: TaskTable = new Map([
  ['build', VALIDATE],
  ['validate', VALIDATE],
  ['test', { binary: TERRAFORM_BINARY, args: ['test'] }],
  ['fmt', { binary: TERRAFORM_BINARY, args: ['fmt', '-check', '-recursive'] }],
]);

/**
 * Runner for Terraform root modules (detected by a `*.tf` file in the repository root).
 * Install is `terraform init -input=false -backend=false`; `build`/`validate` run `terraform validate`,
 * `test` runs `terraform test`, and `fmt` runs `terraform fmt -check -recursive`.
 */
export class TerraformRepoRunner extends AbstractRepoRunner<TerraformRepoConfig, TerraformInstallPlan> {
  public readonly kind = 'terraform';

  public async detect(): Promise<boolean> {
    return (await listTerraformFiles(this.repoPath)).length > 0;
  }

  protected async loadRepoConfig(): Promise<TerraformRepoConfig> {
    const configFiles = await listTerraformFiles(this.repoPath);
    return {
      kind: this.kind,
      configFiles,
      lockfile: (await this.hasFile(TERRAFORM_LOCKFILE)) ? TERRAFORM_LOCKFILE : null,
      requiredVersion: await findRequiredVersion(this.repoPath, configFiles),
    };
  }

  protected resolveTasks(): TaskTable {
    return TERRAFORM_TASKS;
  }

  protected resolveInstallPlan(): TerraformInstallPlan {
    return TERRAFORM_INSTALL_PLAN;
  }
}
