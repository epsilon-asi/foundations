import { devNull } from 'node:os';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CargoRepoRunner,
  createRegistryWithCargo,
} from '../../../examples/repo-runner/custom-runner/cargoRepoRunner.js';
import { verifyNodeRepository } from '../../../examples/repo-runner/node-usage.js';
import { describeRepository } from '../../../examples/repo-runner/registry-usage.js';
import { MissingTaskError, RepoConfigParseError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

async function cargoRepo(manifest: string, withLockfile: boolean): Promise<string> {
  const repoPath = await makeTempDir('cargo');
  await writeFile(path.join(repoPath, 'Cargo.toml'), manifest, 'utf8');
  if (withLockfile) {
    await writeFile(path.join(repoPath, 'Cargo.lock'), 'version = 3\n', 'utf8');
  }
  return repoPath;
}

describe('examples/node-usage', () => {
  it('installs, then runs lint/test/build, skipping scripts the repository lacks', async () => {
    const executor = new RecordingCommandExecutor();

    const results = await verifyNodeRepository(fixturePath('node-no-build-script'), { executor });

    expect(executor.calls.map((call) => [call.binary, ...call.args])).toEqual([
      ['npm', 'install'],
      ['npm', 'test'],
    ]);
    expect(executor.calls[0]?.options?.timeoutMs).toBe(600_000);
    expect(results.map((result) => result.skipped)).toEqual([false, true, false, true]);
  });
});

describe('examples/registry-usage', () => {
  it('summarises a detected repository', async () => {
    await expect(
      describeRepository(fixturePath('go-basic'), { executor: new RecordingCommandExecutor() }),
    ).resolves.toEqual({
      kind: 'golang',
      installPlan: { binary: 'go', args: ['mod', 'download'], mode: 'download' },
      tasks: {
        test: 'go test ./...',
        build: `go build -o ${devNull} ./...`,
        vet: 'go vet ./...',
        generate: 'go generate ./...',
        tidy: 'go mod tidy',
      },
    });
  });
});

describe('examples/custom-runner (cargo)', () => {
  it('is picked by the extended registry and parses the manifest', async () => {
    const repoPath = await cargoRepo('[package]\nname = "demo"\nversion = "0.1.0"\n', true);
    const registry = createRegistryWithCargo({ executor: new RecordingCommandExecutor() });

    const runner = await registry.detect(repoPath);

    expect(runner).toBeInstanceOf(CargoRepoRunner);
    await expect(runner.getRepoConfig()).resolves.toEqual({
      kind: 'rust-cargo',
      packageName: 'demo',
      isWorkspace: false,
      lockfile: 'Cargo.lock',
    });
    expect(registry.kinds().at(-1)).toBe('rust-cargo');
  });

  it('builds the install plan from the config and runs tasks through the executor', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new CargoRepoRunner(await cargoRepo('[workspace]\nmembers = ["a"]\n', false), { executor });

    await expect(runner.getRepoConfig()).resolves.toMatchObject({
      packageName: null,
      isWorkspace: true,
      lockfile: null,
    });
    await runner.installDependencies();
    await runner.runTest({ args: ['my_filter'] });
    await runner.runNamedTask('clippy');

    expect(executor.calls.map((call) => [call.binary, ...call.args])).toEqual([
      ['cargo', 'fetch'],
      ['cargo', 'test', 'my_filter'],
      ['cargo', 'clippy', '--all-targets'],
    ]);
    await expect(runner.runNamedTask('deploy')).rejects.toBeInstanceOf(MissingTaskError);
    await expect(
      new CargoRepoRunner(await cargoRepo('[package]\nname = "demo"\n', true)).getPreferredInstallPlan(),
    ).resolves.toEqual({ binary: 'cargo', args: ['fetch', '--locked'], mode: 'fetch' });
  });

  it('reports an invalid manifest as RepoConfigParseError', async () => {
    const runner = new CargoRepoRunner(await cargoRepo('[package]\nname = 1\n', false));

    await expect(runner.getRepoConfig()).rejects.toBeInstanceOf(RepoConfigParseError);
  });
});
