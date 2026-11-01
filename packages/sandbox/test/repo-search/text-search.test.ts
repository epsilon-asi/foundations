import { describe, expect, it } from 'vitest';
import { TextSearchEngine, regexFromLiteral } from '../../src/repo-search/search/textSearch.js';
import { makeDocument, makeStore } from './helpers.js';

describe('TextSearchEngine', () => {
  const engine = new TextSearchEngine(
    makeStore([
      makeDocument(
        'src/auth.ts',
        'alpha validatePermission beta\nvalidate validatePermissionExtra\nGamma validatePermission',
      ),
      makeDocument('src/router.ts', 'router uses routeGuard and validatePermission'),
      makeDocument('README.md', 'Validatepermission appears with different case'),
      makeDocument('src/crlf.ts', 'first line\r\nsecond target\r\nthird target'),
    ]),
  );

  it('performs literal search with case sensitivity, whole words, contexts, limits, and path filters', () => {
    expect(engine.searchText('', { maxResults: 5 })).toEqual([]);
    const insensitive = engine.searchText('validatepermission', { maxResults: 10 });
    expect(insensitive.map((r) => r.path)).toEqual(expect.arrayContaining(['src/auth.ts', 'README.md']));
    expect(insensitive.find((r) => r.path === 'README.md')?.matches[0]?.text).toBe('Validatepermission');
    expect(engine.searchText('validatepermission', { caseSensitive: true })).toHaveLength(0);

    const wholeWord = engine.searchText('validatePermission', { wholeWord: true, contextBefore: 1, contextAfter: 1 });
    expect(wholeWord).toHaveLength(4);
    expect(wholeWord.some((r) => r.preview.includes('validatePermissionExtra'))).toBe(false);
    expect(wholeWord[0]).toMatchObject({
      method: 'text',
      score: 1,
      line: 1,
      endLine: 1,
      column: 7,
      endColumn: 25,
      preview: 'alpha validatePermission beta',
      contextBefore: [],
      contextAfter: ['validate validatePermissionExtra'],
      matches: [{ line: 1, column: 7, endLine: 1, endColumn: 25, text: 'validatePermission' }],
    });
    expect(wholeWord[1]).toMatchObject({ line: 3, column: 7, contextBefore: ['validate validatePermissionExtra'] });

    expect(engine.searchText('validatePermission', { wholeWord: true, include: ['src/*.ts'] })).toHaveLength(3);
    expect(engine.searchText('validatePermission', { paths: ['./src/router.ts'] })).toHaveLength(1);
    expect(
      engine.searchText('validatePermission', { include: ['src/*.ts'], exclude: ['src/router.ts'] }).map((r) => r.path),
    ).toEqual(['src/auth.ts', 'src/auth.ts', 'src/auth.ts']);
    expect(engine.searchText('validatePermission', { maxResults: 1 })).toHaveLength(1);
  });

  it('reports positions on the right line for CRLF documents', () => {
    const literal = engine.searchText('target', { paths: ['src/crlf.ts'] });
    expect(literal.map((r) => [r.line, r.column])).toEqual([
      [2, 8],
      [3, 7],
    ]);
    const regex = engine.searchRegex('tar\\w+', { paths: ['src/crlf.ts'] });
    expect(regex.map((r) => [r.line, r.column, r.preview])).toEqual([
      [2, 8, 'second target'],
      [3, 7, 'third target'],
    ]);
  });

  it('performs line regex and multiline regex searches with normalized flags', () => {
    const lineResults = engine.searchRegex(/validatePermission(Extra)?/i, { maxResults: 10 });
    expect(lineResults.length).toBeGreaterThanOrEqual(4);
    expect(lineResults[0]).toMatchObject({ method: 'regex', score: 0.95 });

    const byString = engine.searchRegex('router\\s+uses', { flags: 'iiimx', include: ['src/*.ts'] });
    expect(byString).toHaveLength(1);
    expect(byString[0]?.path).toBe('src/router.ts');

    const multiline = engine.searchRegex('beta\\nvalidate', { multiline: true });
    expect(multiline).toHaveLength(1);
    expect(multiline[0]).toMatchObject({ line: 1, endLine: 2, column: 26, endColumn: 9 });

    expect(engine.searchRegex('^', { maxResults: 5 })).toEqual([]);
    expect(engine.searchRegex('^', { multiline: true })).toEqual([]);
    expect(engine.searchRegex('validate', { maxResults: 2 })).toHaveLength(2);
    expect(engine.searchRegex('validate', { multiline: true, maxResults: 2 })).toHaveLength(2);
  });

  it('builds safe regular expressions from literal search strings', () => {
    const regex = regexFromLiteral('a+b?', { wholeWord: true });
    expect(regex.test('a+b?')).toBe(true);
    expect(regex.source).toBe('\\ba\\+b\\?');
    expect(regexFromLiteral('Token', { wholeWord: true }).source).toBe('\\bToken\\b');
    expect(regexFromLiteral('x').flags).toBe('gi');
    const sensitive = regexFromLiteral('Token', { caseSensitive: true });
    expect(sensitive.flags).toBe('g');
    expect(sensitive.test('token')).toBe(false);
  });
});
