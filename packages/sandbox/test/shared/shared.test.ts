import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { mergeEnvironment } from '../../src/shared/command.js';
import { canonicalPath, fileExists, isMissingPathError } from '../../src/shared/fs.js';
import {
  CommandExecutionError,
  CommandFailedError,
  SandboxError,
  commandExists,
  describeOutcome,
  ensureSuccess,
  formatCommand,
  isSuccessfulResult,
  type CommandExecutionResult,
} from '../../src/shared/index.js';
import { isRecord, omitUndefined } from '../../src/shared/objects.js';

const temporaryDirectories: string[] = [];

async function makeTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sandbox-shared-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function resultOf(overrides: Partial<CommandExecutionResult>): CommandExecutionResult {
  return {
    binary: 'tool',
    args: ['run', 'a b'],
    command: ['tool', 'run', 'a b'],
    cwd: '/repo',
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    durationMs: 1,
    timedOut: false,
    ...overrides,
  };
}

describe('command helpers', () => {
  it('treats only exit code 0 without a timeout as success', () => {
    expect(isSuccessfulResult({ exitCode: 0, timedOut: false })).toBe(true);
    expect(isSuccessfulResult({ exitCode: 0, timedOut: true })).toBe(false);
    expect(isSuccessfulResult({ exitCode: 1, timedOut: false })).toBe(false);
    expect(isSuccessfulResult({ exitCode: null, timedOut: false })).toBe(false);
  });

  it('describes exit codes, signals, and timeouts', () => {
    expect(describeOutcome({ exitCode: 2, signal: null, timedOut: false })).toBe('exit code 2');
    expect(describeOutcome({ exitCode: null, signal: 'SIGKILL', timedOut: false })).toBe('signal SIGKILL');
    expect(describeOutcome({ exitCode: null, signal: null, timedOut: false })).toBe('signal unknown');
    expect(describeOutcome({ exitCode: null, signal: 'SIGTERM', timedOut: true })).toBe('timed out');
  });

  it('quotes command tokens that contain special characters', () => {
    expect(formatCommand(['git', 'commit', '-m', 'two words', 'a=b'])).toBe('git commit -m "two words" a=b');
  });

  it('layers environments and removes undefined keys', () => {
    expect(mergeEnvironment({ A: '1', B: '2' }, { B: undefined, C: '3' }, undefined, { A: '4' })).toEqual({
      A: '4',
      C: '3',
    });
  });
});

describe('errors', () => {
  it('roots every error in SandboxError and names each class', () => {
    const cause = new Error('spawn ENOENT');
    const execution = new CommandExecutionError('Failed', { binary: 'git', args: ['status'], cwd: '/r' }, { cause });
    const failed = new CommandFailedError('Failed', resultOf({ exitCode: 1 }));

    expect(execution).toBeInstanceOf(SandboxError);
    expect(failed).toBeInstanceOf(SandboxError);
    expect(execution).toMatchObject({
      name: 'CommandExecutionError',
      binary: 'git',
      args: ['status'],
      cwd: '/r',
      cause,
    });
    expect(failed.name).toBe('CommandFailedError');
    expect(new SandboxError('x').name).toBe('SandboxError');
  });

  it('ensureSuccess returns successful results and throws CommandFailedError otherwise', () => {
    const ok = resultOf({});
    expect(ensureSuccess(ok)).toBe(ok);

    const failed = resultOf({ exitCode: 3, stderr: '  boom\n' });
    expect(() => ensureSuccess(failed, 'Failed to build')).toThrow(
      new CommandFailedError('Failed to build: tool run "a b" failed (exit code 3)\nboom', failed),
    );
    expect(() => ensureSuccess(resultOf({ exitCode: null, signal: 'SIGTERM', timedOut: true }))).toThrow(
      'tool run "a b" failed (timed out)',
    );
    try {
      ensureSuccess(failed);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CommandFailedError);
      expect((error as CommandFailedError).result).toBe(failed);
    }
  });
});

describe('commandExists', () => {
  it('finds executables on PATH without a shell', async () => {
    expect(await commandExists('node', { env: { PATH: path.dirname(process.execPath) } })).toBe(true);
    expect(await commandExists('definitely-not-a-real-command-sandbox')).toBe(false);
    expect(await commandExists('')).toBe(false);
    expect(await commandExists('node', { env: {} })).toBe(false);
    expect(await commandExists(process.execPath)).toBe(true);
  });

  it('requires the execute bit on POSIX and applies PATHEXT on Windows', async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, 'tool'), '#!/bin/sh\n');
    await writeFile(path.join(dir, 'wintool.CMD'), '@echo off\n');
    await mkdir(path.join(dir, 'folder'));
    const posix = { env: { PATH: dir }, platform: 'linux' } as const;

    expect(await commandExists('tool', posix)).toBe(false);
    await chmod(path.join(dir, 'tool'), 0o755);
    expect(await commandExists('tool', posix)).toBe(true);
    expect(await commandExists('folder', posix)).toBe(false);

    expect(await commandExists('wintool', { env: { Path: dir, PATHEXT: '.EXE;.CMD' }, platform: 'win32' })).toBe(true);
    expect(await commandExists('wintool', { env: { Path: dir, PATHEXT: '.EXE' }, platform: 'win32' })).toBe(false);
    expect(await commandExists('wintool', { env: { PATH: dir }, platform: 'win32' })).toBe(true);
  });
});

describe('filesystem helpers', () => {
  it('detects missing paths and resolves canonical paths', async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, 'file.txt');
    await writeFile(file, 'x');
    await symlink(file, path.join(dir, 'link.txt'));

    expect(await fileExists(file)).toBe(true);
    expect(await fileExists(path.join(dir, 'missing'))).toBe(false);
    expect(await fileExists(path.join(file, 'not-a-dir'))).toBe(false);
    expect(await canonicalPath(path.join(dir, 'link.txt'))).toBe(await realpath(file));
    expect(await canonicalPath(path.join(dir, 'missing', '..', 'new'))).toBe(path.join(dir, 'new'));
    expect(isMissingPathError(Object.assign(new Error('x'), { code: 'ENOENT' }))).toBe(true);
    expect(isMissingPathError(Object.assign(new Error('x'), { code: 'EACCES' }))).toBe(false);
    expect(isMissingPathError('ENOENT')).toBe(false);
  });

  it('rethrows filesystem errors other than missing paths', async () => {
    await expect(fileExists('bad\u0000path')).rejects.toThrow();
    await expect(canonicalPath('bad\u0000path')).rejects.toThrow();
  });
});

describe('object helpers', () => {
  it('omits undefined keys and recognizes plain records', () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});
