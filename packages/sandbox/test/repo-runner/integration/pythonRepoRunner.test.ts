import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MissingTaskError, UnsupportedRepositoryError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { PythonRepoRunner } from '../../../src/repo-runner/runners/python/PythonRepoRunner.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

function runnerFor(fixture: string, executor = new RecordingCommandExecutor()): PythonRepoRunner {
  return new PythonRepoRunner(fixturePath(fixture), { executor });
}

describe('PythonRepoRunner', () => {
  it('detect returns true for uv projects and false for non-uv or missing pyproject repos', async () => {
    const nonUv = runnerFor('python-non-uv');

    await expect(runnerFor('python-uv-basic').detect()).resolves.toBe(true);
    await expect(nonUv.detect()).resolves.toBe(false);
    await expect(nonUv.getRepoConfig()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
    await expect(new PythonRepoRunner(await makeTempDir('no-pyproject')).detect()).resolves.toBe(false);
  });

  it('detect returns true for uv projects without a lockfile when tool.uv is declared', async () => {
    await expect(runnerFor('python-uv-no-build').detect()).resolves.toBe(true);
  });

  it('getRepoConfig returns scripts, versions, lockfile, and build metadata', async () => {
    const config = await runnerFor('python-uv-basic').getRepoConfig();

    expect(config).toMatchObject({
      kind: 'python-uv',
      lockfile: 'uv.lock',
      pyprojectPath: path.join(fixturePath('python-uv-basic'), 'pyproject.toml'),
      scripts: { hello: 'example:main' },
      hasBuildSystem: true,
      isPackageProject: true,
      versions: { name: 'python-uv-basic-fixture', buildBackend: 'setuptools.build_meta' },
    });
    await expect(runnerFor('python-uv-no-build').getRepoConfig()).resolves.toMatchObject({
      lockfile: null,
      hasBuildSystem: false,
      isPackageProject: false,
    });
  });

  it('getVersionSnapshot exposes parsed Python project versions', async () => {
    await expect(runnerFor('python-uv-basic').getVersionSnapshot()).resolves.toMatchObject({
      name: 'python-uv-basic-fixture',
      requiresPython: '>=3.11',
      buildBackend: 'setuptools.build_meta',
    });
  });

  it('getTaskDefinitions derives uv tasks from scripts and dependencies', async () => {
    await expect(runnerFor('python-uv-basic').getTaskDefinitions()).resolves.toEqual({
      build: 'uv build',
      hello: 'uv run hello',
      test: 'uv run pytest',
      lint: 'uv run ruff check',
      typecheck: 'uv run mypy',
      pytest: 'uv run pytest',
      ruff: 'uv run ruff',
      mypy: 'uv run mypy',
    });
  });

  it('getTaskDefinitions omits entry points and build for non-packaged projects', async () => {
    await expect(runnerFor('python-uv-no-build').getTaskDefinitions()).resolves.toEqual({
      test: 'uv run pytest',
      pytest: 'uv run pytest',
    });
  });

  it('getPreferredInstallPlan and installDependencies use uv sync', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = runnerFor('python-uv-basic', executor);

    await expect(runner.getPreferredInstallPlan({ additionalArgs: ['--frozen'] })).resolves.toEqual({
      binary: 'uv',
      args: ['sync', '--frozen'],
      mode: 'sync',
    });
    await runner.installDependencies({ additionalArgs: ['--locked'] });

    expect(executor.calls).toEqual([
      {
        binary: 'uv',
        args: ['sync', '--locked'],
        options: { cwd: path.resolve(fixturePath('python-uv-basic')), timeoutMs: 120_000 },
      },
    ]);
  });

  it('runTest executes uv run pytest when pytest is declared', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('python-uv-basic', executor).runTest({ args: ['-q'] });

    expect(executor.calls[0]).toMatchObject({ binary: 'uv', args: ['run', 'pytest', '-q'] });
  });

  it('runBuild executes uv build with forwarded args', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('python-uv-basic', executor).runBuild({ args: ['--wheel'] });

    expect(executor.calls[0]?.args).toEqual(['build', '--wheel']);
  });

  it('runNamedTask executes uv run <name> for declared scripts', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('python-uv-basic', executor).runNamedTask('hello', { args: ['--flag'] });

    expect(executor.calls[0]?.args).toEqual(['run', 'hello', '--flag']);
  });

  it('prefers explicit script tasks and conventional pyright tasks when declared', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = runnerFor('python-uv-scripted', executor);

    await expect(runner.detect()).resolves.toBe(true);
    await expect(runner.getTaskDefinitions()).resolves.toEqual({
      build: 'uv build',
      hello: 'uv run hello',
      test: 'uv run test',
      lint: 'uv run lint',
      typecheck: 'uv run typecheck',
      pyright: 'uv run pyright',
    });

    await runner.runTest();
    await runner.runNamedTask('lint');
    await runner.runNamedTask('typecheck');
    await runner.runNamedTask('pyright');

    expect(executor.calls.map((call) => call.args)).toEqual([
      ['run', 'test'],
      ['run', 'lint'],
      ['run', 'typecheck'],
      ['run', 'pyright'],
    ]);
  });

  it('runNamedTask throws MissingTaskError when a task is absent', async () => {
    await expect(runnerFor('python-uv-basic').runNamedTask('missing')).rejects.toBeInstanceOf(MissingTaskError);
  });

  it('runNamedTask returns a skipped result when missingTaskBehavior=skip', async () => {
    const result = await runnerFor('python-uv-basic').runNamedTask('missing', { missingTaskBehavior: 'skip' });

    expect(result).toMatchObject({
      skipped: true,
      command: [],
      skipReason: 'Task "missing" is not defined for this python-uv repository.',
    });
  });

  it('runBuild throws or skips for uv projects without build metadata', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = runnerFor('python-uv-no-build', executor);

    await expect(runner.runBuild()).rejects.toBeInstanceOf(MissingTaskError);
    await expect(runner.runBuild({ missingTaskBehavior: 'skip' })).resolves.toMatchObject({
      skipped: true,
      command: [],
    });
    expect(executor.calls).toEqual([]);
  });
});
