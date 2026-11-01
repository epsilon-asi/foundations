import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import {
  mergeEnvironment,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type CommandExecutor,
} from './command.js';
import { CommandExecutionError } from './errors.js';

/** Delay between SIGTERM and SIGKILL when a command exceeds its timeout. */
export const KILL_GRACE_PERIOD_MS = 250;

type OutputStream = 'stdout' | 'stderr';

/**
 * Spawns binaries directly with `node:child_process` (never through a shell) and captures UTF-8 output.
 *
 * - Non-zero exits resolve normally; check `exitCode` or use `isSuccessfulResult`.
 * - `timeoutMs` sends SIGTERM, then SIGKILL after {@link KILL_GRACE_PERIOD_MS}; the result has `timedOut: true`.
 * - Spawn failures (e.g. `ENOENT`), aborts, and output over `maxOutputBytes` reject with `CommandExecutionError`.
 */
export class ChildProcessCommandExecutor implements CommandExecutor {
  run(binary: string, args: readonly string[], options: CommandExecutionOptions = {}): Promise<CommandExecutionResult> {
    const { cwd = process.cwd(), env, stdin, timeoutMs, signal, maxOutputBytes = Number.POSITIVE_INFINITY } = options;
    const context = { binary, args, cwd };
    const startedAt = performance.now();

    return new Promise<CommandExecutionResult>((resolve, reject) => {
      const fail = (message: string, cause: unknown): CommandExecutionError =>
        new CommandExecutionError(`${message}: ${binary}`, context, { cause });

      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(binary, args, { cwd, env: mergeEnvironment(process.env, env), signal, windowsHide: true });
      } catch (cause: unknown) {
        reject(fail('Failed to spawn command', cause));
        return;
      }

      const output: Record<OutputStream, Buffer[]> = { stdout: [], stderr: [] };
      const outputBytes: Record<OutputStream, number> = { stdout: 0, stderr: 0 };
      let timedOut = false;
      let settled = false;
      let timeoutTimer: NodeJS.Timeout | undefined;
      let killTimer: NodeJS.Timeout | undefined;

      // 'error' and 'close' can both fire for one process; only the first outcome counts.
      const settle = (complete: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(killTimer);
        complete();
      };
      const collect =
        (stream: OutputStream) =>
        (chunk: Buffer): void => {
          outputBytes[stream] += chunk.length;
          if (outputBytes[stream] > maxOutputBytes) {
            child.kill('SIGKILL');
            settle(() => reject(fail(`Command wrote more than ${maxOutputBytes} bytes to ${stream}`, undefined)));
            return;
          }
          output[stream].push(chunk);
        };

      child.stdout.on('data', collect('stdout'));
      child.stderr.on('data', collect('stderr'));
      // The child may exit before consuming stdin; the resulting EPIPE is not a command failure.
      child.stdin.on('error', () => undefined);

      child.once('error', (cause: Error) => {
        settle(() => reject(fail(signal?.aborted === true ? 'Command aborted' : 'Failed to execute command', cause)));
      });
      child.once('close', (exitCode: number | null, exitSignal: NodeJS.Signals | null) => {
        settle(() =>
          resolve({
            binary,
            args: [...args],
            command: [binary, ...args],
            cwd,
            exitCode,
            signal: exitSignal,
            stdout: Buffer.concat(output.stdout).toString('utf8'),
            stderr: Buffer.concat(output.stderr).toString('utf8'),
            durationMs: Math.round(performance.now() - startedAt),
            timedOut,
          }),
        );
      });

      child.stdin.end(stdin);

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_PERIOD_MS);
        }, timeoutMs);
      }
    });
  }
}
