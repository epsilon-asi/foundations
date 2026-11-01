# Repo search

Local-only repository search for coding agents, part of `@epsilon-asi/sandbox`. One `LocalRepoSearch` instance indexes
a directory and answers:

- fuzzy path search and extraction of file paths mentioned in free text
- literal and regular-expression search (in-process, or via `rg` when available)
- BM25 lexical ranking and TF-IDF cosine similarity over line chunks
- heuristic symbol extraction, definitions, references, and structural symbol queries
- source import/dependency search with relative-specifier resolution
- an approximate call graph (callers and callees)
- test-file search and stack-trace-to-source lookup
- hybrid retrieval that fuses several channels with reciprocal-rank fusion
- an in-memory vector index for embeddings you compute locally
- an optional client for a local Language Server (`@epsilon-asi/sandbox/repo-search/lsp`)

Nothing leaves the machine: no network calls. The only commands run are `git` and `rg` (through a `CommandExecutor`)
and a language server you configure.

## Import

```ts
import { LocalRepoSearch } from '@epsilon-asi/sandbox/repo-search'; // this library's subpath
// or, from the flat package root: import { LocalRepoSearch } from '@epsilon-asi/sandbox';
import { LocalLspClient } from '@epsilon-asi/sandbox/repo-search/lsp';
```

The package is ESM-only, requires Node.js 24 or newer, and declares `zod@^4` as a peer dependency (the path-mention
schemas are zod schemas). Optional tools: `git` (exact ignore rules via `git ls-files`), `rg` (faster text/regex
search), and a language server such as `typescript-language-server` for the LSP client.

## Quick start

```ts
const repo = await LocalRepoSearch.create({ root: '/path/to/repo' });

const results = await repo.hybridSearch('where are user permissions validated?', { maxResults: 10 });
for (const result of results) {
  const source = await repo.openFile(result.path, {
    line: result.line,
    endLine: result.endLine,
    contextBefore: 3,
    contextAfter: 3,
  });
  console.log(source.numberedText);
}
```

Retrieval is a starting point: open the source and verify it before answering or editing.

## Search methods

| Method                                                                            | Use it for                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `searchPaths(query)`                                                              | File names, partial paths, acronyms (fuzzy).                                                    |
| `searchTextForPaths(text)` / `findPathMentions(text)`                             | Files explicitly named in prompts, logs, stack traces, or review comments.                      |
| `searchText(query)`                                                               | Identifiers, strings, error messages, config keys (literal; `wholeWord` option).                |
| `searchRegex(pattern)`                                                            | Code patterns (`flags`, `multiline`).                                                           |
| `searchBM25(query)` / `searchSimilarity(query)`                                   | Keyword and loose natural-language queries, ranked over line chunks.                            |
| `searchSymbols(query)` / `findDefinition(name)` / `structuralSearch`              | Classes, functions, types, methods; filter by kind, language, export, body text.                |
| `findReferences(name)`                                                            | Whole-word text references.                                                                     |
| `searchDependencies(query)` / `findImporters(spec)` / `dependenciesForFile(path)` | Imports, requires, `use`, `#include`.                                                           |
| `buildCallGraph()` / `findCallers(name)` / `findCallees(name)`                    | Approximate, name-based call relationships.                                                     |
| `searchTests(query)`                                                              | BM25 restricted to test files (`*.test.ts`, `*_test.go`, `test_*.py`, `tests/`).                |
| `searchStackTrace(trace)`                                                         | Resolve JavaScript, Python, and `path:line[:col]` frames and open the source.                   |
| `hybridSearch(query)`                                                             | Several channels fused with weighted reciprocal-rank fusion.                                    |
| `search(method, query)`                                                           | Any of `text`, `regex`, `path`, `bm25`, `similarity`, `symbol`, `dependency`, `hybrid` by name. |

Every result is a `SearchResult` with `path`, `absolutePath`, `line`/`endLine` (1-based), optional `column`/`endColumn`,
`preview`, `contextBefore`/`contextAfter`, `matches`, and method-specific `metadata`. The query methods accept
`maxResults` and the path-scope options `paths`, `include`, and `exclude` (glob-like, relative to the root).

```ts
await repo.searchText('DATABASE_URL', { wholeWord: true });
await repo.searchRegex('useEffect\\s*\\(', { flags: 'i', include: ['src/**'] });
repo.searchBM25('jwt refresh token expiration');
repo.findDefinition('validatePermission');
repo.structuralSearch({ kind: 'function', exported: true, signatureIncludes: 'permission' });
repo.findImporters('./auth');
repo.findCallers('validatePermission');
await repo.searchStackTrace(errorStack, { contextBefore: 3, contextAfter: 3 });
await repo.hybridSearch('router auth', { methods: ['text', 'bm25', 'symbol', 'path'], maxResults: 10 });
```

