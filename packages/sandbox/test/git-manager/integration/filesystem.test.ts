import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GitError } from '../../../src/git-manager/index.js';
import { nodeFilesystem } from '../../../src/git-manager/internal/filesystem.js';

let dir: string;

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'git-manager-fs-')));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('nodeFilesystem', () => {
  it('creates nested directories', async () => {
    await nodeFilesystem.mkdir(join(dir, 'a', 'b', 'c'));

    expect((await stat(join(dir, 'a', 'b', 'c'))).isDirectory()).toBe(true);
  });

  it('copies a regular file with its mode into missing parents, replacing an existing entry', async () => {
    const source = join(dir, 'script.sh');
    const destination = join(dir, 'out', 'nested', 'script.sh');
    await writeFile(source, '#!/bin/sh\n', 'utf8');
    await chmod(source, 0o755);
    await mkdir(destination, { recursive: true });

    await nodeFilesystem.copyFileOrSymlink(source, destination);

    expect(await readFile(destination, 'utf8')).toBe('#!/bin/sh\n');
    expect((await stat(destination)).mode & 0o777).toBe(0o755);
  });

  it.skipIf(process.platform === 'win32')('recreates symlinks instead of following them', async () => {
    const source = join(dir, 'link');
    const destination = join(dir, 'copy', 'link');
    await symlink('missing-target.txt', source);

    await nodeFilesystem.copyFileOrSymlink(source, destination);

    expect((await lstat(destination)).isSymbolicLink()).toBe(true);
    expect(await readlink(destination)).toBe('missing-target.txt');
  });

  it('rejects directories without touching the destination', async () => {
    const source = join(dir, 'nested-repo');
    const destination = join(dir, 'existing.txt');
    await mkdir(source);
    await writeFile(destination, 'keep me', 'utf8');

    await expect(nodeFilesystem.copyFileOrSymlink(source, destination)).rejects.toBeInstanceOf(GitError);
    expect(await readFile(destination, 'utf8')).toBe('keep me');
  });
});
