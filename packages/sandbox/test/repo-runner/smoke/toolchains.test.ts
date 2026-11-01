import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultRepoRunnerRegistry } from '../../../src/repo-runner/registry/createDefaultRegistry.js';
import { CommandFailedError } from '../../../src/shared/index.js';
import { copyFixture, makeTempDir } from '../helpers/testUtils.js';

/**
 * Runs real toolchains against copies of the fixtures. Opt in with `REPO_RUNNER_SMOKE=1`
 * (requires npm, go, terraform, and uv on PATH; no network access is needed).
 */
const enabled = process.env.REPO_RUNNER_SMOKE === '1';
const timeout = 120_000;

describe.skipIf(!enabled)('real toolchain smoke tests', () => {
  const registry = createDefaultRepoRunnerRegistry();

  it(
    'node-typescript: runs npm scripts',
    async () => {
      const runner = await registry.detect(await copyFixture('node-basic'));

      expect(runner.kind).toBe('node-typescript');
      await expect(runner.runTest()).resolves.toMatchObject({
        exitCode: 0,
        stdout: expect.stringContaining('node-basic test') as unknown,
      });
      await expect(runner.runNamedTask('hello')).resolves.toMatchObject({ exitCode: 0 });
    },
    timeout,
  );

  it(
    'node-typescript: a failing script throws CommandFailedError unless allowNonZeroExit is set',
    async () => {
      const repoPath = await makeTempDir('node-failing');
      const scripts = { fail: 'node -e "process.stderr.write(\'broken\'); process.exit(3)"' };
      await writeFile(path.join(repoPath, 'package.json'), JSON.stringify({ name: 'failing', scripts }), 'utf8');
      const runner = await registry.detect(repoPath);

      const error: unknown = await runner.runNamedTask('fail').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CommandFailedError);
      expect((error as CommandFailedError).message).toMatch(
        /^Running task "fail": npm run fail failed \(exit code 3\)/,
      );
      await expect(runner.runNamedTask('fail', { allowNonZeroExit: true })).resolves.toMatchObject({
        exitCode: 3,
        stderr: expect.stringContaining('broken') as unknown,
        skipped: false,
      });
    },
    timeout,
  );

  it(
    'python-uv: syncs a dependency-free project offline',
    async () => {
      const repoPath = await makeTempDir('python-uv');
      const pyproject =
        '[project]\nname = "smoke"\nversion = "0.1.0"\nrequires-python = ">=3.9"\n\n[tool.uv]\npackage = false\n';
      await writeFile(path.join(repoPath, 'pyproject.toml'), pyproject, 'utf8');
      const runner = await registry.detect(repoPath);

      expect(runner.kind).toBe('python-uv');
      await expect(runner.installDependencies({ additionalArgs: ['--offline'] })).resolves.toMatchObject({
        exitCode: 0,
      });
      await expect(runner.runTest({ missingTaskBehavior: 'skip' })).resolves.toMatchObject({ skipped: true });
    },
    timeout,
  );

  it(
    'golang: downloads modules, tests, builds, and vets',
    async () => {
      const runner = await registry.detect(await copyFixture('go-basic'));

      expect(runner.kind).toBe('golang');
      await expect(runner.installDependencies()).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runTest({ args: ['-count=1'] })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runBuild({ args: ['-v'] })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runNamedTask('vet')).resolves.toMatchObject({ exitCode: 0 });
    },
    timeout,
  );

  it(
    'terraform: initialises without a backend, validates, tests, and checks formatting',
    async () => {
      const runner = await registry.detect(await copyFixture('terraform-basic'));
      const env = { TF_IN_AUTOMATION: '1' };

      expect(runner.kind).toBe('terraform');
      await expect(runner.installDependencies({ env })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runBuild({ args: ['-no-color'], env })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runTest({ args: ['-no-color'], env })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runner.runNamedTask('fmt', { env })).resolves.toMatchObject({ exitCode: 0 });
    },
    timeout,
  );
});
