import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_EXCLUDED_DIRECTORIES,
  resolveExecutor,
  resolveOptions,
} from '../../src/repo-search/core/options.js';
import { LspError, RepoSearchError, RipgrepError } from '../../src/repo-search/errors.js';
import { mapConcurrent } from '../../src/repo-search/utils/async.js';
import { pushToMap, toSet } from '../../src/repo-search/utils/collections.js';
import { applyGitStyleGlobRules, compileGlob, compileGlobs, matchesAnyGlob } from '../../src/repo-search/utils/glob.js';
import { createPathFilter } from '../../src/repo-search/utils/pathFilter.js';
import {
  extensionOf,
  isHiddenRepoPath,
  isInsideRoot,
  languageForPath,
  normalizeRepoPath,
  relativePath,
  resolveInsideRoot,
  toPosixPath,
  trimLeadingSlash,
  trimTrailingSlash,
} from '../../src/repo-search/utils/path.js';
import { ChildProcessCommandExecutor, SandboxError } from '../../src/shared/index.js';
import {
  LineIndex,
  clamp,
  escapeRegExp,
  getLineContext,
  isWordBoundary,
  makeSnippet,
  normalizeForSearch,
  numberLines,
  splitLines,
} from '../../src/repo-search/utils/text.js';
import { FakeCommandExecutor } from './fakeExecutor.js';

describe('options', () => {
  it('fills defaults and normalizes extensions', () => {
    const resolved = resolveOptions({ root: '.', allowedExtensions: ['ts', '.MD'], backend: 'node' });
    expect(path.isAbsolute(resolved.root)).toBe(true);
    expect(resolved).toMatchObject({
      allowedExtensions: ['.ts', '.md'],
      useGit: true,
      respectGitIgnore: true,
      includeHidden: false,
      followSymlinks: false,
      maxFileBytes: 1024 * 1024,
      include: [],
      exclude: [],
      concurrency: 16,
      chunkLines: 160,
      chunkOverlap: 32,
      backend: 'node',
    });
    expect(resolved.defaultExcludedDirectories).toBe(DEFAULT_SEARCH_EXCLUDED_DIRECTORIES);
    expect(DEFAULT_SEARCH_EXCLUDED_DIRECTORIES).toContain('node_modules');
    expect(resolved).not.toHaveProperty('executor');
  });

  it('keeps a caller-supplied executor and defaults to a ChildProcessCommandExecutor', () => {
    const executor = new FakeCommandExecutor();
    const resolved = resolveOptions({ root: '.', executor });
    expect(resolved.executor).toBe(executor);
    expect(resolveExecutor(resolved)).toBe(executor);
    expect(resolveExecutor(resolveOptions({ root: '.' }))).toBeInstanceOf(ChildProcessCommandExecutor);
  });
});

