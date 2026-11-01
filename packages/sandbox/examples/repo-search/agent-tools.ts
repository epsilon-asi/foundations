import { LocalRepoSearch } from '../../src/repo-search/index.js';

const repo = await LocalRepoSearch.create({ root: process.cwd() });

/** A tool surface for a coding agent: broad search first, then open and verify source. */
export const repoTools = {
  searchRepo: (query: string) => repo.hybridSearch(query, { maxResults: 10 }),
  grepRepo: (query: string) => repo.searchText(query, { maxResults: 50, contextBefore: 2, contextAfter: 2 }),
  regexRepo: (pattern: string) => repo.searchRegex(pattern, { maxResults: 50, contextBefore: 2, contextAfter: 2 }),
  mentionedPaths: (text: string | readonly string[]) => repo.searchTextForPaths(text, { maxResults: 50 }),
  findSymbol: (query: string) => repo.searchSymbols(query, { maxResults: 25 }),
  findDefinition: (name: string) => repo.findDefinition(name),
  findReferences: (name: string) => repo.findReferences(name),
  findImporters: (specifier: string) => repo.findImporters(specifier),
  openSource: (path: string, line: number, endLine = line) =>
    repo.openFile(path, { line, endLine, contextBefore: 5, contextAfter: 5 }),
};
