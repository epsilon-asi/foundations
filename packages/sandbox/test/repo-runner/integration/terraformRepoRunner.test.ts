import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MissingTaskError, UnsupportedRepositoryError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { TerraformRepoRunner } from '../../../src/repo-runner/runners/terraform/TerraformRepoRunner.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

const repoPath = fixturePath('terraform-basic');

describe('TerraformRepoRunner', () => {
  it('detects repositories with a root-level *.tf file', async () => {
    await expect(new TerraformRepoRunner(repoPath).detect()).resolves.toBe(true);

    const notTerraform = new TerraformRepoRunner(fixturePath('go-basic'));
    await expect(notTerraform.detect()).resolves.toBe(false);
    await expect(notTerraform.getRepoConfig()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
    await expect(new TerraformRepoRunner(path.join(repoPath, 'missing')).detect()).resolves.toBe(false);
  });

  it('reads the config files, lockfile presence, and required_version', async () => {
    await expect(new TerraformRepoRunner(repoPath).getRepoConfig()).resolves.toEqual({
      kind: 'terraform',
      configFiles: ['main.tf'],
      lockfile: null,
      requiredVersion: '>= 1.6.0',
    });

    const dir = await makeTempDir('tf');
    await writeFile(path.join(dir, 'main.tf'), 'variable "x" {}\n', 'utf8');
    await writeFile(path.join(dir, '.terraform.lock.hcl'), '', 'utf8');
    await expect(new TerraformRepoRunner(dir).getRepoConfig()).resolves.toMatchObject({
      lockfile: '.terraform.lock.hcl',
      requiredVersion: null,
    });
  });

  it('lists the Terraform tasks', async () => {
    await expect(new TerraformRepoRunner(repoPath).getTaskDefinitions()).resolves.toEqual({
      build: 'terraform validate',
      validate: 'terraform validate',
      test: 'terraform test',
      fmt: 'terraform fmt -check -recursive',
    });
  });

  it('initialises without input and without a backend', async () => {
    const executor = new RecordingCommandExecutor();

    await new TerraformRepoRunner(repoPath, { executor }).installDependencies({ additionalArgs: ['-upgrade'] });

    expect(executor.calls).toEqual([
      {
        binary: 'terraform',
        args: ['init', '-input=false', '-backend=false', '-upgrade'],
        options: { cwd: repoPath, timeoutMs: 120_000 },
      },
    ]);
  });

  it('runs tasks with forwarded args appended', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new TerraformRepoRunner(repoPath, { executor });

    await runner.runBuild({ args: ['-json'] });
    await runner.runTest({ args: ['-verbose'] });
    await runner.runNamedTask('validate');
    await runner.runNamedTask('fmt', { args: ['modules'] });

    expect(executor.calls.map((call) => [call.binary, ...call.args])).toEqual([
      ['terraform', 'validate', '-json'],
      ['terraform', 'test', '-verbose'],
      ['terraform', 'validate'],
      ['terraform', 'fmt', '-check', '-recursive', 'modules'],
    ]);
  });

  it('throws MissingTaskError for undefined tasks (e.g. plan/apply are deliberately absent)', async () => {
    await expect(new TerraformRepoRunner(repoPath).runNamedTask('apply')).rejects.toBeInstanceOf(MissingTaskError);
  });
});
