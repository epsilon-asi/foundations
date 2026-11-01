import { describe, expect, it } from 'vitest';
import { SearchDocumentStore } from '../../src/repo-search/core/searchDocumentStore.js';
import { buildChunks } from '../../src/repo-search/search/chunks.js';
import { PathSearchEngine, scorePath } from '../../src/repo-search/search/pathSearch.js';
import { RankedIndex } from '../../src/repo-search/search/ranked.js';
import { splitIdentifier, termFrequency, tokenize, tokenizePath } from '../../src/repo-search/search/tokenizer.js';
import { makeDocument, makeFileEntry, makeStore } from './helpers.js';

describe('tokenization and chunking', () => {
  it('splits identifiers, removes stopwords by default, keeps path tokens, and counts frequencies', () => {
    expect(splitIdentifier('validateHTTPToken_auth.service')).toEqual(['validate', 'HTTP', 'Token', 'auth', 'service']);
    expect(tokenize('return the AuthService and validateHTTPToken')).toEqual([
      'auth',
      'service',
      'validate',
      'http',
      'token',
    ]);
    expect(tokenize('return the AuthService', { keepStopwords: true })).toContain('return');
    expect(tokenize('a bb ccc', { minLength: 3, keepStopwords: true })).toEqual(['ccc']);
    expect(tokenizePath('src/auth-service/AuthService.ts')).toContain('auth');
    expect([...termFrequency(['a', 'a', 'b']).entries()]).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });

  it('builds overlapping line chunks and handles empty documents', () => {
    const docs = [
      makeDocument('src/a.ts', 'one\ntwo\nthree\nfour\nfive', 'typescript', 0),
      makeDocument('empty.ts', '', 'typescript', 1),
    ];
    const chunks = buildChunks(docs, { chunkLines: 3, chunkOverlap: 1 });
    expect(chunks.map((c) => [c.id, c.documentId, c.path, c.startLine, c.endLine])).toEqual([
      [0, 0, 'src/a.ts', 1, 3],
      [1, 0, 'src/a.ts', 3, 5],
      [2, 1, 'empty.ts', 1, 1],
    ]);
    expect(chunks[0]?.termFrequency.has('one')).toBe(true);
    expect(chunks[0]?.pathTokens).toContain('src');
    expect(buildChunks(docs, { chunkLines: 0, chunkOverlap: 5 }).filter((c) => c.path === 'src/a.ts')).toHaveLength(5);
  });
});

describe('path search', () => {
  it('scores exact, basename, substring, token, and subsequence path matches', () => {
    expect(scorePath('src/auth.ts', 'src/auth.ts', [])).toBe(100);
    expect(scorePath('src/auth.ts', 'auth.ts', [])).toBe(95);
    expect(scorePath('src/features/auth.ts', 'features/auth.ts', [])).toBe(90);
    expect(scorePath('src/auth-service.ts', 'auth', ['auth'])).toBeGreaterThan(70);
    expect(scorePath('src/auth-service.ts', 'service auth', ['service', 'auth'])).toBe(55);
    expect(scorePath('src/auth-service.ts', 'asv', ['asv'])).toBeGreaterThan(0);
    expect(scorePath('src/auth-service.ts', 'zzz', ['zzz'])).toBe(0);
    expect(scorePath('src/auth-service.ts', '', [])).toBe(0);
  });

  it('filters and sorts fuzzy path results', () => {
    const engine = new PathSearchEngine([
      makeFileEntry('src/auth.ts'),
      makeFileEntry('src/router.ts'),
      makeFileEntry('docs/auth-guide.md'),
    ]);
    expect(engine.search('  ', { maxResults: 10 })).toEqual([]);
    const results = engine.search('auth', { maxResults: 2 });
    expect(results.map((r) => r.path)).toEqual(['src/auth.ts', 'docs/auth-guide.md']);
    expect(results[0]).toMatchObject({
      method: 'path',
      line: 1,
      endLine: 1,
      preview: 'src/auth.ts',
      language: 'typescript',
      metadata: { basename: 'auth.ts', extension: '.ts', size: 12 },
    });
    expect(engine.search('auth', { paths: ['docs/auth-guide.md'] }).map((r) => r.path)).toEqual(['docs/auth-guide.md']);
    expect(engine.search('auth', { include: ['src/*.ts'], exclude: ['src/auth.ts'] })).toEqual([]);
    expect(engine.search('AUTH', { caseSensitive: true })).toEqual([]);
    expect(engine.search('auth.ts router', { caseSensitive: true }).map((r) => r.path)).toContain('src/router.ts');
  });

  it('falls back to the inferred language when a file entry has none', () => {
    const engine = new PathSearchEngine([{ ...makeFileEntry('src/a.py'), language: '' }]);
    expect(engine.search('a.py')[0]?.language).toBe('python');
  });
});

