import { cp, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CommandExecutionOptions, CommandExecutionResult, CommandExecutor } from '../../../src/shared/index.js';
import { omitUndefined } from '../../../src/shared/objects.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

/** Creates an empty temporary directory. */
export function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `repo-runner-${prefix}-`));
}

/** Copies a fixture into a fresh temporary directory so real commands cannot modify the checked-in fixture. */
export async function copyFixture(name: string): Promise<string> {
  const target = await makeTempDir(name);
  await cp(fixturePath(name), target, { recursive: true });
  return target;
}

export interface RecordedCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options?: CommandExecutionOptions;
}

type ResultFactory = (
  binary: string,
  args: readonly string[],
  options?: CommandExecutionOptions,
) => CommandExecutionResult | Promise<CommandExecutionResult>;

/** A result for `binary args` run in `cwd`; `overrides` replace any field (e.g. `exitCode`, `stdout`). */
export function commandResult(
  binary: string,
  args: readonly string[],
  cwd: string,
  overrides: Partial<CommandExecutionResult> = {},
): CommandExecutionResult {
  return {
    binary,
    args: [...args],
    command: [binary, ...args],
    cwd,
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    durationMs: 0,
    timedOut: false,
    ...overrides,
  };
}

/** Fake {@link CommandExecutor} that records every call and returns a successful result (or `resultFactory`'s). */
export class RecordingCommandExecutor implements CommandExecutor {
  public readonly calls: RecordedCall[] = [];
  readonly #resultFactory: ResultFactory | undefined;

  public constructor(resultFactory?: ResultFactory) {
    this.#resultFactory = resultFactory;
  }

  public async run(
    binary: string,
    args: readonly string[],
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    this.calls.push({ binary, args: [...args], ...omitUndefined({ options }) });
    return this.#resultFactory?.(binary, args, options) ?? commandResult(binary, args, options?.cwd ?? process.cwd());
  }
}

export function withProcessPlatform<T>(platform: NodeJS.Platform, callback: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  if (!descriptor) {
    throw new Error('process.platform descriptor was not available.');
  }

  Object.defineProperty(process, 'platform', { configurable: true, value: platform });
  try {
    return callback();
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
  }
}
