import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { InstallPlan, TaskCommand, TaskTable } from '../../../src/repo-runner/contracts/runner.js';
import { MissingTaskError, UnsupportedRepositoryError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { AbstractRepoRunner, DEFAULT_TASK_TIMEOUT_MS } from '../../../src/repo-runner/runners/AbstractRepoRunner.js';
import {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  CommandFailedError,
  type CommandExecutionResult,
} from '../../../src/shared/index.js';
import { commandResult, fixturePath, RecordingCommandExecutor } from '../helpers/testUtils.js';

interface ExampleConfig {
  readonly kind: 'example';
  readonly withLint: boolean;
}

const TASKS: TaskTable = new Map([
  ['test', { binary: 'tool', args: ['test'] }],
  ['build', { binary: 'tool', args: ['build'], trailingArgs: ['./all'], description: 'Builds everything' }],
]);

class ExampleRunner extends AbstractRepoRunner<ExampleConfig> {
  public readonly kind = 'example';
  public detected = true;
  public loads = 0;
  public failNextLoad = false;

  public async detect(): Promise<boolean> {
    return this.detected;
  }

  public callResolvePath(relativePath: string): string {
    return this.resolvePath(relativePath);
  }

  public callHasFile(relativePath: string): Promise<boolean> {
    return this.hasFile(relativePath);
  }

  public callRunCommand(binary: string, args: readonly string[]): Promise<CommandExecutionResult> {
    return this.runCommand(binary, args);
  }

  protected async loadRepoConfig(): Promise<ExampleConfig> {
    this.loads += 1;
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error('load failed');
    }
    return { kind: 'example', withLint: this.loads > 1 };
  }

  protected resolveTasks(config: ExampleConfig): TaskTable {
    return config.withLint ? new Map([...TASKS, ['lint', { binary: 'tool', args: ['lint'] }]]) : TASKS;
  }

  protected resolveInstallPlan(): InstallPlan {
    return { binary: 'tool', args: ['install'], mode: 'install' };
  }
}

const repoPath = fixturePath('node-basic');

/** A runner whose executor returns `overrides` merged into a result for each command. */
function runnerReturning(overrides: Partial<CommandExecutionResult>): ExampleRunner {
  const executor = new RecordingCommandExecutor((binary, args, options) =>
    commandResult(binary, args, options?.cwd ?? repoPath, overrides),
  );
  return new ExampleRunner(repoPath, { executor });
}