### Path mentions

`searchTextForPaths` finds relative and absolute paths, `file://` URLs, Windows separators, quoted paths, Markdown link
targets, bare filenames (`README.md`, `Dockerfile`), and `:line:column` / `#Lline` suffixes, and keeps only mentions that
resolve to indexed files. Bare filenames shared by several files are returned with `ambiguous-basename` confidence and
their `alternatives`.

```ts
import { PathMentionSchema, type PathMention } from '@epsilon-asi/sandbox/repo-search';

const mentions: PathMention[] = repo.findPathMentions('Fix src/auth.ts:42 and update README.md');
// mentions[0]: { path: 'src/auth.ts', referencedLine: 42, confidence: 'exact', textRange: { line: 1, column: 5, … }, … }
```

`PathMentionSchema` (and `PathMentionKindSchema`, `PathMentionConfidenceSchema`, `PathMentionTextRangeSchema`) are the
zod schemas behind the `PathMention` type, for embedding in your own schemas.

### Text and regex backends

`backend: 'auto'` (the default) and `'ripgrep'` use `rg` when it is available and fall back to the in-process engine
otherwise. When ripgrep fails (`CommandFailedError` for an error exit, signal, or timeout; `CommandExecutionError` when it
cannot be spawned or exceeds the output limit), `auto` falls back silently and `ripgrep` throws a `RipgrepError` with
that failure as its `cause`. ripgrep results are restricted to indexed files, so both backends search the same files.
String patterns may use ripgrep; `RegExp` objects always run in-process.

### Vector index

```ts
import { InMemoryVectorIndex } from '@epsilon-asi/sandbox/repo-search';

const index = new InMemoryVectorIndex<{ path: string; line: number }>();
index.add({ id: 'src/auth.ts:10', vector: [0.1, 0.2, 0.3], metadata: { path: 'src/auth.ts', line: 10 } });
const nearest = index.search([0.1, 0.2, 0.29], { maxResults: 5 });
```

The index does not bundle a model; feed it vectors from any local embedding pipeline.

### Local LSP client

```ts
import { LocalLspClient } from '@epsilon-asi/sandbox/repo-search/lsp';

await using lsp = new LocalLspClient({
  command: 'typescript-language-server',
  args: ['--stdio'],
  cwd: '/path/to/repo',
});
await lsp.openDocument('/path/to/repo/src/auth.ts', 'typescript');
const definitions = await lsp.definition('/path/to/repo/src/auth.ts', { line: 10, character: 15 });
```

Requests start the server on demand (and restart it if it exited). `shutdown()` — or leaving an `await using` scope —
sends `shutdown`/`exit` and stops the process. Failures, timeouts, and a server that cannot start reject with
`LspError`. The client spawns the server directly (a long-lived stdio session, not a `CommandExecutor` command) and
does not install language servers.

## Configuration

```ts
import { DEFAULT_SEARCH_EXCLUDED_DIRECTORIES, LocalRepoSearch } from '@epsilon-asi/sandbox/repo-search';

const repo = await LocalRepoSearch.create({
  root: '/path/to/repo', // required; any directory
  useGit: true, // list files with `git ls-files -co --exclude-standard` inside a work tree
  respectGitIgnore: true, // apply .gitignore files when walking the filesystem instead
  includeHidden: false,
  followSymlinks: false,
  maxFileBytes: 1024 * 1024,
  include: ['src/**', 'test/**'],
  exclude: ['**/*.min.js', 'fixtures/**'],
  allowedExtensions: ['.ts', '.tsx', '.md'], // empty: every text file
  defaultExcludedDirectories: [...DEFAULT_SEARCH_EXCLUDED_DIRECTORIES, 'tmp'], // node_modules, dist, build, .git, …
  concurrency: 16,
  chunkLines: 160, // BM25/similarity chunk size and overlap
  chunkOverlap: 32,
  backend: 'auto', // 'auto' | 'ripgrep' | 'node'
  executor: myExecutor, // runs `git` and `rg`; default: new ChildProcessCommandExecutor()
});
```

Probable binary files are skipped. Without Git, the filesystem walker applies `.gitignore` files (including nested ones
and `!` negations) with a practical subset of Git's rules. `repo.stats` (`RepoSearchIndexStats`) reports what was
discovered, indexed, and skipped; `repo.rebuild()` re-indexes from disk with the same options and executor.

### Command executor

Like every component of `@epsilon-asi/sandbox`, repo search runs external commands through the shared
`CommandExecutor` interface, so one implementation can log, fake, or redirect them. The executor must see the same
filesystem as `root`, because files are always read in-process.

