import { describe, expect, it } from 'vitest';
import {
  LocalRepoSearch,
  PathMentionSchema,
  PathMentionTextRangeSchema,
  searchTextForPaths,
} from '../../src/repo-search/index.js';
import { PathSearchEngine } from '../../src/repo-search/search/pathSearch.js';
import { makeFileEntry as file, makeFixtureRepo } from './helpers.js';

describe('path mention extraction', () => {
  it('matches explicit repository paths, line/column suffixes, and text ranges', () => {
    const engine = new PathSearchEngine([file('src/auth.ts'), file('README.md')]);
    const text = 'Please inspect src/auth.ts:12:4 before README.md.';
    const results = engine.searchTextForPaths(text);

    expect(results.map((result) => result.path)).toEqual(['src/auth.ts', 'README.md']);
    expect(results[0]).toMatchObject({
      mention: 'src/auth.ts:12:4',
      candidate: 'src/auth.ts',
      normalizedCandidate: 'src/auth.ts',
      kind: 'relative-path',
      confidence: 'exact',
      referencedLine: 12,
      referencedColumn: 4,
      ambiguous: false,
    });
    expect(results[0]?.textRange).toMatchObject({ line: 1, column: 16 });
    expect(results[1]).toMatchObject({ kind: 'basename', confidence: 'basename' });
  });

  it('matches quoted paths, markdown link targets, file URLs, absolute paths, and arrays of text', () => {
    const engine = new PathSearchEngine([
      file('src/auth.ts', '/repo/src/auth.ts'),
      file('docs/guide.md', '/repo/docs/guide.md'),
      file('src/with space.ts', '/repo/src/with space.ts'),
    ]);
    const textBlocks = [
      'See `[guide](docs/guide.md#L7)` and "src/with space.ts".',
      'Runtime pointed at file:///repo/src/auth.ts and /repo/docs/guide.md:22.',
    ];

    const results = engine.searchTextForPaths(textBlocks, { maxResults: 10 });

    expect(
      results.map((result) => [result.path, result.referencedLine, result.kind, result.textRange.sourceIndex]),
    ).toEqual([
      ['docs/guide.md', 7, 'relative-path', 0],
      ['src/with space.ts', null, 'relative-path', 0],
      ['src/auth.ts', null, 'file-url', 1],
      ['docs/guide.md', 22, 'absolute-path', 1],
    ]);
  });

  it('handles case-insensitive matches, suffix paths, and Windows-style separators', () => {
    const engine = new PathSearchEngine([file('packages/app/src/AuthService.ts'), file('src/routes.ts')]);
    const results = engine.searchTextForPaths(
      'Open packages\\app\\src\\AuthService.ts, SRC/ROUTES.TS, and app/src/AuthService.ts.',
    );

    expect(results.map((result) => [result.path, result.confidence])).toEqual([
      ['packages/app/src/AuthService.ts', 'exact'],
      ['src/routes.ts', 'case-insensitive'],
      ['packages/app/src/AuthService.ts', 'suffix'],
    ]);
  });

  it('returns ambiguous basename matches by default and can suppress them', () => {
    const engine = new PathSearchEngine([file('src/index.ts'), file('test/index.ts'), file('src/auth.ts')]);
    const results = engine.searchTextForPaths('index.ts and auth.ts');

    expect(results.filter((result) => result.path.endsWith('index.ts')).map((result) => result.confidence)).toEqual([
      'ambiguous-basename',
      'ambiguous-basename',
    ]);
    expect(results.find((result) => result.path === 'src/index.ts')?.alternatives).toEqual(['test/index.ts']);
    expect(results.find((result) => result.path === 'src/auth.ts')?.confidence).toBe('basename');
    expect(engine.searchTextForPaths('index.ts', { includeAmbiguousBasenames: false })).toEqual([]);
  });

  it('respects maxResults, paths, include, exclude, basename, and case sensitivity options', () => {
    const engine = new PathSearchEngine([file('src/auth.ts'), file('docs/auth.md'), file('README.md')]);

    expect(engine.searchTextForPaths('src/auth.ts docs/auth.md README.md', { maxResults: 2 })).toHaveLength(2);
    expect(
      engine.searchTextForPaths('src/auth.ts docs/auth.md', { paths: ['docs/auth.md'] }).map((result) => result.path),
    ).toEqual(['docs/auth.md']);
    expect(
      engine.searchTextForPaths('src/auth.ts docs/auth.md', { include: ['src/*.ts'] }).map((result) => result.path),
    ).toEqual(['src/auth.ts']);
    expect(
      engine.searchTextForPaths('src/auth.ts docs/auth.md', { exclude: ['docs/**'] }).map((result) => result.path),
    ).toEqual(['src/auth.ts']);
    expect(engine.searchTextForPaths('README.md', { includeBasenames: false })).toEqual([]);
    expect(engine.searchTextForPaths('SRC/AUTH.TS', { caseSensitive: true })).toEqual([]);
  });

  it('ignores URL-like and extension-like text unless it maps to a repository file', () => {
    const engine = new PathSearchEngine([file('src/auth.ts'), file('Dockerfile'), file('src/%E0%A4%A.ts')]);
    const ignored = engine.searchTextForPaths('Visit https://example.com, use version 1.2.3, then open missing.ts.');
    expect(ignored).toEqual([]);

    const matched = engine.searchTextForPaths('Dockerfile references src/%E0%A4%A.ts.');
    expect(matched.map((result) => result.path)).toEqual(['Dockerfile', 'src/%E0%A4%A.ts']);
  });

  it('exposes a standalone function for callers without constructing an engine', () => {
    const results = searchTextForPaths('Review `src/auth.ts#L9`.', [file('src/auth.ts')]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ path: 'src/auth.ts', referencedLine: 9 });
  });

  it('is exposed through LocalRepoSearch for repository-aware agent workflows', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({ root, useGit: false, backend: 'node' });
    const mentions = repo.searchTextForPaths('The failing review mentions src/auth.ts:5 and README.md.');

    expect(mentions.map((mention) => mention.path)).toEqual(['src/auth.ts', 'README.md']);
    expect(repo.findPathMentions('src/routes.ts')[0]?.path).toBe('src/routes.ts');
  });

  it('reports multi-line text ranges and the full PathMention shape', () => {
    const engine = new PathSearchEngine([file('src/auth.ts'), file('a/x/README.md'), file('b/README.md')]);
    const [mention] = engine.searchTextForPaths('First line\r\nthen (src/auth.ts:3), done');

    expect(mention).toEqual({
      mention: 'src/auth.ts:3',
      candidate: 'src/auth.ts',
      normalizedCandidate: 'src/auth.ts',
      path: 'src/auth.ts',
      absolutePath: '/repo/src/auth.ts',
      basename: 'auth.ts',
      extension: '.ts',
      language: 'typescript',
      kind: 'relative-path',
      confidence: 'exact',
      score: 100,
      textRange: { offset: 18, endOffset: 31, line: 2, column: 7, endLine: 2, endColumn: 20, sourceIndex: null },
      referencedLine: 3,
      referencedColumn: null,
      ambiguous: false,
      alternatives: null,
    });
    expect(PathMentionSchema.parse(mention)).toEqual(mention);

    const ambiguous = engine.searchTextForPaths('see README.md');
    expect(ambiguous.map((result) => [result.path, result.score, result.ambiguous, result.alternatives])).toEqual([
      ['a/x/README.md', 55, true, ['b/README.md']],
      ['b/README.md', 55, true, ['a/x/README.md']],
    ]);
    expect(engine.searchTextForPaths('x/README.md')[0]).toMatchObject({ path: 'a/x/README.md', confidence: 'suffix' });
    expect(engine.searchTextForPaths('see README.md', { maxResults: 0 })).toEqual([]);
  });

  it('rejects malformed file URLs and unknown files', () => {
    const engine = new PathSearchEngine([file('src/auth.ts')]);
    expect(engine.searchTextForPaths('file://remote-host/x.ts and src/missing.ts')).toEqual([]);
    expect(
      engine.findPathMentions('C:\\work\\src\\auth.ts:7').map((m) => [m.path, m.confidence, m.referencedLine]),
    ).toEqual([['src/auth.ts', 'suffix', 7]]);
  });
});

describe('PathMention schemas', () => {
  const range = { offset: 0, endOffset: 4, line: 1, column: 1, endLine: 1, endColumn: 5, sourceIndex: null };

  it('accepts consistent text ranges', () => {
    expect(PathMentionTextRangeSchema.parse(range)).toEqual(range);
  });

  it('reports custom issues for inverted offsets, lines, and columns', () => {
    const result = PathMentionTextRangeSchema.safeParse({ ...range, endOffset: 0, offset: 3, endColumn: 1, column: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.code, issue.path.join('.')])).toEqual([
      ['custom', 'endOffset'],
      ['custom', 'endColumn'],
    ]);
    const lines = PathMentionTextRangeSchema.safeParse({ ...range, line: 3, endLine: 2 });
    expect(lines.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['endLine']);
  });
});
