import { describe, expect, it } from 'vitest';
import * as repoSearch from '../../src/repo-search/index.js';
import { createRepoSearch, LocalRepoSearch } from '../../src/repo-search/index.js';
import type { CallGraphEdge, QuerySearchMethod } from '../../src/repo-search/index.js';
import * as shared from '../../src/shared/index.js';
import { FakeCommandExecutor } from './fakeExecutor.js';
import { makeFixtureRepo, writeFile } from './helpers.js';

describe('LocalRepoSearch integration', () => {
  it('builds all local indexes and exposes the repository-search utility surface', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({
      root,
      useGit: false,
      backend: 'node',
      chunkLines: 4,
      chunkOverlap: 1,
      concurrency: 2,
    });
    expect(repo.root).toBe(root);
    expect(repo.stats).toMatchObject({
      root,
      filesDiscovered: repo.files.length,
      filesIndexed: repo.documents.length,
      chunksIndexed: repo.chunks.length,
      symbolsIndexed: repo.listSymbols().length,
      dependenciesIndexed: repo.listDependencies().length,
    });
    expect(repo.stats.filesIndexed).toBe(repo.stats.filesDiscovered - 1);
    expect(repo.stats.chunksIndexed).toBeGreaterThan(5);
    expect(repo.stats.symbolsIndexed).toBeGreaterThan(5);
    expect(repo.stats.dependenciesIndexed).toBeGreaterThan(5);
    expect(repo.stats.skippedFiles).toBeGreaterThan(1);
    expect(repo.stats.buildMs).toBeGreaterThanOrEqual(0);

    expect(repo.listFiles().some((file) => file.path === 'src/auth.ts')).toBe(true);
    expect(repo.listSymbols().some((symbol) => symbol.name === 'validatePermission')).toBe(true);
    expect(repo.listDependencies().some((dep) => dep.specifier === './auth')).toBe(true);
    const opened = await repo.openFile('src/auth.ts', { line: 4, contextBefore: 1, contextAfter: 1 });
    expect(opened.text).toContain('validatePermission');
    expect((await repo.searchText('secret-token', { wholeWord: false }))[0]?.path).toBe('src/auth.ts');
    expect((await repo.searchRegex('validate[A-Za-z]+', { flags: 'i', include: ['src/*.ts'] }))[0]?.path).toBe(
      'src/auth.ts',
    );
    expect(repo.searchPaths('auth')[0]?.path).toBe('src/auth.ts');
    expect(repo.searchBM25('admin permission')[0]?.path).toBe('src/auth.ts');
    expect(repo.searchSimilarity('authentication routes')[0]?.path).toMatch(/README|routes|auth/);
    expect(repo.searchSymbols('validatePermission', { exact: true })[0]?.path).toBe('src/auth.ts');
    expect(repo.findDefinition('validatePermission')[0]?.line).toBe(5);
    expect((await repo.findReferences('validatePermission')).length).toBeGreaterThan(1);
    expect(
      repo.structuralSearch({ name: 'validate', kind: ['function', 'method'], nearText: 'permission-check' })[0]?.path,
    ).toBe('src/auth.ts');
    expect(repo.searchDependencies('./auth')[0]?.path).toBe('src/routes.ts');
    expect(repo.findImporters('./auth')[0]?.path).toBe('src/routes.ts');
    expect(repo.dependenciesForFile('src/routes.ts').map((d) => d.specifier)).toContain('./auth');
    expect(repo.buildCallGraph().some((edge) => edge.callee.name === 'auditLog')).toBe(true);
    expect(
      repo
        .findCallers('validatePermission')
        .some((result) => (result.metadata?.edge as CallGraphEdge).caller.name === 'routeGuard'),
    ).toBe(true);
    expect(repo.findCallees('routeGuard').some((result) => result.preview.includes('validatePermission'))).toBe(true);
    expect(repo.searchTests('routeGuard')[0]?.path).toBe('tests/auth.test.ts');

    const hybrid = await repo.hybridSearch('validatePermission', { maxResults: 5 });
    expect(hybrid[0]?.method).toBe('hybrid');
    expect(hybrid[0]?.channels).toEqual(expect.arrayContaining(['symbol', 'text']));
    expect(hybrid.length).toBeLessThanOrEqual(5);

    const rebuilt = await repo.rebuild();
    expect(rebuilt.stats.filesIndexed).toBe(repo.stats.filesIndexed);
  });

  it('dispatches every query method by name through search()', async () => {
    const repo = await LocalRepoSearch.create({ root: await makeFixtureRepo(), useGit: false, backend: 'node' });
    const expectations: Record<QuerySearchMethod | 'hybrid', [query: string, path: string]> = {
      text: ['permission-check', 'src/auth.ts'],
      regex: ['permission-\\w+', 'src/auth.ts'],
      path: ['routes', 'src/routes.ts'],
      bm25: ['admin permission', 'src/auth.ts'],
      similarity: ['admin action', 'src/auth.ts'],
      symbol: ['registerRoutes', 'src/routes.ts'],
      dependency: ['./logger', 'src/auth.ts'],
      hybrid: ['registerRoutes', 'src/routes.ts'],
    };
    for (const [method, [query, path]] of Object.entries(expectations)) {
      const results = await repo.search(method as QuerySearchMethod | 'hybrid', query, { maxResults: 3 });
      expect(results[0]?.path, method).toBe(path);
      expect(results[0]?.method, method).toBe(method);
    }
    await expect(repo.search('regex', '(')).rejects.toThrow(SyntaxError);
  });

  it('supports createRepoSearch, include filters, and hybrid degradation', async () => {
    const root = await makeFixtureRepo();
    const repo = await createRepoSearch({
      root,
      useGit: false,
      backend: 'node',
      include: ['src/*.ts'],
      exclude: ['src/types.ts'],
    });
    expect(repo.listFiles().every((file) => file.path.startsWith('src/'))).toBe(true);
    expect(repo.listFiles().some((file) => file.path === 'src/types.ts')).toBe(false);
    expect(await repo.searchText('validatePermission', { backend: 'node' })).toHaveLength(2);

    const degraded = await repo.hybridSearch('(', { methods: ['regex', 'text', 'path', 'callgraph', 'stacktrace'] });
    expect(
      degraded.every((result) => result.channels?.every((channel) => channel === 'text' || channel === 'path')),
    ).toBe(true);
    expect(await repo.hybridSearch('validatePermission', { methods: [] })).toEqual([]);
  });

  it('sees filesystem changes after rebuild', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({ root, useGit: false, backend: 'node' });
    await writeFile(root, 'src/new-feature.ts', 'export function newFeature() { return true; }\n');
    const rebuilt = await repo.rebuild();
    expect(rebuilt.listFiles().some((file) => file.path === 'src/new-feature.ts')).toBe(true);
    expect(repo.listFiles().some((file) => file.path === 'src/new-feature.ts')).toBe(false);
  });
});

