import { existsSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ChildProcessCommandExecutor,
  CommandFailedError,
  ContainerCommandExecutor,
  DockerContainerRuntime,
  Sandbox,
  SandboxDisposeError,
  SandboxError,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type CommandExecutor,
} from '../../src/index.js';
import { createTestRepository, RecordingContainerRuntime, type TestRepository } from './helpers.js';

let repo: TestRepository;

beforeEach(async () => {
  repo = await createTestRepository();
});

afterEach(async () => {
  await repo.cleanup();
});

function worktreeList(): string {
  return repo.git('worktree', 'list', '--porcelain');
}

describe('Sandbox on the host', () => {
  it('creates a branch worktree and scopes exec, tasks, search, and git to it', async () => {
    const worktreePath = path.join(repo.root, 'sandboxes', 'task-1');
    const sandbox = await Sandbox.create({ repoPath: repo.repoPath, worktreePath, branchName: 'agent/task-1' });

    expect(sandbox.worktreePath).toBe(worktreePath);
    expect(sandbox.worktree).toMatchObject({ branchName: 'agent/task-1', startRef: 'HEAD', overlayApplied: false });
    expect(sandbox.container).toBeUndefined();
    expect(sandbox.executor).toBeInstanceOf(ChildProcessCommandExecutor);

    const cwd = await sandbox.exec(['node', '-e', 'process.stdout.write(process.cwd())']);
    expect(await realpath(cwd.stdout)).toBe(worktreePath);

    const runner = await sandbox.runner();
    expect(runner.kind).toBe('node-typescript');
    expect(await sandbox.runner()).toBe(runner);
    const test = await sandbox.runTask('test');
    expect(test.exitCode).toBe(0);
    expect(test.stdout).toContain('tests ok');

    const search = await sandbox.search();
    expect(search.searchSymbols('greet')[0]?.path).toBe('src/greet.ts');
    expect(await sandbox.search()).toBe(search);

    await writeFile(path.join(worktreePath, 'src', 'added.ts'), 'export const added = 1;\n');
    await writeFile(path.join(worktreePath, 'src', 'greet.ts'), 'export function greet() {\n  return "hi";\n}\n');
    expect((await sandbox.status()).map((entry) => entry.path).sort()).toEqual(['src/added.ts', 'src/greet.ts']);
    expect(await sandbox.diff()).toContain('+  return "hi";');
    expect(await sandbox.changedFiles()).toEqual([{ status: 'M', path: 'src/greet.ts' }]);

    const refreshed = await sandbox.search({ refresh: true });
    expect(refreshed).not.toBe(search);
    expect(refreshed.searchSymbols('added')[0]?.path).toBe('src/added.ts');

    const commit = await sandbox.commit({ message: 'agent: change greet' });
    expect(commit).toMatchObject({ worktreePath, branchName: 'agent/task-1', message: 'agent: change greet' });
    expect(await sandbox.status()).toEqual([]);
    expect(await sandbox.diff({ baseRef: 'main' })).toContain('src/added.ts');

    await sandbox.dispose();
    expect(existsSync(worktreePath)).toBe(false);
    expect(worktreeList()).not.toContain(worktreePath);
    expect(repo.git('rev-parse', 'agent/task-1').trim()).toBe(commit.headSha);
  });

  it('applies and discards changes, stages diffs, and fails tasks with CommandFailedError', async () => {
    const sandbox = await Sandbox.create({ repoPath: repo.repoPath, worktreePath: path.join(repo.root, 'wt') });
    const greet = path.join(sandbox.worktreePath, 'src', 'greet.ts');
    expect(sandbox.worktree.branchName).toBeNull();

    await writeFile(greet, 'export const greet = 1;\n');
    const patch = await sandbox.diff();
    await sandbox.discardChanges();
    expect(await sandbox.diff()).toBe('');

    expect(await sandbox.applyPatch(patch, { index: true })).toMatchObject({ index: true, checkOnly: false });
    expect(await readFile(greet, 'utf8')).toBe('export const greet = 1;\n');
    expect(await sandbox.diff({ staged: true })).toContain('+export const greet = 1;');

    await writeFile(path.join(sandbox.worktreePath, 'scratch.txt'), 'x');
    await sandbox.discardChanges({ removeUntracked: true });
    expect(await sandbox.status()).toEqual([]);

    await writeFile(
      path.join(sandbox.worktreePath, 'package.json'),
      JSON.stringify({ scripts: { test: 'node -e "process.exit(3)"' } }),
    );
    await expect(sandbox.runTask('test')).rejects.toBeInstanceOf(CommandFailedError);
    expect((await sandbox.runTask('test', { allowNonZeroExit: true })).exitCode).toBe(3);
    expect((await sandbox.installDependencies({ allowNonZeroExit: true })).command.slice(1, 2)).toEqual(['install']);

    await sandbox[Symbol.asyncDispose]();
    expect(existsSync(sandbox.worktreePath)).toBe(false);
  });

  it('overlays uncommitted work from the source repository', async () => {
    await writeFile(path.join(repo.repoPath, 'src', 'greet.ts'), 'export const wip = true;\n');
    await writeFile(path.join(repo.repoPath, 'notes.md'), '# notes\n');

    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'overlay'),
      branchName: 'agent/overlay',
      overlayWorkingChanges: true,
      includeUntracked: true,
    });

    expect(sandbox.worktree).toMatchObject({ overlayApplied: true, untrackedFilesCopied: ['notes.md'] });
    expect(await readFile(path.join(sandbox.worktreePath, 'src', 'greet.ts'), 'utf8')).toBe(
      'export const wip = true;\n',
    );
    await sandbox.dispose();
  });

  it('is idempotent to dispose, can keep the worktree, and rejects use after disposal', async () => {
    const sandbox = await Sandbox.create({ repoPath: repo.repoPath, worktreePath: path.join(repo.root, 'kept') });

    await sandbox.dispose({ keepWorktree: true });
    await sandbox.dispose();

    expect(existsSync(sandbox.worktreePath)).toBe(true);
    await expect(sandbox.exec(['node', '--version'])).rejects.toThrow(SandboxError);
    await expect(sandbox.runner()).rejects.toThrow(`Sandbox at ${sandbox.worktreePath} has been disposed`);
    await expect(sandbox.search()).rejects.toThrow(SandboxError);
  });
});

