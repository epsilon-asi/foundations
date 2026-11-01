import { devNull } from 'node:os';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MissingTaskError,
  RepoConfigParseError,
  UnsupportedRepositoryError,
} from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { GoRepoRunner } from '../../../src/repo-runner/runners/golang/GoRepoRunner.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

const repoPath = fixturePath('go-basic');

describe('GoRepoRunner', () => {
  it('detects repositories with a go.mod', async () => {
    await expect(new GoRepoRunner(repoPath).detect()).resolves.toBe(true);

    const notGo = new GoRepoRunner(fixturePath('node-basic'));
    await expect(notGo.detect()).resolves.toBe(false);
    await expect(notGo.getRepoConfig()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
  });

  it('reads go.mod directives and go.sum presence', async () => {
    await expect(new GoRepoRunner(repoPath).getRepoConfig()).resolves.toEqual({
      kind: 'golang',
      goModPath: path.join(repoPath, 'go.mod'),
      goMod: { modulePath: 'example.com/gobasic', goVersion: '1.22', toolchain: 'go1.22.5' },
      lockfile: 'go.sum',
    });
  });

  it('reports a missing go.sum and rejects a go.mod without a module directive', async () => {
    const dir = await makeTempDir('go');
    await writeFile(path.join(dir, 'go.mod'), 'module example.com/nosum\n', 'utf8');
    await expect(new GoRepoRunner(dir).getRepoConfig()).resolves.toMatchObject({ lockfile: null });

    const broken = await makeTempDir('go-broken');
    await writeFile(path.join(broken, 'go.mod'), 'go 1.22\n', 'utf8');
    await expect(new GoRepoRunner(broken).getRepoConfig()).rejects.toThrow(
      new RepoConfigParseError(path.join(broken, 'go.mod'), 'missing module directive'),
    );
  });

  it('lists the Go tasks', async () => {
    await expect(new GoRepoRunner(repoPath).getTaskDefinitions()).resolves.toEqual({
      test: 'go test ./...',
      build: `go build -o ${devNull} ./...`,
      vet: 'go vet ./...',
      generate: 'go generate ./...',
      tidy: 'go mod tidy',
    });
  });

  it('installs with go mod download', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new GoRepoRunner(repoPath, { executor });

    await runner.installDependencies({ additionalArgs: ['-x'] });

    expect(executor.calls).toEqual([
      { binary: 'go', args: ['mod', 'download', '-x'], options: { cwd: repoPath, timeoutMs: 120_000 } },
    ]);
    await expect(runner.getPreferredInstallPlan()).resolves.toEqual({
      binary: 'go',
      args: ['mod', 'download'],
      mode: 'download',
    });
  });

  it('places forwarded args before the ./... package pattern', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new GoRepoRunner(repoPath, { executor });

    await runner.runTest({ args: ['-run', 'TestGreet', '-count=1'] });
    await runner.runBuild({ args: ['-v'] });
    await runner.runNamedTask('vet');
    await runner.runNamedTask('generate');
    await runner.runNamedTask('tidy', { args: ['-v'] });

    expect(executor.calls.map((call) => [call.binary, ...call.args])).toEqual([
      ['go', 'test', '-run', 'TestGreet', '-count=1', './...'],
      ['go', 'build', '-o', devNull, '-v', './...'],
      ['go', 'vet', './...'],
      ['go', 'generate', './...'],
      ['go', 'mod', 'tidy', '-v'],
    ]);
  });

  it('throws MissingTaskError for tasks Go does not define', async () => {
    await expect(new GoRepoRunner(repoPath).runNamedTask('lint')).rejects.toBeInstanceOf(MissingTaskError);
  });
});
