import { describe, expect, it } from 'vitest';
import { LocalRepoSearch } from '../../src/repo-search/index.js';
import { SearchDocumentStore } from '../../src/repo-search/core/searchDocumentStore.js';
import { RepoSearchError } from '../../src/repo-search/errors.js';
import {
  DEFAULT_HYBRID_SEARCH_WEIGHTS,
  defaultHybridSearchMethods,
  reciprocalRankFusion,
} from '../../src/repo-search/search/hybrid.js';
import {
  compareResults,
  createAnchoredResult,
  createResult,
  previewExcerpt,
  rankResults,
  snippetExcerpt,
} from '../../src/repo-search/search/results.js';
import { extractStackTraceFrames, searchStackTrace } from '../../src/repo-search/search/stackTrace.js';
import { InMemoryVectorIndex } from '../../src/repo-search/search/vector.js';
import type { SearchResult } from '../../src/repo-search/types.js';
import { makeFixtureRepo, writeFile } from './helpers.js';

function result(repoPath: string, line: number, method: SearchResult['method'], score = 1): SearchResult {
  return createResult({
    method,
    source: { path: repoPath, absolutePath: `/repo/${repoPath}`, language: 'typescript' },
    score,
    line,
    excerpt: previewExcerpt(`${repoPath}:${line}`),
  });
}

describe('result helpers', () => {
  it('rank by score, then path, then line', () => {
    const results = [
      result('b.ts', 1, 'text', 1),
      result('a.ts', 9, 'text', 1),
      result('a.ts', 2, 'text', 1),
      result('z.ts', 1, 'text', 2),
    ];
    expect(rankResults(results, 3).map((r) => `${r.path}:${r.line}`)).toEqual(['z.ts:1', 'a.ts:2', 'a.ts:9']);
    expect(compareResults(result('a.ts', 1, 'text'), result('a.ts', 1, 'text'))).toBe(0);
  });

  it('build results with defaults and only the optional keys that are set', () => {
    const built = result('a.ts', 4, 'path');
    expect(built).toEqual({
      method: 'path',
      path: 'a.ts',
      absolutePath: '/repo/a.ts',
      score: 1,
      line: 4,
      endLine: 4,
      language: 'typescript',
      preview: 'a.ts:4',
      contextBefore: [],
      contextAfter: [],
      matches: [],
    });
    expect(createResult({ ...built, source: built, method: 'text', excerpt: previewExcerpt(built.preview) })).toEqual({
      ...built,
      method: 'text',
    });
  });

  it('build snippet excerpts and anchored results, falling back when lines are unavailable', () => {
    const lines = ['one', '  two   three  ', '', 'four'];
    expect(snippetExcerpt(lines, { line: 2, endLine: 2 }, 'fallback', 1, 1)).toEqual({
      preview: 'two three',
      contextBefore: ['one'],
      contextAfter: [''],
    });
    expect(snippetExcerpt(lines, { line: 3, endLine: 3 }, 'fallback', 0, 0).preview).toBe('fallback');
    expect(snippetExcerpt(undefined, { line: 3, endLine: 3 }, '  lonely  ', 2, 2)).toEqual(previewExcerpt('lonely'));

    const anchored = createAnchoredResult({
      method: 'symbol',
      source: { path: 'a.ts', absolutePath: '/repo/a.ts', language: 'typescript' },
      score: 5,
      line: 2,
      endLine: 4,
      column: 3,
      token: 'two',
      lines: undefined,
      fallbackPreview: 'const two = 2',
      metadata: { kind: 'demo' },
    });
    expect(anchored).toMatchObject({
      line: 2,
      endLine: 4,
      column: 3,
      preview: 'const two = 2',
      contextBefore: [],
      matches: [{ line: 2, column: 3, endLine: 2, endColumn: 6, text: 'two' }],
      metadata: { kind: 'demo' },
    });
    expect(anchored).not.toHaveProperty('endColumn');
  });
});