describe('Sandbox with a container', () => {
  it('starts a container on the worktree and runs exec and tasks inside it', async () => {
    const runtime = new RecordingContainerRuntime();
    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'boxed'),
      branchName: 'agent/boxed',
      taskTimeoutMs: 5_000,
      container: { image: 'node:24', preset: 'node-typescript', packageManager: 'pnpm', runtime, user: 'node' },
    });

    expect(runtime.created).toHaveLength(1);
    expect(runtime.created[0]).toMatchObject({
      image: 'node:24',
      workspacePath: sandbox.worktreePath,
      labels: { 'sandbox.profile': 'node-typescript', 'sandbox.package-manager': 'pnpm' },
    });
    expect(sandbox.container).toMatchObject({ id: 'container-1', state: 'running', workspaceMountPath: '/workspace' });
    expect(sandbox.executor).toBeInstanceOf(ContainerCommandExecutor);

    const version = await sandbox.exec(['node', '--version'], { env: { CI: '1' } });
    expect(version).toMatchObject({ command: ['node', '--version'], cwd: '/workspace', stdout: 'ran node --version' });
    expect(runtime.execs[0]).toMatchObject({
      containerId: 'container-1',
      cwd: '/workspace',
      user: 'node',
      env: { CI: '1' },
    });

    await sandbox.runTask('test');
    expect(runtime.execs[1]).toMatchObject({ command: ['npm', 'test'], cwd: '/workspace', timeoutMs: 5_000 });

    // Git and search stay on the host.
    expect(await sandbox.status()).toEqual([]);

    await sandbox.dispose();
    expect(runtime.removed).toEqual([{ containerId: 'container-1', options: { force: true } }]);
    expect(existsSync(sandbox.worktreePath)).toBe(false);
  });

  it('uses the general preset by default and can keep the container on dispose', async () => {
    const runtime = new RecordingContainerRuntime();
    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'general'),
      container: { image: 'alpine:3', runtime, secureDefaults: true },
    });

    expect(runtime.created[0]?.labels).toMatchObject({
      'sandbox.profile': 'general',
      'sandbox.security-profile': 'secure-readonly',
    });
    await sandbox.dispose({ keepContainer: true });
    expect(runtime.removed).toEqual([]);
  });

  it('removes the worktree again when the container cannot start', async () => {
    const runtime = new RecordingContainerRuntime();
    runtime.startError = new Error('no such image');
    const worktreePath = path.join(repo.root, 'failed');

    await expect(
      Sandbox.create({ repoPath: repo.repoPath, worktreePath, container: { image: 'missing', runtime } }),
    ).rejects.toThrow('no such image');

    expect(existsSync(worktreePath)).toBe(false);
    expect(worktreeList()).not.toContain(worktreePath);
  });

  it('attempts every cleanup step and reports failures together', async () => {
    const runtime = new RecordingContainerRuntime();
    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'dispose-error'),
      container: { image: 'node:24', runtime },
    });
    const removeError = new Error('daemon unavailable');
    runtime.removeError = removeError;

    const error: unknown = await sandbox.dispose().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SandboxDisposeError);
    expect(error).toMatchObject({ worktreePath: sandbox.worktreePath, errors: [removeError], cause: removeError });
    expect(existsSync(sandbox.worktreePath)).toBe(false);
    await expect(sandbox.dispose()).resolves.toBeUndefined();
  });

  it('aggregates container and worktree cleanup failures', async () => {
    const host = new ChildProcessCommandExecutor();
    let failWorktreeRemoval = false;
    const executor: CommandExecutor = {
      run: async (binary, args, options) => {
        const result = await host.run(binary, args, options);
        return failWorktreeRemoval && args[0] === 'worktree' && args[1] === 'remove'
          ? { ...result, exitCode: 1 }
          : result;
      },
    };
    const runtime = new RecordingContainerRuntime();
    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'double-failure'),
      executor,
      container: { image: 'node:24', runtime },
    });
    runtime.removeError = new Error('daemon unavailable');
    failWorktreeRemoval = true;

    const error: unknown = await sandbox.dispose().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SandboxDisposeError);
    expect((error as SandboxDisposeError).errors).toEqual([runtime.removeError, expect.any(CommandFailedError)]);
    expect((error as Error).cause).toBeInstanceOf(AggregateError);
  });

  it('defaults to the Docker runtime driven by the host executor', async () => {
    const host = new ChildProcessCommandExecutor();
    const dockerCalls: string[][] = [];
    const executor: CommandExecutor = {
      async run(
        binary: string,
        args: readonly string[],
        options?: CommandExecutionOptions,
      ): Promise<CommandExecutionResult> {
        if (binary !== 'docker') {
          return await host.run(binary, args, options);
        }
        dockerCalls.push([...args]);
        const stdout = args[1] === 'create' ? 'docker-container-id\n' : '';
        return {
          binary,
          args,
          command: [binary, ...args],
          cwd: '.',
          exitCode: 0,
          signal: null,
          stdout,
          stderr: '',
          durationMs: 1,
          timedOut: false,
        };
      },
    };

    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'docker'),
      executor,
      container: { image: 'node:24' },
    });

    expect(new DockerContainerRuntime().kind).toBe('docker');
    expect(sandbox.container?.id).toBe('docker-container-id');
    expect(dockerCalls.map((args) => args.slice(0, 2))).toEqual([
      ['image', 'inspect'],
      ['container', 'create'],
      ['container', 'start'],
    ]);

    await sandbox.exec(['node', '--version']);
    expect(dockerCalls.at(-1)).toEqual([
      'container',
      'exec',
      '--workdir',
      '/workspace',
      'docker-container-id',
      'node',
      '--version',
    ]);

    await sandbox.dispose();
    expect(dockerCalls.at(-1)).toEqual(['container', 'rm', '--force', 'docker-container-id']);
  });
});
