import { describe, expect, it } from 'vitest';

import { RepoRunnerError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { createDefaultRepoRunnerRegistry } from '../../../src/repo-runner/registry/createDefaultRegistry.js';
import { RepoRunnerRegistry } from '../../../src/repo-runner/registry/RepoRunnerRegistry.js';
import { GoRepoRunner } from '../../../src/repo-runner/runners/golang/GoRepoRunner.js';
import { NodeTypescriptRepoRunner } from '../../../src/repo-runner/runners/node-typescript/NodeTypescriptRepoRunner.js';
import { PythonRepoRunner } from '../../../src/repo-runner/runners/python/PythonRepoRunner.js';
import { TerraformRepoRunner } from '../../../src/repo-runner/runners/terraform/TerraformRepoRunner.js';
import { ChildProcessCommandExecutor } from '../../../src/shared/index.js';
import { fixturePath, makeTempDir, RecordingCommandExecutor } from '../helpers/testUtils.js';

describe('RepoRunnerRegistry', () => {
  const executor = new RecordingCommandExecutor();
  const node = (repoPath: string): NodeTypescriptRepoRunner => new NodeTypescriptRepoRunner(repoPath, { executor });
  const python = (repoPath: string): PythonRepoRunner => new PythonRepoRunner(repoPath, { executor });

  it('registers factories and lists kinds in registration order', () => {
    const registry = new RepoRunnerRegistry();
    registry.register('python-uv', python);
    registry.register('node-typescript', node);

    expect(registry.has('node-typescript')).toBe(true);
    expect(registry.has('golang')).toBe(false);
    expect(registry.kinds()).toEqual(['python-uv', 'node-typescript']);
  });

  it('replaces a factory registered under an existing kind without changing its priority', () => {
    const registry = new RepoRunnerRegistry();
    registry.register('first', node);
    registry.register('second', python);
    registry.register('first', python);

    expect(registry.kinds()).toEqual(['first', 'second']);
    expect(registry.create('first', fixturePath('python-uv-basic'))).toBeInstanceOf(PythonRepoRunner);
  });

  it('creates a runner by explicit kind', () => {
    const registry = new RepoRunnerRegistry();
    registry.register('node-typescript', node);

    expect(registry.create('node-typescript', fixturePath('node-basic'))).toBeInstanceOf(NodeTypescriptRepoRunner);
  });

  it('throws when kind is not registered', () => {
    expect(() => new RepoRunnerRegistry().create('missing', '/tmp/repo')).toThrow(RepoRunnerError);
  });

  it('detects the first compatible runner in registration order', async () => {
    const registry = new RepoRunnerRegistry();
    registry.register('python-uv', python);
    registry.register('node-typescript', node);

    await expect(registry.detect(fixturePath('python-uv-basic'))).resolves.toBeInstanceOf(PythonRepoRunner);
    await expect(registry.detect(fixturePath('node-basic'))).resolves.toBeInstanceOf(NodeTypescriptRepoRunner);
  });

  it('throws when no runner detects compatibility', async () => {
    const registry = new RepoRunnerRegistry();
    registry.register('node-typescript', node);

    await expect(registry.detect(fixturePath('python-non-uv'))).rejects.toBeInstanceOf(RepoRunnerError);
  });
});

describe('createDefaultRepoRunnerRegistry', () => {
  it('registers every built-in runner and each factory produces a runner of that kind', () => {
    const registry = createDefaultRepoRunnerRegistry({ executor: new RecordingCommandExecutor() });

    expect(registry.kinds()).toEqual(['node-typescript', 'python-uv', 'golang', 'terraform']);
    for (const kind of registry.kinds()) {
      expect(registry.create(kind, '/tmp/repo').kind).toBe(kind);
    }
  });

  it.each([
    ['node-basic', NodeTypescriptRepoRunner],
    ['python-uv-basic', PythonRepoRunner],
    ['go-basic', GoRepoRunner],
    ['terraform-basic', TerraformRepoRunner],
  ])('detects %s', async (fixture, runnerClass) => {
    const registry = createDefaultRepoRunnerRegistry({ executor: new RecordingCommandExecutor() });

    await expect(registry.detect(fixturePath(fixture))).resolves.toBeInstanceOf(runnerClass);
  });

  it('rejects a repository no built-in runner recognises', async () => {
    await expect(createDefaultRepoRunnerRegistry().detect(await makeTempDir('empty'))).rejects.toBeInstanceOf(
      RepoRunnerError,
    );
  });

  it('shares the executor and runner options across runners', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = await createDefaultRepoRunnerRegistry({ executor, defaultTimeoutMs: 5_000 }).detect(
      fixturePath('go-basic'),
    );

    await runner.runTest();

    expect(executor.calls[0]?.options?.timeoutMs).toBe(5_000);
  });

  it('defaults to one real command executor shared by every runner', () => {
    const registry = createDefaultRepoRunnerRegistry();
    const executor: unknown = Reflect.get(registry.create('golang', '/tmp/repo'), 'executor');

    expect(executor).toBeInstanceOf(ChildProcessCommandExecutor);
    for (const kind of registry.kinds()) {
      expect(Reflect.get(registry.create(kind, '/tmp/repo'), 'executor')).toBe(executor);
    }
  });
});