describe('errors', () => {
  it('share one base class, carry their own name, and keep the cause', () => {
    const cause = new Error('root cause');
    const error = new RipgrepError('rg broke', { cause });
    expect(error).toBeInstanceOf(RepoSearchError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RipgrepError');
    expect(error.cause).toBe(cause);
    expect(new RepoSearchError('x')).toBeInstanceOf(SandboxError);
    expect(new RepoSearchError('x').name).toBe('RepoSearchError');
    expect(new LspError('x')).toBeInstanceOf(RepoSearchError);
    expect(new LspError('x').name).toBe('LspError');
  });
});

describe('glob utilities', () => {
  it('matches git-like glob patterns, negations, directory rules, and anchoring', () => {
    const deepGlob = compileGlob('src/**/*.ts');
    expect(deepGlob?.regex.test('src/core/index.ts')).toBe(true);
    expect(deepGlob?.regex.test('src/index.ts')).toBe(true);
    expect(deepGlob?.regex.test('test/core/index.ts')).toBe(false);
    expect(compileGlob('src/**')?.regex.test('src/a/b.ts')).toBe(true);
    expect(compileGlob('src/?.ts')?.regex.test('src/a.ts')).toBe(true);

    const directoryGlob = compileGlob('dist/');
    expect(directoryGlob).toMatchObject({ directoryOnly: true, basenameOnly: true, negated: false });
    expect(directoryGlob?.regex.test('dist/')).toBe(true);
    expect(directoryGlob?.regex.test('src/dist/file.ts')).toBe(true);

    const anchored = compileGlob('/src/*.ts');
    expect(anchored?.regex.test('src/auth.ts')).toBe(true);
    expect(anchored?.regex.test('nested/src/auth.ts')).toBe(false);
    const anchoredBasename = compileGlob('/README.md');
    expect(anchoredBasename?.regex.test('README.md')).toBe(true);
    expect(anchoredBasename?.regex.test('docs/README.md')).toBe(false);

    expect(compileGlob('docs/My\\ File.md')?.regex.test('docs/My File.md')).toBe(true);
    expect(compileGlob('a+b(1).ts')?.regex.test('a+b(1).ts')).toBe(true);
    expect(compileGlob('# comment')).toBeUndefined();
    expect(compileGlob('  ')).toBeUndefined();

    const rules = compileGlobs(['*.secret', '!keep.secret', '']);
    expect(rules).toHaveLength(2);
    expect(applyGitStyleGlobRules('token.secret', rules)).toBe(true);
    expect(applyGitStyleGlobRules('keep.secret', rules)).toBe(false);
    expect(applyGitStyleGlobRules('other.ts', rules)).toBe(false);
    expect(matchesAnyGlob('src/Auth.TS', compileGlobs(['src/*.ts']))).toBe(true);
    expect(matchesAnyGlob('src/Auth.TS', compileGlobs(['src/*.ts'], { caseSensitive: true }))).toBe(false);
    expect(compileGlobs(undefined)).toEqual([]);
  });
});

describe('createPathFilter', () => {
  it('combines paths, include, and exclude, normalizing both sides', () => {
    expect(createPathFilter({})('anything')).toBe(true);

    const scoped = createPathFilter({
      paths: ['./src/a.ts', 'src\\b.ts', 'docs/c.md'],
      include: ['src/*'],
      exclude: ['*.md', 'src/b.ts'],
    });
    expect(scoped('src/a.ts')).toBe(true);
    expect(scoped('./src/a.ts')).toBe(true);
    expect(scoped('src/b.ts')).toBe(false);
    expect(scoped('docs/c.md')).toBe(false);
    expect(scoped('src/d.ts')).toBe(false);

    expect(createPathFilter({ include: ['SRC/*'] })('src/a.ts')).toBe(true);
    expect(createPathFilter({ include: ['SRC/*'] }, true)('src/a.ts')).toBe(false);
  });
});

describe('path utilities', () => {
  it('normalizes and validates repository paths', () => {
    const root = path.resolve('/tmp/project');
    expect(toPosixPath('a\\b\\c.ts')).toBe('a/b/c.ts');
    expect(trimLeadingSlash('//a/b')).toBe('a/b');
    expect(trimTrailingSlash('a/b///')).toBe('a/b');
    expect(normalizeRepoPath('./src\\auth.ts')).toBe('src/auth.ts');
    expect(relativePath(root, path.join(root, 'src', 'index.ts'))).toBe('src/index.ts');
    expect(resolveInsideRoot(root, 'src/index.ts')).toBe(path.join(root, 'src/index.ts'));
    expect(resolveInsideRoot(root, path.join(root, 'a.ts'))).toBe(path.join(root, 'a.ts'));
    expect(() => resolveInsideRoot(root, '../escape.ts')).toThrow(RepoSearchError);
    expect(isInsideRoot(root, root)).toBe(true);
    expect(isInsideRoot(root, path.join(root, 'src'))).toBe(true);
    expect(isInsideRoot(root, path.resolve('/tmp/elsewhere'))).toBe(false);
    expect(extensionOf('README.MD')).toBe('.md');
    expect(isHiddenRepoPath('src/.secret/file.ts')).toBe(true);
    expect(isHiddenRepoPath('src/visible/file.ts')).toBe(false);
  });

  it('maps well-known filenames and extensions to languages', () => {
    expect(languageForPath('Dockerfile')).toBe('dockerfile');
    expect(languageForPath('build/api.dockerfile')).toBe('dockerfile');
    expect(languageForPath('Makefile')).toBe('makefile');
    expect(languageForPath('Gemfile')).toBe('ruby');
    expect(languageForPath('package.json')).toBe('json');
    expect(languageForPath('src/file.tsx')).toBe('typescriptreact');
    expect(languageForPath('lib/x.mjs')).toBe('javascript');
    expect(languageForPath('a/b.HPP')).toBe('cpp');
    expect(languageForPath('script.unknown')).toBe('unknown');
    expect(languageForPath('LICENSE')).toBe('text');
    expect(languageForPath('constructor')).toBe('text');
  });
});

describe('text utilities', () => {
  it('handles line contexts, snippets, boundaries, and numbering', () => {
    const lines = splitLines('alpha\nbeta gamma\r\ndelta\rlast');
    expect(lines).toEqual(['alpha', 'beta gamma', 'delta', 'last']);
    expect(getLineContext(lines, 2, 2, 1, 1)).toEqual({
      preview: 'beta gamma',
      contextBefore: ['alpha'],
      contextAfter: ['delta'],
    });
    expect(getLineContext(lines, 1, 0)).toEqual({ preview: 'alpha', contextBefore: [], contextAfter: [] });
    expect(numberLines(['x', 'y'], 9)).toBe(' 9 | x\n10 | y');
    expect(makeSnippet('  a    b '.repeat(50), 20)).toMatch(/…$/);
    expect(makeSnippet('  a \n b  ')).toBe('a b');
    expect(normalizeForSearch('MiXeD')).toBe('mixed');
    expect(normalizeForSearch('MiXeD', true)).toBe('MiXeD');
    expect(escapeRegExp('a+b?')).toBe('a\\+b\\?');
    expect(isWordBoundary('foo bar', 3)).toBe(true);
    expect(isWordBoundary('foo_bar', 3)).toBe(false);
    expect(isWordBoundary('foo', -1)).toBe(true);
    expect(clamp(10, 1, 5)).toBe(5);
    expect(clamp(-1, 1, 5)).toBe(1);
  });

  it('locates offsets with LineIndex across \\n, \\r\\n, and \\r line breaks', () => {
    const index = new LineIndex('alpha\nbeta gamma\r\ndelta\rz');
    expect(index.locate(0)).toEqual({ line: 1, column: 1 });
    expect(index.locate(5)).toEqual({ line: 1, column: 6 });
    expect(index.locate(6)).toEqual({ line: 2, column: 1 });
    expect(index.locate(7)).toEqual({ line: 2, column: 2 });
    expect(index.locate(18)).toEqual({ line: 3, column: 1 });
    expect(index.locate(24)).toEqual({ line: 4, column: 1 });
    expect(index.locate(99)).toEqual({ line: 4, column: 76 });
    expect(new LineIndex('').locate(0)).toEqual({ line: 1, column: 1 });
  });
});

describe('collection and async helpers', () => {
  it('normalizes lists to sets and groups values', () => {
    expect(toSet(undefined)).toBeUndefined();
    expect([...(toSet('a') ?? [])]).toEqual(['a']);
    expect([...(toSet(['a', 'b', 'a']) ?? [])]).toEqual(['a', 'b']);
    const groups = new Map<string, number[]>();
    pushToMap(groups, 'x', 1);
    pushToMap(groups, 'x', 2);
    expect(groups.get('x')).toEqual([1, 2]);
  });

  it('maps with bounded concurrency and keeps input order', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapConcurrent([30, 10, 20, 5, 1], 2, async (delay, index) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return `${index}:${delay}`;
    });
    expect(results).toEqual(['0:30', '1:10', '2:20', '3:5', '4:1']);
    expect(peak).toBe(2);
    expect(await mapConcurrent([], 4, () => Promise.resolve(1))).toEqual([]);
    expect(await mapConcurrent([1, 2], 0, (value) => Promise.resolve(value * 2))).toEqual([2, 4]);
  });
});