describe('hybrid fusion', () => {
  it('selects default methods based on query shape', () => {
    expect(defaultHybridSearchMethods('src/auth.ts')).toEqual([
      'path',
      'text',
      'bm25',
      'similarity',
      'dependency',
      'symbol',
    ]);
    expect(defaultHybridSearchMethods('validatePermission')).toEqual([
      'symbol',
      'text',
      'bm25',
      'similarity',
      'dependency',
      'path',
    ]);
    expect(defaultHybridSearchMethods('where are permissions checked')[0]).toBe('text');
  });

  it('fuses reciprocal ranks with weights, keeps the best representative, and merges channels', () => {
    const fused = reciprocalRankFusion(
      [
        { method: 'text', results: [result('src/auth.ts', 3, 'text'), result('src/logger.ts', 1, 'text')] },
        { method: 'symbol', results: [result('src/auth.ts', 4, 'symbol', 100)], weight: 2 },
        { method: 'path', results: [{ ...result('src/auth.ts', 1, 'path'), channels: ['regex'] }] },
      ],
      { maxResults: 10, rrfK: 10, methodWeights: { text: 1 } },
    );
    expect(fused.map((r) => [r.path, r.line, r.method])).toEqual([
      ['src/auth.ts', 4, 'hybrid'],
      ['src/auth.ts', 1, 'hybrid'],
      ['src/logger.ts', 1, 'hybrid'],
    ]);
    expect(fused[0]?.score).toBeCloseTo(1 / 11 + 2 / 11);
    expect(fused[0]?.channels).toEqual(['text', 'symbol']);
    expect(fused[0]?.metadata).toEqual({ originalMethod: 'symbol', fusionKey: 'src/auth.ts:1:' });
    expect(fused[1]?.channels).toEqual(['path', 'regex']);
    expect(fused[1]?.score).toBeCloseTo((DEFAULT_HYBRID_SEARCH_WEIGHTS.path ?? 0) / 11);
    expect(reciprocalRankFusion([], {})).toEqual([]);
  });
});

describe('stack trace search', () => {
  it('extracts JavaScript, Python, and generic frames inside the root and opens existing frames', async () => {
    const root = await makeFixtureRepo();
    await writeFile(root, 'image.bin', Buffer.from([0, 1, 2]));
    const repo = await LocalRepoSearch.create({ root, useGit: false, backend: 'node' });
    const trace = `
Error: broken
    at AuthService.validatePermission (${root}/src/auth.ts:5:11)
    at routeGuard (src/routes.ts:3:5)
  File "python/app.py", line 4, in login
    src/logger.ts:2
    src/logger.ts:2
    ../outside.ts:1:1
    src/missing.ts:9
    image.bin:1
`;
    const frames = extractStackTraceFrames(root, trace);
    expect(frames.map((f) => [f.path, f.line, f.column, f.exists])).toEqual([
      ['src/auth.ts', 5, 11, true],
      ['src/routes.ts', 3, 5, true],
      ['python/app.py', 4, undefined, true],
      ['src/logger.ts', 2, undefined, true],
      ['src/missing.ts', 9, undefined, false],
      ['image.bin', 1, undefined, true],
    ]);
    expect(frames[2]).not.toHaveProperty('column');

    const opened = await repo.searchStackTrace(trace, { contextBefore: 1, contextAfter: 1 });
    expect(opened.frames).toHaveLength(6);
    expect(opened.opened.map((o) => o.path)).toEqual([
      'src/auth.ts',
      'src/routes.ts',
      'python/app.py',
      'src/logger.ts',
    ]);
    expect(opened.opened[0]).toMatchObject({ line: 4, endLine: 6 });

    const limited = await searchStackTrace(root, new SearchDocumentStore(repo.documents), trace, { maxFrames: 1 });
    expect(limited.frames).toHaveLength(1);
    expect(limited.opened[0]).toMatchObject({ line: 2, endLine: 8 });
  });
});

describe('in-memory local vector index', () => {
  it('stores normalized vectors, ranks by cosine similarity, filters by min score, and validates dimensions', () => {
    const index = new InMemoryVectorIndex<{ path: string }>();
    expect(index.search([1, 0])).toEqual([]);
    expect(() => index.add({ id: 'empty', vector: [], metadata: { path: 'x' } })).toThrow(RepoSearchError);
    index.add({ id: 'a', vector: [2, 0], metadata: { path: 'a.ts' } });
    index.addMany([
      { id: 'b', vector: [0, 1], metadata: { path: 'b.ts' } },
      { id: 'zero', vector: [0, 0], metadata: { path: 'zero.ts' } },
    ]);
    expect(index.size()).toBe(3);
    expect(() => index.add({ id: 'bad', vector: [1, 2, 3], metadata: { path: 'bad.ts' } })).toThrow(
      /dimension mismatch: expected 2, got 3/,
    );
    expect(() => index.search([1, 2, 3])).toThrow(/dimension/);
    const results = index.search([1, 0], { maxResults: 2, minScore: 0 });
    expect(results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(results[0]?.vector).toEqual([1, 0]);
    expect(index.search([1, 0], { minScore: 0.1 }).map((r) => r.id)).toEqual(['a']);
    expect(results[0]?.score).toBeCloseTo(1);
    index.clear();
    expect(index.size()).toBe(0);
    expect(index.search([1, 0])).toEqual([]);
  });
});
