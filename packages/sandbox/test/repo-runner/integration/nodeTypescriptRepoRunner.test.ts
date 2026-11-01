import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MissingTaskError, UnsupportedRepositoryError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { NodeTypescriptRepoRunner } from '../../../src/repo-runner/runners/node-typescript/NodeTypescriptRepoRunner.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

function runnerFor(fixture: string, executor = new RecordingCommandExecutor()): NodeTypescriptRepoRunner {
  return new NodeTypescriptRepoRunner(fixturePath(fixture), { executor });
}

async function repoWithManifest(manifest: unknown): Promise<string> {
  const repoPath = await makeTempDir('node');
  await writeFile(path.join(repoPath, 'package.json'), JSON.stringify(manifest), 'utf8');
  return repoPath;
}

describe('NodeTypescriptRepoRunner', () => {
  it('detect returns true for repos with package.json', async () => {
    await expect(runnerFor('node-basic').detect()).resolves.toBe(true);
  });

  it('detect returns false for non-node repos', async () => {
    const runner = runnerFor('python-uv-basic');

    await expect(runner.detect()).resolves.toBe(false);
    await expect(runner.getRepoConfig()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
  });

  it('getRepoConfig returns scripts, versions, lockfile, and tsconfig metadata', async () => {
    const config = await runnerFor('node-basic').getRepoConfig();

    expect(config.kind).toBe('node-typescript');
    expect(config.manifest.name).toBe('node-basic-fixture');
    expect(config.versions.devDependencies.typescript).toBe('^5.6.3');
    expect(config.scripts.hello).toBe('node scripts/hello.js');
    expect(config.lockfile).toBeNull();
    expect(config.typescriptConfigPath).toBe(path.resolve(fixturePath('node-basic'), 'tsconfig.json'));
    expect(config.isTypescriptRepo).toBe(true);
  });

  it('detects package-lock.json and prefers npm-shrinkwrap.json', async () => {
    await expect(runnerFor('node-with-lockfile').getRepoConfig()).resolves.toMatchObject({
      lockfile: 'package-lock.json',
    });

    const repoPath = await repoWithManifest({ name: 'shrinkwrapped' });
    await writeFile(path.join(repoPath, 'package-lock.json'), '{}', 'utf8');
    await writeFile(path.join(repoPath, 'npm-shrinkwrap.json'), '{}', 'utf8');
    await expect(new NodeTypescriptRepoRunner(repoPath).getRepoConfig()).resolves.toMatchObject({
      lockfile: 'npm-shrinkwrap.json',
    });
  });

  it('getPreferredInstallPlan returns npm install when no lockfile exists', async () => {
    await expect(runnerFor('node-basic').getPreferredInstallPlan()).resolves.toEqual({
      binary: 'npm',
      args: ['install'],
      mode: 'install',
    });
  });

  it('getPreferredInstallPlan returns npm ci when a lockfile exists', async () => {
    await expect(runnerFor('node-with-lockfile').getPreferredInstallPlan()).resolves.toEqual({
      binary: 'npm',
      args: ['ci'],
      mode: 'ci',
    });
  });

  it('installDependencies executes the chosen install plan', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('node-with-lockfile', executor).installDependencies({ additionalArgs: ['--ignore-scripts'] });

    expect(executor.calls).toEqual([
      {
        binary: 'npm',
        args: ['ci', '--ignore-scripts'],
        options: { cwd: path.resolve(fixturePath('node-with-lockfile')), timeoutMs: 120_000 },
      },
    ]);
  });

  it('runTest executes npm test with args forwarded after --', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('node-basic', executor).runTest({ args: ['--runInBand'] });

    expect(executor.calls[0]?.args).toEqual(['test', '--', '--runInBand']);
  });

  it('runBuild executes npm run build when build script exists', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('node-basic', executor).runBuild();

    expect(executor.calls[0]).toMatchObject({ binary: 'npm', args: ['run', 'build'] });
  });

  it('getTaskDefinitions returns the package scripts map', async () => {
    await expect(runnerFor('node-basic').getTaskDefinitions()).resolves.toEqual({
      test: 'node scripts/test.js',
      build: 'node scripts/build.js',
      lint: 'node scripts/lint.js',
      typecheck: 'node scripts/typecheck.js',
      hello: 'node scripts/hello.js',
    });
  });

  it('getScriptDefinitions and hasScript expose the scripts', async () => {
    const runner = runnerFor('node-no-build-script');

    await expect(runner.getScriptDefinitions()).resolves.toEqual({ test: 'node scripts/test.js' });
    await expect(runner.hasScript('test')).resolves.toBe(true);
    await expect(runner.hasScript('build')).resolves.toBe(false);
    await expect(runner.hasScript('toString')).resolves.toBe(false);
  });

  it('runLint and runTypecheck execute their scripts', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = runnerFor('node-basic', executor);

    await runner.runLint();
    await runner.runTypecheck({ args: ['--pretty'] });

    expect(executor.calls.map((call) => call.args)).toEqual([
      ['run', 'lint'],
      ['run', 'typecheck', '--', '--pretty'],
    ]);
  });

  it('runNamedTask executes npm run <name> with forwarded args', async () => {
    const executor = new RecordingCommandExecutor();

    await runnerFor('node-basic', executor).runNamedTask('hello', { args: ['--flag'] });

    expect(executor.calls[0]?.args).toEqual(['run', 'hello', '--', '--flag']);
  });

  it('runNamedTask and runBuild throw MissingTaskError when the script is absent', async () => {
    const runner = runnerFor('node-no-build-script');

    await expect(runner.runNamedTask('build')).rejects.toBeInstanceOf(MissingTaskError);
    await expect(runner.runBuild()).rejects.toMatchObject({ taskName: 'build', availableTasks: ['test'] });
  });

  it('runBuild / runNamedTask return a skipped result when missingTaskBehavior=skip', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = runnerFor('node-no-build-script', executor);

    for (const result of [
      await runner.runBuild({ missingTaskBehavior: 'skip' }),
      await runner.runNamedTask('build', { missingTaskBehavior: 'skip' }),
    ]) {
      expect(result).toMatchObject({
        skipped: true,
        command: [],
        skipReason: 'Task "build" is not defined for this node-typescript repository.',
      });
    }
    expect(executor.calls).toEqual([]);
  });

  it('getTypescriptConfig returns the parsed tsconfig when present (memoized)', async () => {
    const runner = runnerFor('node-basic');

    const config = await runner.getTypescriptConfig();

    expect(config).toMatchObject({ compilerOptions: { target: 'ES2022' } });
    await expect(runner.getTypescriptConfig()).resolves.toBe(config);
  });

  it('getTypescriptConfig returns null when tsconfig is absent', async () => {
    await expect(runnerFor('node-no-tsconfig').getTypescriptConfig()).resolves.toBeNull();
  });

  it('marks repos as TypeScript when scripts invoke TypeScript tools even without tsconfig', async () => {
    const repoPath = await repoWithManifest({ name: 'ts-signal', scripts: { build: 'tsc -p tsconfig.build.json' } });

    await expect(new NodeTypescriptRepoRunner(repoPath).getRepoConfig()).resolves.toMatchObject({
      isTypescriptRepo: true,
    });
  });

  it('marks repos as TypeScript when a TypeScript tool is a dependency', async () => {
    const repoPath = await repoWithManifest({ name: 'ts-dep', devDependencies: { tsx: '^4.0.0' } });

    await expect(new NodeTypescriptRepoRunner(repoPath).getRepoConfig()).resolves.toMatchObject({
      isTypescriptRepo: true,
    });
  });

  it('does not mark plain JavaScript repos as TypeScript', async () => {
    await expect(runnerFor('node-no-tsconfig').getRepoConfig()).resolves.toMatchObject({ isTypescriptRepo: false });
  });

  it('getDeclaredDependencyVersion checks all dependency buckets', async () => {
    const runner = runnerFor('node-basic');

    await expect(runner.getDeclaredDependencyVersion('left-pad')).resolves.toBe('1.3.0');
    await expect(runner.getDeclaredDependencyVersion('typescript')).resolves.toBe('^5.6.3');
    await expect(runner.getDeclaredDependencyVersion('react')).resolves.toBe('^18.3.0');
    await expect(runner.getDeclaredDependencyVersion('fsevents')).resolves.toBe('^2.3.3');
    await expect(runner.getDeclaredDependencyVersion('missing')).resolves.toBeNull();
  });

  it('getVersionSnapshot exposes declared versions', async () => {
    await expect(runnerFor('node-basic').getVersionSnapshot()).resolves.toMatchObject({
      name: 'node-basic-fixture',
      engines: { node: '>=20' },
      dependencies: { 'left-pad': '1.3.0' },
    });
  });
});
