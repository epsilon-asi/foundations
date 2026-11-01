import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalRepoSearch, RipgrepError } from '../../src/repo-search/index.js';
import {
  ripgrepAvailable,
  searchRegexWithRipgrep,
  searchTextWithRipgrep,
  shouldUseRipgrep,
} from '../../src/repo-search/search/ripgrep.js';
import { CommandExecutionError, CommandFailedError, type CommandExecutionResult } from '../../src/shared/index.js';
import { FakeCommandExecutor, spawnFailure, type FakeOutcome } from './fakeExecutor.js';
import { makeFixtureRepo, makeTempRoot, writeFile } from './helpers.js';

const BASE_ARGS = ['--json', '--line-number', '--column', '--with-filename', '--color', 'never', '--hidden'];

function rgJson(...events: unknown[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('');
}

function lineEvent(
  type: 'match' | 'context',
  repoPath: string,
  lineNumber: number,
  text: string,
  submatches: unknown[] = [],
) {
  return {
    type,
    data: { path: { text: repoPath }, lines: { text: `${text}\n` }, line_number: lineNumber, submatches },
  };
}

/** An executor whose every `rg` search answers with `outcome`. */
function rgExecutor(outcome: FakeOutcome): FakeCommandExecutor {
  return new FakeCommandExecutor(() => outcome);
}

const RG_RUN_OPTIONS = { cwd: '/repo', timeoutMs: 30_000, maxOutputBytes: 64 * 1024 * 1024 };
const TIMED_OUT: Partial<CommandExecutionResult> = { exitCode: null, signal: 'SIGTERM', timedOut: true };

/** Runs `fn` with `PATH` set to `directory`. */
async function withPath<T>(directory: string, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.PATH;
  process.env.PATH = directory;
  try {
    return await fn();
  } finally {
    process.env.PATH = saved;
  }
}

describe('ripgrepAvailable', () => {
  it('looks rg up on PATH without an executor, on every call', async () => {
    const empty = await makeTempRoot();
    const withRg = await makeTempRoot();
    await writeFile(withRg, 'rg', '#!/bin/sh\n');
    await fs.chmod(path.join(withRg, 'rg'), 0o755);

    await expect(withPath(empty, () => ripgrepAvailable())).resolves.toBe(false);
    await expect(withPath(withRg, () => ripgrepAvailable())).resolves.toBe(true);
  });

  it('probes `rg --version` through a given executor', async () => {
    const executor = rgExecutor({ stdout: 'ripgrep 14.1.0\n' });
    await expect(ripgrepAvailable(executor)).resolves.toBe(true);
    expect(executor.calls).toEqual([{ binary: 'rg', args: ['--version'], options: { timeoutMs: 5_000 } }]);
  });

  it.each<[string, FakeOutcome]>([
    ['exits non-zero', { exitCode: 127, stderr: 'rg: not found' }],
    ['times out', TIMED_OUT],
    ['cannot be spawned', spawnFailure('rg', ['--version'])],
  ])('reports rg unavailable when the probe %s', async (_, outcome) => {
    await expect(ripgrepAvailable(rgExecutor(outcome))).resolves.toBe(false);
  });

  it('propagates probe errors other than CommandExecutionError', async () => {
    await expect(ripgrepAvailable(rgExecutor(new TypeError('executor bug')))).rejects.toThrow(TypeError);
  });
});

describe('ripgrep backend', () => {
  it('resolves backend precedence: the per-call backend wins over the configured one', () => {
    expect(shouldUseRipgrep(undefined, undefined)).toBe(true);
    expect(shouldUseRipgrep('auto', undefined)).toBe(true);
    expect(shouldUseRipgrep('ripgrep', undefined)).toBe(true);
    expect(shouldUseRipgrep('node', undefined)).toBe(false);
    expect(shouldUseRipgrep('node', 'auto')).toBe(true);
    expect(shouldUseRipgrep('node', 'ripgrep')).toBe(true);
    expect(shouldUseRipgrep('auto', 'node')).toBe(false);
    expect(shouldUseRipgrep('ripgrep', 'node')).toBe(false);
  });

  it('builds literal-search args and collects context before and after each match', async () => {
    const executor = rgExecutor({
      stdout:
        rgJson(
          { type: 'begin', data: { path: { text: 'src/auth.ts' } } },
          lineEvent('context', './src\\auth.ts', 8, 'const beforeOne = true;'),
          lineEvent('context', './src/auth.ts', 9, 'const beforeTwo = true;'),
          lineEvent('match', './src/auth.ts', 10, 'export const permissionCheck = true;', [
            { match: { text: 'permissionCheck' }, start: 13, end: 28 },
          ]),
          lineEvent('match', './src/auth.ts', 11, 'permissionCheck();', [{ start: 0, end: 15 }]),
          lineEvent('context', './src/auth.ts', 12, 'after one'),
          lineEvent('context', './src/auth.ts', 13, 'after two'),
          lineEvent('context', './src/auth.ts', 20, 'too far'),
          lineEvent('match', 'README.md', 1, 'permissionCheck documented here', [{ start: 0, end: 15 }]),
          { type: 'end', data: {} },
        ) + 'not-json\n',
    });

    const results = await searchTextWithRipgrep(
      '/repo',
      '-permissionCheck',
      {
        caseSensitive: true,
        wholeWord: true,
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
        paths: ['./src/auth.ts'],
        contextBefore: 2,
        contextAfter: 2,
      },
      { executor },
    );

    expect(executor.calls).toEqual([
      {
        binary: 'rg',
        args: [
          ...BASE_ARGS,
          '-B',
          '2',
          '-A',
          '2',
          '-g',
          'src/**/*.ts',
          '-g',
          '!src/**/*.spec.ts',
          '-g',
          'src/auth.ts',
          '-F',
          '-w',
          '--',
          '-permissionCheck',
          '.',
        ],
        options: RG_RUN_OPTIONS,
      },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      method: 'text',
      path: 'src/auth.ts',
      absolutePath: '/repo/src/auth.ts',
      score: 1,
      line: 10,
      endLine: 10,
      column: 14,
      endColumn: 29,
      language: 'typescript',
      preview: 'export const permissionCheck = true;',
      contextBefore: ['const beforeOne = true;', 'const beforeTwo = true;'],
      contextAfter: ['permissionCheck();', 'after one'],
      matches: [{ line: 10, column: 14, endLine: 10, endColumn: 29, text: 'permissionCheck' }],
      metadata: { backend: 'ripgrep' },
    });
    expect(results[1]).toMatchObject({
      line: 11,
      contextBefore: ['const beforeTwo = true;', 'export const permissionCheck = true;'],
      contextAfter: ['after one', 'after two'],
      matches: [{ text: 'permissionCheck', column: 1, endColumn: 16 }],
    });
    expect(results[2]).toMatchObject({ path: 'README.md', language: 'markdown', contextBefore: [], contextAfter: [] });
  });

  it('stops at maxResults once the last result has its context, and honours acceptPath', async () => {
    const executor = rgExecutor({
      stdout: rgJson(
        lineEvent('match', 'skip/me.ts', 1, 'hit'),
        lineEvent('match', 'a.ts', 1, 'hit one'),
        lineEvent('context', 'a.ts', 2, 'after'),
        lineEvent('match', 'a.ts', 5, 'hit two'),
      ),
    });
    const results = await searchTextWithRipgrep(
      '/repo',
      'hit',
      { maxResults: 1, contextAfter: 1, contextBefore: 0 },
      { executor, acceptPath: (repoPath) => !repoPath.startsWith('skip/') },
    );
    expect(results.map((r) => [r.path, r.line, r.contextAfter])).toEqual([['a.ts', 1, ['after']]]);

    const noContext = await searchTextWithRipgrep('/repo', 'hit', { maxResults: 1, contextAfter: 0 }, { executor });
    expect(noContext.map((r) => r.path)).toEqual(['skip/me.ts']);
  });

  it('builds default case-insensitive literal args and handles no-match exit code 1', async () => {
    const executor = rgExecutor({ exitCode: 1 });
    await expect(searchTextWithRipgrep('/repo', 'Missing', {}, { executor })).resolves.toEqual([]);
    expect(executor.calls[0]?.args).toEqual([...BASE_ARGS, '-B', '2', '-A', '2', '-F', '-i', '--', 'Missing', '.']);
  });

  it('handles multiline regex matches, UTF-8 byte offsets, and base64 payloads', async () => {
    const executor = rgExecutor({
      stdout: rgJson(
        lineEvent('match', 'config/settings.json', 7, '  "feature": true,\n  "émoji": true', [
          { match: { text: 'feature": true,\n  "é' }, start: 3, end: 24 },
        ]),
        {
          type: 'match',
          data: {
            path: { bytes: Buffer.from('bin/ü.txt').toString('base64') },
            lines: { bytes: Buffer.from('ü feature\n').toString('base64') },
            line_number: 2,
            submatches: [{ start: 3, end: 10 }],
          },
        },
      ),
    });

    const results = await searchRegexWithRipgrep(
      '/repo',
      'feature.*',
      { flags: 'is', multiline: true, contextBefore: 0, contextAfter: 0 },
      { executor },
    );

    expect(executor.calls[0]?.args).toEqual([
      ...BASE_ARGS,
      '-B',
      '0',
      '-A',
      '0',
      '-i',
      '-U',
      '--multiline',
      '--multiline-dotall',
      '--',
      'feature.*',
      '.',
    ]);
    expect(results[0]).toMatchObject({
      method: 'regex',
      score: 0.95,
      line: 7,
      endLine: 8,
      column: 4,
      endColumn: 5,
      language: 'json',
      preview: '  "feature": true,\n  "émoji": true',
      matches: [{ line: 7, column: 4, endLine: 8, endColumn: 5, text: 'feature": true,\n  "é' }],
    });
    expect(results[1]).toMatchObject({
      path: 'bin/ü.txt',
      line: 2,
      column: 3,
      endColumn: 10,
      preview: 'ü feature',
      matches: [{ text: 'feature' }],
    });
  });

  it('ignores malformed events and omits columns without submatches', async () => {
    const executor = rgExecutor({
      stdout: rgJson(
        { type: 'match' },
        { type: 'context', data: {} },
        { type: 'match', data: { path: { text: 'a.ts' }, lines: { text: 'x' }, line_number: 0, submatches: [] } },
        lineEvent('match', 'b.ts', 3, 'whole line'),
      ),
    });
    const results = await searchRegexWithRipgrep('/repo', 'one.two', { flags: 's' }, { executor });
    expect(executor.calls[0]?.args).toContain('--multiline-dotall');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ path: 'b.ts', line: 3, matches: [] });
    expect(results[0]).not.toHaveProperty('column');
    expect(results[0]).not.toHaveProperty('endColumn');
  });

  it('rejects with CommandFailedError for error exits, signals, and timeouts', async () => {
    const failure = searchRegexWithRipgrep(
      '/repo',
      '[bad',
      {},
      {
        executor: rgExecutor({ exitCode: 2, stderr: 'regex parse error\n' }),
      },
    );
    await expect(failure).rejects.toThrow(CommandFailedError);
    await expect(failure).rejects.toThrow(/^ripgrep search failed: rg .* failed \(exit code 2\)\nregex parse error$/);
    const error = (await failure.catch((caught: unknown) => caught)) as CommandFailedError;
    expect(error.result).toMatchObject({ binary: 'rg', exitCode: 2 });

    await expect(
      searchTextWithRipgrep('/repo', 'x', {}, { executor: rgExecutor({ exitCode: null, signal: 'SIGKILL' }) }),
    ).rejects.toThrow(/failed \(signal SIGKILL\)/);
    await expect(searchTextWithRipgrep('/repo', 'x', {}, { executor: rgExecutor(TIMED_OUT) })).rejects.toThrow(
      /failed \(timed out\)/,
    );
    await expect(
      searchTextWithRipgrep('/repo', 'x', {}, { executor: rgExecutor({ exitCode: 0, timedOut: true }) }),
    ).rejects.toThrow(CommandFailedError);
  });

  it('propagates CommandExecutionError when rg cannot run', async () => {
    const spawnError = spawnFailure('rg');
    await expect(searchTextWithRipgrep('/repo', 'x', {}, { executor: rgExecutor(spawnError) })).rejects.toBe(
      spawnError,
    );
  });

  it('defaults to the child-process executor', async () => {
    const root = await makeTempRoot();
    const outcome = await withPath(root, () => searchTextWithRipgrep(root, 'x').catch((caught: unknown) => caught));
    expect(outcome).toBeInstanceOf(CommandExecutionError);
    expect(outcome).toMatchObject({ binary: 'rg', cwd: root });
  });
});