describe('AbstractRepoRunner', () => {
  it('resolves the repo path and defaults to the real executor and default timeout', () => {
    const runner = new ExampleRunner(path.join(repoPath, 'scripts', '..'));

    expect(runner.repoPath).toBe(path.resolve(repoPath));
    expect(Reflect.get(runner, 'executor')).toBeInstanceOf(ChildProcessCommandExecutor);
    expect(Reflect.get(runner, 'defaultTimeoutMs')).toBe(DEFAULT_TASK_TIMEOUT_MS);
  });

  it('assertDetected throws UnsupportedRepositoryError when detect() returns false', async () => {
    const runner = new ExampleRunner(repoPath, { executor: new RecordingCommandExecutor() });
    runner.detected = false;

    await expect(runner.assertDetected()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
    await expect(runner.getRepoConfig()).rejects.toBeInstanceOf(UnsupportedRepositoryError);
    expect(runner.loads).toBe(0);
  });

  it('memoizes the repo config across calls', async () => {
    const runner = new ExampleRunner(repoPath, { executor: new RecordingCommandExecutor() });

    const [first, second] = await Promise.all([runner.getRepoConfig(), runner.getRepoConfig()]);
    await runner.getTaskDefinitions();

    expect(first).toBe(second);
    expect(runner.loads).toBe(1);
  });

  it('retries loading after a failed attempt', async () => {
    const runner = new ExampleRunner(repoPath, { executor: new RecordingCommandExecutor() });
    runner.failNextLoad = true;

    await expect(runner.getRepoConfig()).rejects.toThrow('load failed');
    await expect(runner.getRepoConfig()).resolves.toEqual({ kind: 'example', withLint: true });
    expect(runner.loads).toBe(2);
  });

  it('getTaskDefinitions describes each task by its description or command line', async () => {
    const runner = new ExampleRunner(repoPath, { executor: new RecordingCommandExecutor() });

    await expect(runner.getTaskDefinitions()).resolves.toEqual({ test: 'tool test', build: 'Builds everything' });
  });

  it('runs named tasks in the repo root with the default timeout and forwarded args, without runner options', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor, defaultTimeoutMs: 1_000 });

    const result = await runner.runNamedTask('build', {
      args: ['-v'],
      missingTaskBehavior: 'error',
      allowNonZeroExit: false,
      trimStdout: false,
      stdin: 'x',
    });

    expect(executor.calls).toEqual([
      {
        binary: 'tool',
        args: ['build', '-v', './all'],
        options: { cwd: path.resolve(repoPath), timeoutMs: 1_000, stdin: 'x' },
      },
    ]);
    expect(result).toEqual({ ...commandResult('tool', ['build', '-v', './all'], repoPath), skipped: false });
  });

  it('lets per-call execution options override cwd and timeout and passes executor options through', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor });
    const signal = new AbortController().signal;

    await runner.runTest({ cwd: '/elsewhere', timeoutMs: 5, env: { CI: '1' }, signal, maxOutputBytes: 10 });

    expect(executor.calls[0]?.options).toEqual({
      cwd: '/elsewhere',
      timeoutMs: 5,
      env: { CI: '1' },
      signal,
      maxOutputBytes: 10,
    });
  });

  it('runTest and runBuild delegate to runNamedTask', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor });

    await runner.runTest();
    await runner.runBuild();

    expect(executor.calls.map((call) => call.args)).toEqual([['test'], ['build', './all']]);
  });

  it('throws MissingTaskError listing the available tasks for an unknown task', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor });

    await expect(runner.runNamedTask('deploy')).rejects.toThrow(
      new MissingTaskError('deploy', path.resolve(repoPath), ['test', 'build']),
    );
    expect(executor.calls).toEqual([]);
  });

  it('returns a skipped result without running anything when missingTaskBehavior=skip', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor });

    const result = await runner.runNamedTask('deploy', { missingTaskBehavior: 'skip' });

    expect(result).toEqual({
      binary: '',
      args: [],
      command: [],
      cwd: path.resolve(repoPath),
      exitCode: 0,
      signal: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      skipped: true,
      skipReason: 'Task "deploy" is not defined for this example repository.',
    });
    expect(executor.calls).toEqual([]);
  });

  it('appends additionalArgs to the install plan and runs it without leaking runner options', async () => {
    const executor = new RecordingCommandExecutor();
    const runner = new ExampleRunner(repoPath, { executor });

    await expect(runner.getPreferredInstallPlan()).resolves.toEqual({
      binary: 'tool',
      args: ['install'],
      mode: 'install',
    });
    await runner.installDependencies({
      additionalArgs: ['--frozen'],
      env: { CI: '1' },
      allowNonZeroExit: true,
      trimStdout: true,
    });

    expect(executor.calls).toEqual([
      {
        binary: 'tool',
        args: ['install', '--frozen'],
        options: { cwd: path.resolve(repoPath), timeoutMs: DEFAULT_TASK_TIMEOUT_MS, env: { CI: '1' } },
      },
    ]);
  });

  it('resolves and checks repo-relative paths', async () => {
    const runner = new ExampleRunner(repoPath, { executor: new RecordingCommandExecutor() });

    expect(runner.callResolvePath('package.json')).toBe(path.resolve(repoPath, 'package.json'));
    await expect(runner.callHasFile('package.json')).resolves.toBe(true);
    await expect(runner.callHasFile('missing.json')).resolves.toBe(false);
  });
});

