# Agent tooling guide

How to expose repo search (`@epsilon-asi/sandbox/repo-search`) as tools for a coding agent. A runnable version of the
tool surface is in [`examples/repo-search/agent-tools.ts`](../../examples/repo-search/agent-tools.ts).

## Minimal tools

```ts
import { LocalRepoSearch } from '@epsilon-asi/sandbox/repo-search';

const repo = await LocalRepoSearch.create({ root: process.cwd() });

export const searchRepo = (query: string) => repo.hybridSearch(query, { maxResults: 10 });
export const grepRepo = (query: string) =>
  repo.searchText(query, { maxResults: 50, contextBefore: 2, contextAfter: 2 });
export const pathsMentionedIn = (text: string | readonly string[]) => repo.searchTextForPaths(text, { maxResults: 50 });
export const openSource = (path: string, line: number, endLine = line) =>
  repo.openFile(path, { line, endLine, contextBefore: 5, contextAfter: 5 });
```

## Full tool surface

```ts
export const repoTools = {
  search: (q: string) => repo.hybridSearch(q, { maxResults: 10 }),
  text: (q: string) => repo.searchText(q, { maxResults: 50 }),
  regex: (p: string) => repo.searchRegex(p, { maxResults: 50 }),
  paths: (q: string) => repo.searchPaths(q, { maxResults: 25 }),
  mentionedPaths: (text: string | readonly string[]) => repo.searchTextForPaths(text, { maxResults: 50 }),
  bm25: (q: string) => repo.searchBM25(q, { maxResults: 25 }),
  similar: (q: string) => repo.searchSimilarity(q, { maxResults: 25 }),
  symbols: (q: string) => repo.searchSymbols(q, { maxResults: 25 }),
  definition: (name: string) => repo.findDefinition(name),
  references: (name: string) => repo.findReferences(name),
  deps: (q: string) => repo.searchDependencies(q, { maxResults: 25 }),
  importers: (specifier: string) => repo.findImporters(specifier),
  callers: (name: string) => repo.findCallers(name),
  callees: (name: string) => repo.findCallees(name),
  tests: (q: string) => repo.searchTests(q),
  stack: (trace: string) => repo.searchStackTrace(trace),
  open: (path: string, line: number, endLine = line) =>
    repo.openFile(path, { line, endLine, contextBefore: 5, contextAfter: 5 }),
};
```

When the agent picks the channel itself, a single tool can take the method name:

```ts
import type { QuerySearchMethod } from '@epsilon-asi/sandbox/repo-search';

export const searchBy = (method: QuerySearchMethod | 'hybrid', query: string) =>
  repo.search(method, query, { maxResults: 20 });
```

## Query routing hints

- Exact identifier: `definition`, `references`, `text`, and `symbols`.
- Error string: `text` first.
- Looks like a file: `paths` first.
- The prompt, a log, or a review comment already names files, paths, or stack frames: `mentionedPaths` first, then
  `open`.
- Conceptual question: `search` (hybrid), then open the top results.
- Imports: `deps` or `importers`.
- Who calls something: `callers`, then verify in the source.
- A stack trace: `stack`.

## Verification rule

Do not let the agent answer from ranked results alone. Have it call `open` on the top candidates and quote line numbers
from the opened source.

## Monorepos

Create one index per package when possible:

```ts
const api = await LocalRepoSearch.create({ root: 'packages/api' });
const web = await LocalRepoSearch.create({ root: 'packages/web' });
```

Or scope one index with include/exclude globs:

```ts
const repo = await LocalRepoSearch.create({
  root: process.cwd(),
  include: ['packages/api/**', 'packages/shared/**'],
  exclude: ['**/fixtures/**'],
});
```

## Safety

Repo search never edits files. It reads local files and runs `git` and `rg` through its `CommandExecutor` (pass
`executor` to log or restrict them), plus a language server you configure for the LSP client. JavaScript regular expressions from untrusted input can be slow on large repositories; install ripgrep so
string patterns run there.