describe('LocalRepoSearch backend selection', () => {
  const DIST_AND_AUTH_MATCHES = rgJson(
    lineEvent('match', 'dist/generated.ts', 1, 'export const generated = true;', [{ start: 13, end: 22 }]),
    lineEvent(
      'match',
      'src/auth.ts',
      10,
      "export const validateToken = async (token: string) => token === 'secret-token';",
      [{ start: 13, end: 26 }],
    ),
  );

  /** An executor where `rg --version` answers with `probe` and every search with `search`. */
  function repoExecutor(probe: FakeOutcome, search: FakeOutcome): FakeCommandExecutor {
    return new FakeCommandExecutor(({ args }) => (args[0] === '--version' ? probe : search));
  }

  it('runs ripgrep through the executor, restricted to indexed files, and probes availability once', async () => {
    const root = await makeFixtureRepo();
    const executor = repoExecutor({ stdout: 'ripgrep 14\n' }, { stdout: DIST_AND_AUTH_MATCHES });
    const repo = await LocalRepoSearch.create({ root, useGit: false, executor });

    const results = await repo.searchText('generated|validateToken');
    expect(results.map((r) => [r.path, r.metadata?.backend])).toEqual([['src/auth.ts', 'ripgrep']]);
    await repo.searchRegex('validate\\w+');
    expect(executor.calls.map((call) => call.args[0])).toEqual(['--version', '--json', '--json']);
    expect(executor.calls[1]?.options).toEqual({ ...RG_RUN_OPTIONS, cwd: root });

    const viaRegExp = await repo.searchRegex(/validateToken/);
    expect(viaRegExp[0]?.metadata).toBeUndefined();
    const forcedNode = await repo.searchText('validateToken', { backend: 'node' });
    expect(forcedNode[0]?.metadata).toBeUndefined();
    expect(executor.calls).toHaveLength(3);

    const rebuilt = await repo.rebuild();
    await rebuilt.searchText('validateToken');
    expect(executor.calls.map((call) => call.args[0])).toEqual([
      '--version',
      '--json',
      '--json',
      '--version',
      '--json',
    ]);
  });

  it.each<[string, FakeOutcome, typeof CommandFailedError | typeof CommandExecutionError]>([
    ['exits with an error', { exitCode: 2, stderr: 'backreferences are not supported' }, CommandFailedError],
    ['times out', TIMED_OUT, CommandFailedError],
    [
      'exceeds the output limit',
      new CommandExecutionError('too much', { binary: 'rg', args: [], cwd: '/' }),
      CommandExecutionError,
    ],
  ])(
    'falls back to Node when ripgrep %s under auto and wraps the failure when forced',
    async (_, outcome, causeType) => {
      const root = await makeFixtureRepo();
      const executor = repoExecutor({}, outcome);

      const auto = await LocalRepoSearch.create({ root, useGit: false, backend: 'auto', executor });
      expect(await auto.searchRegex('(secret)-\\1', { maxResults: 5 })).toEqual([]);
      expect(await auto.searchText('secret-token')).toHaveLength(2);

      const forced = await LocalRepoSearch.create({ root, useGit: false, backend: 'ripgrep', executor });
      const error = await forced.searchRegex('(secret)-\\1').catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(RipgrepError);
      expect((error as Error).message).toBe('ripgrep regex search failed and backend was forced to ripgrep');
      expect((error as Error).cause).toBeInstanceOf(causeType);
      await expect(auto.searchText('secret-token', { backend: 'ripgrep' })).rejects.toThrow(
        /ripgrep text search failed/,
      );
    },
  );

  it('propagates executor errors other than command failures', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({
      root,
      useGit: false,
      executor: repoExecutor({}, new TypeError('executor bug')),
    });
    await expect(repo.searchText('secret-token')).rejects.toThrow(TypeError);
  });

  it('uses Node when rg is unavailable, even if ripgrep is requested', async () => {
    const root = await makeFixtureRepo();
    const executor = repoExecutor(spawnFailure('rg', ['--version']), new Error('rg must not run'));
    const repo = await LocalRepoSearch.create({ root, useGit: false, backend: 'ripgrep', executor });
    expect(await repo.searchText('secret-token')).toHaveLength(2);
    expect(await repo.searchRegex('secret-\\w+')).toHaveLength(2);
    expect(executor.calls).toHaveLength(1);
  });

  it('looks rg up on PATH when no executor is given', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({ root, useGit: false, backend: 'ripgrep' });
    const empty = await makeTempRoot();
    expect(await withPath(empty, () => repo.searchText('secret-token'))).toHaveLength(2);
  });
});