describe('ranked indexes', () => {
  const store = makeStore([
    makeDocument('src/auth.ts', 'validate permission admin role\nvalidate token permission'),
    makeDocument('src/routes.ts', 'router middleware request response'),
    makeDocument('docs/auth.md', 'authentication permission guide admin'),
  ]);
  const index = new RankedIndex(store, { chunkLines: 2, chunkOverlap: 0 });

  it('owns its chunks', () => {
    expect(index.chunks.map((chunk) => [chunk.path, chunk.startLine, chunk.endLine])).toEqual([
      ['src/auth.ts', 1, 2],
      ['src/routes.ts', 1, 1],
      ['docs/auth.md', 1, 1],
    ]);
  });

  it('returns BM25 results with metadata and path/include filters', () => {
    expect(index.searchBM25('', { maxResults: 10 })).toEqual([]);
    const results = index.searchBM25('admin permission', { maxResults: 10 });
    expect(results[0]).toMatchObject({
      method: 'bm25',
      path: 'src/auth.ts',
      line: 1,
      endLine: 2,
      preview: 'validate permission admin role validate token permission',
      contextBefore: [],
      contextAfter: [],
      matches: [],
      metadata: { query: 'admin permission', chunkId: 0, documentId: 0, chunkStartLine: 1, chunkEndLine: 2 },
    });
    expect(results.map((r) => r.score)).toEqual([...results.map((r) => r.score)].sort((a, b) => b - a));
    expect(index.searchBM25('admin permission', { paths: ['docs/auth.md'] }).map((r) => r.path)).toEqual([
      'docs/auth.md',
    ]);
    expect(index.searchBM25('admin permission', { include: ['src/*.ts'], exclude: ['src/auth.ts'] })).toEqual([]);
    expect(index.searchBM25('router', { k1: 1.2, b: 0.2, pathBoost: 0 })[0]?.path).toBe('src/routes.ts');
    expect(index.searchBM25('nothing-matches-this')).toEqual([]);
  });

  it('includes requested context lines around a chunk', () => {
    const lineIndex = new RankedIndex(store, { chunkLines: 1, chunkOverlap: 0 });
    expect(lineIndex.searchBM25('role', { contextBefore: 1, contextAfter: 1 })[0]).toMatchObject({
      line: 1,
      preview: 'validate permission admin role',
      contextBefore: [],
      contextAfter: ['validate token permission'],
    });
  });

  it('returns local TF-IDF similarity results with stable ordering', () => {
    expect(index.searchSimilarity('', { maxResults: 10 })).toEqual([]);
    const results = index.searchSimilarity('authentication guide', { maxResults: 10, pathBoost: 0.2 });
    expect(results[0]).toMatchObject({ path: 'docs/auth.md', method: 'similarity' });
    expect(index.searchSimilarity('admin', { include: ['src/*.ts'] }).every((r) => r.path.startsWith('src/'))).toBe(
      true,
    );
    expect(index.searchSimilarity('unseen-term')).toEqual([]);
    expect(index.searchSimilarity('admin', { maxResults: 1 })).toHaveLength(1);
  });

  it('handles an empty store', () => {
    const empty = new RankedIndex(new SearchDocumentStore([]), { chunkLines: 10, chunkOverlap: 0 });
    expect(empty.chunks).toEqual([]);
    expect(empty.searchBM25('anything')).toEqual([]);
    expect(empty.searchSimilarity('anything')).toEqual([]);
  });
});