describe('AbstractRepoRunner result policy', () => {
  it.each([
    ['a non-zero exit', { exitCode: 2, stderr: 'boom\n' }, 'Running task "test": tool test failed (exit code 2)\nboom'],
    [
      'a signal kill',
      { exitCode: null, signal: 'SIGKILL' as const },
      'Running task "test": tool test failed (signal SIGKILL)',
    ],
    [
      'a timeout',
      { exitCode: null, signal: 'SIGTERM' as const, timedOut: true },
      'Running task "test": tool test failed (timed out)',
    ],
    [
      'a timeout despite exit code 0',
      { exitCode: 0, timedOut: true },
      'Running task "test": tool test failed (timed out)',
    ],
  ])('throws CommandFailedError naming the task for %s', async (_case, overrides, message) => {
    const runner = runnerReturning({ ...overrides, stdout: '  out  ' });

    const error: unknown = await runner.runTest().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error).toMatchObject({
      message,
      result: { ...overrides, command: ['tool', 'test'], stdout: '  out  ', skipped: false },
    });
  });

  it('names the install step when installing dependencies fails', async () => {
    await expect(runnerReturning({ exitCode: 1 }).installDependencies()).rejects.toThrow(
      'Installing dependencies: tool install failed (exit code 1)',
    );
  });

  it('uses the generic message for commands run by subclasses without a failure message', async () => {
    await expect(runnerReturning({ exitCode: 3 }).callRunCommand('tool', ['custom'])).rejects.toThrow(
      /^tool custom failed \(exit code 3\)$/,
    );
  });

  it.each([
    ['a non-zero exit', { exitCode: 2 }],
    ['a signal kill', { exitCode: null, signal: 'SIGKILL' as const }],
    ['a timeout', { exitCode: null, signal: 'SIGTERM' as const, timedOut: true }],
  ])('returns the result for %s when allowNonZeroExit is set', async (_case, overrides) => {
    const runner = runnerReturning(overrides);

    await expect(runner.runTest({ allowNonZeroExit: true })).resolves.toMatchObject({ ...overrides, skipped: false });
    await expect(runner.installDependencies({ allowNonZeroExit: true })).resolves.toMatchObject(overrides);
  });

  it('trims stdout only when trimStdout is set, including on the error result', async () => {
    const runner = runnerReturning({ stdout: '\n  value \n', stderr: ' kept ' });

    await expect(runner.runTest()).resolves.toMatchObject({ stdout: '\n  value \n', stderr: ' kept ' });
    await expect(runner.runTest({ trimStdout: true })).resolves.toMatchObject({ stdout: 'value', stderr: ' kept ' });
    await expect(runner.installDependencies({ trimStdout: true })).resolves.toMatchObject({ stdout: 'value' });
    await expect(runnerReturning({ exitCode: 1, stdout: ' out ' }).runTest({ trimStdout: true })).rejects.toMatchObject(
      { result: { stdout: 'out' } },
    );
  });

  it('propagates CommandExecutionError from the executor unchanged, even with allowNonZeroExit', async () => {
    const spawnError = new CommandExecutionError('Failed to execute command: tool', {
      binary: 'tool',
      args: ['test'],
      cwd: repoPath,
    });
    const executor = new RecordingCommandExecutor(() => Promise.reject(spawnError));
    const runner = new ExampleRunner(repoPath, { executor });

    await expect(runner.runTest()).rejects.toBe(spawnError);
    await expect(runner.runTest({ allowNonZeroExit: true })).rejects.toBe(spawnError);
  });
});

describe('AbstractRepoRunner with the real executor', () => {
  class NodeScriptRunner extends AbstractRepoRunner<null> {
    public readonly kind = 'node-script';

    public async detect(): Promise<boolean> {
      return true;
    }

    protected async loadRepoConfig(): Promise<null> {
      return null;
    }

    protected resolveTasks(): TaskTable {
      const node = (script: string): TaskCommand => ({ binary: process.execPath, args: ['-e', script] });
      return new Map([
        ['echo', node('process.stdout.write(`  ${process.argv.slice(1).join(" ")}  \\n`)')],
        ['fail', node('process.stderr.write("broken"); process.exit(4)')],
        ['hang', node('setInterval(() => {}, 1000)')],
      ]);
    }

    protected resolveInstallPlan(): InstallPlan {
      return { binary: process.execPath, args: ['-e', ''], mode: 'none' };
    }
  }

  const runner = new NodeScriptRunner(repoPath);

  it('runs tasks in the repo root, forwards args, and trims stdout on request', async () => {
    await expect(runner.runNamedTask('echo', { args: ['a', 'b'], trimStdout: true })).resolves.toMatchObject({
      exitCode: 0,
      cwd: path.resolve(repoPath),
      stdout: 'a b',
      skipped: false,
    });
    await expect(runner.installDependencies()).resolves.toMatchObject({ exitCode: 0 });
  });

  it('throws CommandFailedError for non-zero exits and timeouts unless allowNonZeroExit is set', async () => {
    await expect(runner.runNamedTask('fail')).rejects.toThrow(
      new RegExp(`^Running task "fail": .+ failed \\(exit code 4\\)\\nbroken$`),
    );
    await expect(runner.runNamedTask('fail', { allowNonZeroExit: true })).resolves.toMatchObject({
      exitCode: 4,
      stderr: 'broken',
    });
    await expect(runner.runNamedTask('hang', { timeoutMs: 50 })).rejects.toThrow(/failed \(timed out\)$/);
    await expect(runner.runNamedTask('hang', { timeoutMs: 50, allowNonZeroExit: true })).resolves.toMatchObject({
      exitCode: null,
      signal: 'SIGTERM',
      timedOut: true,
    });
  });
});