describe('public API', () => {
  it('re-exports the shared executor and errors its options and failures use', () => {
    expect(repoSearch.ChildProcessCommandExecutor).toBe(shared.ChildProcessCommandExecutor);
    expect(repoSearch.CommandExecutionError).toBe(shared.CommandExecutionError);
    expect(repoSearch.CommandFailedError).toBe(shared.CommandFailedError);
    expect(repoSearch.SandboxError).toBe(shared.SandboxError);
    expect(new repoSearch.RipgrepError('x')).toBeInstanceOf(shared.SandboxError);
  });

  it('discovers files through a caller-supplied executor and keeps it across rebuilds', async () => {
    const root = await makeFixtureRepo();
    const executor = new FakeCommandExecutor(({ args }) =>
      args[0] === 'rev-parse' ? { stdout: 'true\n' } : { stdout: 'src/auth.ts\0README.md\0' },
    );
    const repo = await LocalRepoSearch.create({ root, executor, backend: 'node' });
    expect(repo.listFiles().map((file) => file.path)).toEqual(['README.md', 'src/auth.ts']);
    expect(repo.options.executor).toBe(executor);

    const rebuilt = await repo.rebuild();
    expect(rebuilt.listFiles()).toHaveLength(2);
    expect(executor.callsTo('git')).toHaveLength(4);
  });
});
