import { describe, expect, it } from 'vitest';
import {
  ChildProcessCommandExecutor,
  CommandFailedError,
  LocalRepoSearch,
  RipgrepError,
  ripgrepAvailable,
} from '../../src/repo-search/index.js';
import { searchRegexWithRipgrep, searchTextWithRipgrep } from '../../src/repo-search/search/ripgrep.js';
import { makeFixtureRepo } from './helpers.js';

const hasRipgrep = await ripgrepAvailable();

describe('ripgrep availability on this machine', () => {
  it('agrees between the PATH lookup and a probe through the child-process executor', async () => {
    expect(await ripgrepAvailable(new ChildProcessCommandExecutor())).toBe(hasRipgrep);
  });
});

describe.skipIf(!hasRipgrep)('ripgrep backend (requires rg on PATH)', () => {
  it('runs literal and regex searches with context on both sides', async () => {
    const root = await makeFixtureRepo();
    const text = await searchTextWithRipgrep(root, 'permission-check', {
      maxResults: 5,
      contextBefore: 1,
      contextAfter: 1,
      include: ['src/*.ts'],
    });
    expect(text[0]).toMatchObject({
      path: 'src/auth.ts',
      line: 6,
      contextBefore: ['  validatePermission(user: User, action: string): boolean {'],
      contextAfter: ["    return user.roles.includes('admin') || action === 'read';"],
      metadata: { backend: 'ripgrep' },
    });
    expect(text[0]?.matches[0]?.text).toBe('permission-check');

    const regex = await searchRegexWithRipgrep(root, 'validate[A-Za-z]+', {
      maxResults: 5,
      flags: 'i',
      include: ['src/*.ts'],
      exclude: ['src/types.ts'],
    });
    expect(regex.length).toBeGreaterThan(0);
    expect(regex.every((result) => result.method === 'regex')).toBe(true);
    expect(await searchTextWithRipgrep(root, 'not-present-anywhere', { maxResults: 5 })).toEqual([]);
  });

  it('agrees with the Node backend on indexed files', async () => {
    const root = await makeFixtureRepo();
    const viaRipgrep = await LocalRepoSearch.create({ root, useGit: false, backend: 'ripgrep' });
    const viaNode = await LocalRepoSearch.create({ root, useGit: false, backend: 'node' });
    const summarize = (results: { path: string; line: number; column?: number }[]): string[] =>
      results.map((r) => `${r.path}:${r.line}:${r.column ?? 0}`).sort();
    expect(summarize(await viaRipgrep.searchText('validatePermission'))).toEqual(
      summarize(await viaNode.searchText('validatePermission')),
    );
  });

  it('falls back to Node under auto and reports forced ripgrep failures', async () => {
    const root = await makeFixtureRepo();
    const jsValidRgInvalid = '(secret)-\\1';
    const auto = await LocalRepoSearch.create({ root, useGit: false, backend: 'auto' });
    expect(Array.isArray(await auto.searchRegex(jsValidRgInvalid, { maxResults: 5 }))).toBe(true);
    const forced = await LocalRepoSearch.create({ root, useGit: false, backend: 'ripgrep' });
    const error = await forced.searchRegex(jsValidRgInvalid, { maxResults: 5 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RipgrepError);
    expect((error as Error).cause).toBeInstanceOf(CommandFailedError);
  });

  it('runs through an explicitly supplied executor', async () => {
    const root = await makeFixtureRepo();
    const repo = await LocalRepoSearch.create({
      root,
      useGit: false,
      backend: 'ripgrep',
      executor: new ChildProcessCommandExecutor(),
    });
    const results = await repo.searchText('validatePermission');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.metadata?.backend === 'ripgrep')).toBe(true);
  });
});
