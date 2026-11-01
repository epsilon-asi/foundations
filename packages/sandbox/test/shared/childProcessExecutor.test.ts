import { mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import { ChildProcessCommandExecutor, CommandExecutionError } from '../../src/shared/index.js';

const node = process.execPath;
const executor = new ChildProcessCommandExecutor();

describe('ChildProcessCommandExecutor', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('captures stdout and stderr and reports the full command', async () => {
    const script = "process.stdout.write('out'); process.stderr.write('err')";
    const result = await executor.run(node, ['-e', script]);

    expect(result).toMatchObject({
      binary: node,
      args: ['-e', script],
      command: [node, '-e', script],
      cwd: process.cwd(),
      exitCode: 0,
      signal: null,
      stdout: 'out',
      stderr: 'err',
      timedOut: false,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('applies cwd and layers env over process.env, removing undefined keys', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sandbox-executor-'));
    temporaryDirectories.push(directory);
    process.env.SANDBOX_EXECUTOR_INHERITED = 'inherited';
    try {
      const result = await executor.run(
        node,
        [
          '-e',
          'process.stdout.write([process.cwd(), process.env.ADDED, process.env.SANDBOX_EXECUTOR_INHERITED].join("|"))',
        ],
        { cwd: directory, env: { ADDED: 'added', SANDBOX_EXECUTOR_INHERITED: undefined } },
      );

      expect(result.stdout).toBe(`${await realpath(directory)}|added|`);
      expect(result.cwd).toBe(directory);
    } finally {
      delete process.env.SANDBOX_EXECUTOR_INHERITED;
    }
  });

  it('writes stdin to the child', async () => {
    const result = await executor.run(node, ['-e', 'process.stdin.pipe(process.stdout)'], { stdin: 'input-text' });

    expect(result.stdout).toBe('input-text');
  });

  it('keeps multi-byte characters intact across chunk boundaries', async () => {
    const result = await executor.run(node, ['-e', 'process.stdout.write("é".repeat(100000))']);

    expect(result.stdout).toBe('é'.repeat(100000));
  });

  it('reports non-zero exits without throwing', async () => {
    const result = await executor.run(node, ['-e', "process.stderr.write('bad'); process.exit(7)"]);

    expect(result).toMatchObject({ exitCode: 7, signal: null, stderr: 'bad', timedOut: false });
  });

  it('reports a process killed by a signal', async () => {
    const result = await executor.run(node, [
      '-e',
      'process.kill(process.pid, "SIGTERM"); setInterval(() => {}, 1000)',
    ]);

    expect(result).toMatchObject({ exitCode: null, signal: 'SIGTERM', timedOut: false });
  });

  it('terminates a command that exceeds its timeout with SIGTERM', async () => {
    const result = await executor.run(node, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 50 });

    expect(result).toMatchObject({ exitCode: null, signal: 'SIGTERM', timedOut: true });
  });

  it('escalates to SIGKILL when the command ignores SIGTERM', async () => {
    const result = await executor.run(node, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], {
      timeoutMs: 300,
    });

    expect(result).toMatchObject({ exitCode: null, signal: 'SIGKILL', timedOut: true });
  });

  it('rejects with CommandExecutionError when the binary cannot be spawned', async () => {
    const error: unknown = await executor
      .run('sandbox-binary-that-does-not-exist', ['--version'])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error).toMatchObject({
      message: 'Failed to execute command: sandbox-binary-that-does-not-exist',
      binary: 'sandbox-binary-that-does-not-exist',
      args: ['--version'],
      cwd: process.cwd(),
    });
    expect((error as Error).cause).toMatchObject({ code: 'ENOENT' });
  });

  it('rejects synchronous spawn failures with CommandExecutionError', async () => {
    const error: unknown = await executor.run(node, ['bad\u0000arg']).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect((error as Error).message).toBe(`Failed to spawn command: ${node}`);
    expect((error as Error).cause).toBeInstanceOf(TypeError);
  });

  it('kills the command and rejects when the abort signal fires', async () => {
    const controller = new AbortController();
    const running = executor.run(node, ['-e', 'setInterval(() => {}, 1000)'], { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);

    const error: unknown = await running.catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect((error as Error).message).toBe(`Command aborted: ${node}`);
    expect((error as Error).cause).toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately for an already-aborted signal', async () => {
    await expect(
      executor.run(node, ['-e', 'setInterval(() => {}, 1000)'], { signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(CommandExecutionError);
  });

  it('kills the command and rejects once output exceeds maxOutputBytes', async () => {
    const error: unknown = await executor
      .run(node, ['-e', 'process.stdout.write("x".repeat(5000)); setInterval(() => {}, 1000)'], {
        maxOutputBytes: 1000,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandExecutionError);
    expect((error as Error).message).toBe(`Command wrote more than 1000 bytes to stdout: ${node}`);
  });

  it('ignores stdin write errors when the child exits without reading', async () => {
    const result = await executor.run(node, ['-e', 'process.exit(0)'], { stdin: 'x'.repeat(4 * 1024 * 1024) });

    expect(result.exitCode).toBe(0);
  });
});
