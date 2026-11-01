import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverFiles, scopeIgnorePattern } from '../../src/repo-search/core/discovery.js';
import { SearchDocumentStore } from '../../src/repo-search/core/searchDocumentStore.js';
import {
  decodeBuffer,
  isProbablyBinary,
  loadDocuments,
  openFile,
  readTextFile,
} from '../../src/repo-search/core/files.js';
import { resolveOptions } from '../../src/repo-search/core/options.js';
import { RepoSearchError } from '../../src/repo-search/errors.js';
import {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  ensureSuccess,
  type CommandExecutionResult,
} from '../../src/shared/index.js';
import { FakeCommandExecutor, spawnFailure, type FakeOutcome } from './fakeExecutor.js';
import { makeFileEntry, makeFixtureRepo, makeTempRoot, writeFile } from './helpers.js';

describe('filesystem discovery', () => {
  it('respects excludes, .gitignore, hidden files, default directories, file size, and extensions', async () => {
    const root = await makeFixtureRepo();
    await writeFile(root, 'too-large.ts', 'x'.repeat(20_000));
    const options = resolveOptions({
      root,
      useGit: false,
      maxFileBytes: 10_000,
      allowedExtensions: ['ts', 'md', 'secret'],
      exclude: ['src/types.ts'],
    });
    const result = await discoverFiles(options);
    const paths = result.files.map((file) => file.path);

    expect(result.source).toBe('filesystem');
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    expect(paths).toEqual(expect.arrayContaining(['src/auth.ts', 'README.md', 'keep.secret']));
    for (const excluded of [
      'ignored/skip.ts',
      'dist/generated.ts',
      '.hidden.ts',
      'secrets.token.secret',
      'src/types.ts',
      'too-large.ts',
      'python/app.py',
    ]) {
      expect(paths).not.toContain(excluded);
    }
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('applies include globs only to files and can ignore .gitignore rules', async () => {
    const root = await makeFixtureRepo();
    const included = await discoverFiles(resolveOptions({ root, useGit: false, include: ['src/*.ts'] }));
    expect(included.files.map((file) => file.path)).toEqual([
      'src/auth.ts',
      'src/logger.ts',
      'src/routes.ts',
      'src/types.ts',
    ]);

    const unignored = await discoverFiles(resolveOptions({ root, useGit: false, respectGitIgnore: false }));
    expect(unignored.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['ignored/skip.ts', 'secrets.token.secret']),
    );
  });

  it('scopes nested .gitignore rules to their directory and its descendants', async () => {
    const root = await makeTempRoot();
    await writeFile(root, 'pkg/.gitignore', '*.log\n/build-output/\nkeep/**/*.tmp\n!important.log\n');
    await writeFile(root, 'pkg/a.log', 'x');
    await writeFile(root, 'pkg/deep/b.log', 'x');
    await writeFile(root, 'pkg/important.log', 'x');
    await writeFile(root, 'pkg/build-output/out.ts', 'x');
    await writeFile(root, 'pkg/keep/x/y.tmp', 'x');
    await writeFile(root, 'other/a.log', 'x');
    await writeFile(root, 'other/pkg/c.log', 'x');
    await writeFile(root, 'other/build-output/out.ts', 'x');

    const result = await discoverFiles(resolveOptions({ root, useGit: false, includeHidden: true }));

    expect(result.files.map((file) => file.path)).toEqual([
      'other/a.log',
      'other/build-output/out.ts',
      'other/pkg/c.log',
      'pkg/.gitignore',
      'pkg/important.log',
    ]);
  });

  it('rewrites nested ignore patterns relative to the search root', () => {
    expect(scopeIgnorePattern('*.log', '')).toBe('*.log');
    expect(scopeIgnorePattern('*.log', 'pkg')).toBe('/pkg/**/*.log');
    expect(scopeIgnorePattern('dist/', 'pkg')).toBe('/pkg/**/dist/');
    expect(scopeIgnorePattern('/out/x.ts', 'pkg')).toBe('/pkg/out/x.ts');
    expect(scopeIgnorePattern('!keep.log', 'pkg')).toBe('!/pkg/**/keep.log');
  });

  it('follows symlinks only when asked and skips unreadable directories', async () => {
    const root = await makeTempRoot();
    await writeFile(root, '.hidden.ts', 'export const hidden = true;\n');
    await writeFile(root, 'target.ts', 'export const target = true;\n');
    await fs.symlink(path.join(root, 'target.ts'), path.join(root, 'linked.ts'));
    await fs.symlink(path.join(root, 'missing.ts'), path.join(root, 'dangling.ts'));

    const noSymlinks = await discoverFiles(resolveOptions({ root, useGit: false, includeHidden: true }));
    expect(noSymlinks.files.map((file) => file.path)).toEqual(['.hidden.ts', 'target.ts']);

    const withSymlinks = await discoverFiles(
      resolveOptions({ root, useGit: false, includeHidden: true, followSymlinks: true }),
    );
    expect(withSymlinks.files.map((file) => file.path)).toEqual(['.hidden.ts', 'linked.ts', 'target.ts']);
    expect(withSymlinks.skipped).toBe(1);

    if (process.getuid?.() !== 0) {
      await writeFile(root, 'locked/inner.ts', 'x');
      await fs.chmod(path.join(root, 'locked'), 0o000);
      try {
        const locked = await discoverFiles(resolveOptions({ root, useGit: false }));
        expect(locked.files.map((file) => file.path)).not.toContain('locked/inner.ts');
      } finally {
        await fs.chmod(path.join(root, 'locked'), 0o755);
      }
    }
  });

  it('rejects a root that is not a directory', async () => {
    const root = await makeTempRoot();
    await writeFile(root, 'file.txt', 'x');
    await expect(discoverFiles(resolveOptions({ root: path.join(root, 'file.txt') }))).rejects.toThrow(RepoSearchError);
  });
});

describe('git discovery', () => {
  it('uses git ls-files inside a work tree and applies the same file filters', async () => {
    const root = await makeFixtureRepo();
    await writeFile(root, 'too-large.ts', 'x'.repeat(20_000));
    const git = new ChildProcessCommandExecutor();
    for (const args of [['init'], ['add', '.']]) {
      ensureSuccess(await git.run('git', args, { cwd: root }));
    }
    const result = await discoverFiles(resolveOptions({ root, maxFileBytes: 10_000, exclude: ['src/types.ts'] }));
    const paths = result.files.map((file) => file.path);

    expect(result.source).toBe('git');
    expect(paths).toEqual(expect.arrayContaining(['src/auth.ts', 'keep.secret', 'README.md']));
    for (const excluded of ['ignored/skip.ts', 'secrets.token.secret', 'dist/generated.ts', '.hidden.ts']) {
      expect(paths).not.toContain(excluded);
    }
    expect(paths).not.toContain('src/types.ts');
    expect(paths).not.toContain('too-large.ts');
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('falls back to the filesystem outside a work tree', async () => {
    const root = await makeTempRoot();
    await writeFile(root, 'a.ts', 'x');
    const result = await discoverFiles(resolveOptions({ root }));
    expect(result.source).toBe('filesystem');
    expect(result.files.map((file) => file.path)).toEqual(['a.ts']);
  });
});

describe('git discovery through the executor', () => {
  const PROBE_ARGS = ['rev-parse', '--is-inside-work-tree'];
  const LIST_ARGS = ['ls-files', '-co', '--exclude-standard', '-z', '--', '.'];
  const TIMED_OUT: Partial<CommandExecutionResult> = { exitCode: null, signal: 'SIGTERM', timedOut: true };

  /** Answers the work-tree probe and the listing with the given outcomes. */
  function gitExecutor(probe: FakeOutcome, listing: FakeOutcome = { stdout: 'listed.ts\0' }): FakeCommandExecutor {
    return new FakeCommandExecutor(({ args }) => (args[0] === 'rev-parse' ? probe : listing));
  }

  it('runs git in the root through the executor and filters the listing like the walker', async () => {
    const root = await makeTempRoot();
    for (const repoPath of ['a.ts', 'src/b.ts', 'dist/c.ts', 'unlisted.ts']) await writeFile(root, repoPath, 'x');
    const executor = gitExecutor({ stdout: 'true\n' }, { stdout: 'a.ts\0src/b.ts\0dist/c.ts\0gone.ts\0' });

    const result = await discoverFiles(resolveOptions({ root, executor }));

    expect(result.source).toBe('git');
    expect(result.files.map((file) => file.path)).toEqual(['a.ts', 'src/b.ts']);
    expect(result.skipped).toBe(2);
    expect(executor.calls).toEqual([
      { binary: 'git', args: PROBE_ARGS, options: { cwd: root, timeoutMs: 5_000 } },
      { binary: 'git', args: LIST_ARGS, options: { cwd: root, timeoutMs: 60_000, maxOutputBytes: 256 * 1024 * 1024 } },
    ]);
  });

  const fallbacks: [string, FakeOutcome, FakeOutcome?][] = [
    ['the root is outside a work tree', { exitCode: 128, stderr: 'fatal: not a git repository' }],
    ['the probe does not report a work tree', { stdout: 'false\n' }],
    ['the probe times out', TIMED_OUT],
    ['git cannot be spawned', spawnFailure('git', PROBE_ARGS)],
    ['git ls-files fails', { stdout: 'true\n' }, { exitCode: 1 }],
    ['git ls-files times out', { stdout: 'true\n' }, TIMED_OUT],
    [
      'the listing exceeds the output limit',
      { stdout: 'true\n' },
      new CommandExecutionError('Command wrote more than 268435456 bytes to stdout: git', {
        binary: 'git',
        args: LIST_ARGS,
        cwd: '/fake',
      }),
    ],
  ];

  it.each(fallbacks)('walks the filesystem when %s', async (_, probe, listing) => {
    const root = await makeTempRoot();
    await writeFile(root, 'a.ts', 'x');
    const executor = gitExecutor(probe, listing);

    const result = await discoverFiles(resolveOptions({ root, executor }));

    expect(result.source).toBe('filesystem');
    expect(result.files.map((file) => file.path)).toEqual(['a.ts']);
    expect(executor.calls.length).toBeGreaterThan(0);
  });

  it('propagates executor errors other than CommandExecutionError', async () => {
    const root = await makeTempRoot();
    const executor = gitExecutor(new TypeError('executor bug'));
    await expect(discoverFiles(resolveOptions({ root, executor }))).rejects.toThrow(TypeError);
  });

  it('does not run git when useGit is false', async () => {
    const root = await makeTempRoot();
    const executor = new FakeCommandExecutor();
    await discoverFiles(resolveOptions({ root, useGit: false, executor }));
    expect(executor.calls).toEqual([]);
  });
});

describe('file loading', () => {
  it('detects binary content and decodes UTF-8 without a byte-order mark', async () => {
    expect(isProbablyBinary(Buffer.from([0]))).toBe(true);
    expect(isProbablyBinary(Buffer.from([1, 2, 3, 4, 65]))).toBe(true);
    expect(isProbablyBinary(Buffer.from('plain text'))).toBe(false);
    expect(isProbablyBinary(new Uint8Array())).toBe(false);
    expect(decodeBuffer(Buffer.from('﻿hello'))).toBe('hello');

    const root = await makeTempRoot();
    await writeFile(root, 'binary.bin', Buffer.from([1, 2, 0, 4]));
    await writeFile(root, 'text.ts', 'const a = 1;\r\nconst b = 2;');
    expect(await readTextFile(path.join(root, 'binary.bin'))).toBeUndefined();
    expect(await readTextFile(path.join(root, 'text.ts'))).toContain('const b');
  });

  it('loads documents in order with dense ids, skipping binary and unreadable files', async () => {
    const root = await makeFixtureRepo();
    const { files } = await discoverFiles(resolveOptions({ root, useGit: false, respectGitIgnore: false }));
    const vanished = makeFileEntry('gone.ts', path.join(root, 'gone.ts'));
    const documents = await loadDocuments([...files, vanished], 3);

    expect(documents.map((doc) => doc.id)).toEqual(documents.map((_, index) => index));
    expect(documents.map((doc) => doc.path)).not.toContain('binary.bin');
    expect(documents.map((doc) => doc.path)).not.toContain('gone.ts');
    expect(documents.length).toBe(files.length - 1);
    expect(documents.find((doc) => doc.path === 'src/auth.ts')?.lines.length).toBeGreaterThan(5);
  });
});

describe('openFile', () => {
  it('opens indexed and on-disk files with clamped ranges and rejects traversal and binary files', async () => {
    const root = await makeFixtureRepo();
    const { files } = await discoverFiles(resolveOptions({ root, useGit: false }));
    const store = new SearchDocumentStore(await loadDocuments(files, 4));

    const opened = await openFile(root, store, 'src/auth.ts', {
      line: 4,
      endLine: 5,
      contextBefore: 1,
      contextAfter: 1,
    });
    expect(opened).toMatchObject({ path: 'src/auth.ts', line: 3, endLine: 6 });
    expect(opened.text).toContain('validatePermission');
    expect(opened.numberedText).toMatch(/^3 \| /);

    const clamped = await openFile(root, store, 'src/auth.ts', { line: -100, endLine: 9999 });
    expect(clamped.line).toBe(1);
    expect(clamped.endLine).toBe(clamped.totalLines);

    const uncached = await openFile(root, new SearchDocumentStore([]), path.join(root, 'README.md'));
    expect(uncached).toMatchObject({ path: 'README.md', line: 1, endLine: 1, text: '# Fixture' });

    await expect(openFile(root, store, '../outside.ts')).rejects.toThrow(/escapes/);
    await expect(openFile(root, store, 'binary.bin')).rejects.toThrow(/binary/);
  });
});