- **Git discovery** runs `git rev-parse --is-inside-work-tree` (5 s timeout) and
  `git ls-files -co --exclude-standard -z -- .` (60 s timeout, 256 MiB output limit) with `cwd: root`. If either exits
  non-zero or times out, or git cannot be spawned or overflows (`CommandExecutionError`), discovery walks the
  filesystem instead.
- **ripgrep** runs `rg --json …` with `cwd: root` (30 s timeout, 64 MiB output limit).
- **ripgrep availability** is checked once per instance. Without an `executor` option it is a `PATH` lookup for `rg`
  (`commandExists`, no process spawned). With a custom executor — which may run commands somewhere else — it runs
  `rg --version` through that executor: exit 0 means available; a failure, timeout, or spawn failure means unavailable.
  `ripgrepAvailable(executor?)` exposes the same check.

Errors other than `CommandExecutionError` / `CommandFailedError` thrown by a custom executor propagate unchanged.

## Public API

| Export                                                                                                                                                                                       | Kind                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `LocalRepoSearch`, `createRepoSearch`                                                                                                                                                        | Main entry point                  |
| `SearchDocumentStore`, `TextSearchEngine`, `PathSearchEngine`, `RankedIndex`, `SymbolIndex`, `SourceDependencyIndex`, `CallGraphIndex`, `InMemoryVectorIndex`                                | Building blocks                   |
| `searchTextForPaths`, `extractSymbols`, `extractSourceDependencies`, `extractStackTraceFrames`, `regexFromLiteral`, `reciprocalRankFusion`, `defaultHybridSearchMethods`, `ripgrepAvailable` | Functions                         |
| `DEFAULT_HYBRID_SEARCH_WEIGHTS`, `DEFAULT_SEARCH_EXCLUDED_DIRECTORIES`                                                                                                                       | Constants                         |
| `PathMentionSchema`, `PathMentionKindSchema`, `PathMentionConfidenceSchema`, `PathMentionTextRangeSchema`                                                                                    | zod schemas                       |
| `RepoSearchError`, `RipgrepError`                                                                                                                                                            | Errors                            |
| `SearchResult`, `SearchMethod`, `RepositorySearchOptions`, `RepoFileEntry`, `SearchDocument`, `PathMention`, … (see `src/repo-search/index.ts`)                                              | Types                             |
| `ChildProcessCommandExecutor`, `CommandExecutor`, `CommandExecutionOptions`, `CommandExecutionResult`, `SandboxError`, `CommandExecutionError`, `CommandFailedError`                         | Re-exported from the shared layer |
| `@epsilon-asi/sandbox/repo-search/lsp`: `LocalLspClient`, `LspError`, `LspClientOptions`, `LspLocation`, …                                                                                   | LSP entry point                   |

The building blocks share one `SearchDocumentStore`:

```ts
import { CallGraphIndex, SearchDocumentStore, SymbolIndex } from '@epsilon-asi/sandbox/repo-search';

const store = new SearchDocumentStore(documents); // SearchDocument[]
const symbols = new SymbolIndex(store);
const callGraph = new CallGraphIndex(store, symbols.symbols);
```

`RepoSearchError`, `RipgrepError`, and `LspError` extend `SandboxError`, the root of every error in the package, and
carry a `cause` when wrapping another error.

## CLI

The package installs the `repo-search` bin:

```bash
repo-search search "permission validation"            # hybrid
repo-search text "permission denied" --root /path/to/repo
repo-search regex "validate[A-Za-z]+\\s*\\(" -r /path/to/repo
repo-search symbol validatePermission --json --max 5
repo-search deps ./auth
repo-search stats
repo-search text -- --verbose                         # query that starts with "-"
```

Commands: `search|hybrid`, `text|grep`, `regex`, `path|files`, `bm25`, `similar|similarity`, `symbol|symbols`,
`deps|dependency`, `stats`, `help`. Options: `--root/-r`, `--max/-n` (default 20), `--context/-C` (default 2), `--json`,
`--help/-h`. Exit codes: 0 success, 1 search failure, 2 invalid usage.

Examples live in `examples/repo-search/` (`basic.ts`, `agent-tools.ts`, `local-lsp.ts`). Design notes are in
[`ARCHITECTURE.md`](ARCHITECTURE.md) and agent integration advice in [`AGENT_TOOLING.md`](AGENT_TOOLING.md).

## Limitations

- Symbols come from per-language regular expressions, not a compiler; use the LSP client for exact semantics.
- The call graph matches names, so it over-approximates calls between same-named functions.
- TF-IDF similarity is lexical, not a neural embedding.
- The filesystem walker's `.gitignore` support is a subset of Git's; prefer Git discovery when available.
- In-process regex search runs JavaScript regular expressions; prefer ripgrep for very large repositories or untrusted
  patterns.
