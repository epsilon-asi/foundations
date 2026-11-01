# Architecture

Repo search builds several independent local indexes over one shared document store and exposes them through
`LocalRepoSearch`. It uses the package's shared layer (`src/shared/`) for command execution, errors, and small object
helpers.

## Layout

```text
src/repo-search/
  index.ts                public API (explicit named exports, plus the shared symbols it needs)
  types.ts, schemas.ts    public types; zod schemas for path mentions
  errors.ts               RepoSearchError (extends SandboxError), RipgrepError, LspError
  cli.ts                  `repo-search` bin entry (calls cli/runCli.ts)
  cli/runCli.ts           argument parsing, command table, output formatting
  core/
    options.ts            defaults, option resolution, executor default
    discovery.ts          git / filesystem file discovery with one acceptance pipeline
    files.ts              text loading, binary detection, openFile
    searchDocumentStore.ts indexed documents, lookup by path, cached line indexes
    repoSearch.ts         LocalRepoSearch facade and query dispatch table
  search/
    defaults.ts           default limits and scores
    results.ts            result construction and ranking shared by every engine
    textSearch.ts         in-process literal/regex search
    ripgrep.ts            ripgrep backend (availability check, JSON event parsing)
    pathSearch.ts         fuzzy path search
    pathMentions.ts       path mentions in free text
    chunks.ts, tokenizer.ts, ranked.ts   BM25 and TF-IDF over line chunks
    symbols.ts, dependencies.ts, callGraph.ts
    stackTrace.ts, hybrid.ts, vector.ts
  lsp/
    index.ts              `./repo-search/lsp` entry point
    client.ts, types.ts   minimal JSON-RPC language-server client
  utils/                  paths, globs, path filters, text/line indexes, collections, async
```

## Build pipeline

```text
resolveOptions → discoverFiles → loadDocuments → SearchDocumentStore
                                                   ├─ TextSearchEngine
                                                   ├─ RankedIndex (chunks → BM25 / TF-IDF)
                                                   ├─ SymbolIndex → CallGraphIndex
                                                   └─ SourceDependencyIndex
                 files ──────────────────────────────── PathSearchEngine (fuzzy paths, path mentions)
```

`LocalRepoSearch.create` builds every index, then computes `RepoSearchIndexStats` once. Instances are immutable;
`rebuild()` returns a new instance with the same options (including the executor).

## Shared building blocks

- **`SearchDocumentStore`** holds the documents and a path → document map, so engines look documents up in O(1), and
  caches a `LineIndex` per document for offset → line/column conversion.
- **`LineIndex`** precomputes line-start offsets (`\n`, `\r\n`, and `\r`, matching `splitLines`) and converts offsets
  with a binary search. Text search, regex search, path mentions, ripgrep submatches, and the call graph use it.
- **`createPathFilter`** implements the `paths` / `include` / `exclude` options for every engine and for discovery.
- **`createResult` / `createAnchoredResult`** are the only places `SearchResult` objects are built;
  `compareResults` / `rankResults` give every method the same ordering (score, then path, then line).
- **`LocalRepoSearch.search`** dispatches by method name through one table that hybrid search and the CLI reuse.

## Commands

`git` and `rg` run through the shared `CommandExecutor` (`executor` option; default `ChildProcessCommandExecutor`: no
shell, argument arrays, timeouts reported as `timedOut: true`, spawn failures and output overflow rejected with
`CommandExecutionError`). Repo search treats a non-zero exit or a timeout as a failure:

| Command                          | On failure                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| git work-tree probe / `ls-files` | Walk the filesystem instead (also on `CommandExecutionError`).                                                                                                                              |
| `rg --version` (custom executor) | ripgrep unavailable (also on `CommandExecutionError`).                                                                                                                                      |
| `rg --json …`                    | `CommandFailedError` unless the exit code is 0 or 1; `LocalRepoSearch` falls back to the in-process engine, or wraps the failure in `RipgrepError` when the backend is forced to `ripgrep`. |

Any other error from a custom executor propagates unchanged. Without a custom executor, ripgrep availability is a
`PATH` lookup (`commandExists('rg')`) rather than a spawned probe. The LSP client is the one exception to executor use:
it keeps a long-lived stdio session with the server, so it spawns the server itself.

## File discovery

With `useGit` (the default) inside a Git work tree, discovery lists files by running, in the root:

```bash
git ls-files -co --exclude-standard -z -- .
```

Otherwise it walks the filesystem with async `fs`, applying `.gitignore` files: each file's rules apply to its own
subtree, patterns without a slash match at any depth below it, and `!` negations re-include paths. Both sources pass
through the same acceptance pipeline: hidden paths, default-excluded directory names, `exclude` and `include` globs,
allowed extensions, then a regular file within `maxFileBytes`. Every rejected candidate is counted in
`RepoSearchIndexStats.skippedFiles`.

## Text documents

Files that look binary (a NUL byte, or more than 25% control characters in the first 8 KiB) are skipped. Text is
decoded as UTF-8 with any byte-order mark removed.

## Literal and regex search

The in-process engine scans documents directly; line-mode regex works per line, `multiline` regex over the whole text.
The ripgrep backend runs `rg --json` with `-B`/`-A` context, validates each `match`/`context` event with zod, and
rebuilds results with context before and after, UTF-16 columns, and multi-line ranges. `LocalRepoSearch` restricts
ripgrep results to indexed files, checks ripgrep availability once per instance, and falls back to the in-process
engine unless the backend is forced to `ripgrep`.

## Ranking

BM25 and TF-IDF similarity work on overlapping line chunks (default 160 lines, 32 overlap), so results point at a small
source range.

- **BM25** uses `k1 = 1.5`, `b = 0.75`, plus a small boost for query terms in the path.
- **Similarity** is TF-IDF cosine similarity with log-scaled term frequency; cheap, deterministic, and dependency-free,
  but lexical rather than neural.
- **Hybrid** runs channels concurrently and fuses them with weighted reciprocal-rank fusion
  (`DEFAULT_HYBRID_SEARCH_WEIGHTS`). Results in the same file and 8-line bucket merge; exact, symbol, and path channels
  weigh more than similarity.

## Path mentions

`searchTextForPaths` extracts path-like and filename-like candidates from text (relative and absolute paths, `file://`
URLs, Windows separators, quoted paths, Markdown link targets, well-known config filenames, `:line:col` and `#Lline`
suffixes) and verifies each against the indexed file list: exact, case-insensitive, suffix, then basename matches.
Ambiguous basenames return every candidate with `ambiguous-basename` confidence.

## Symbols, source dependencies, call graph

Symbols come from per-language declaration patterns (JavaScript/TypeScript, Python, Go, Rust, Java/Kotlin/C#, C/C++,
PHP, Ruby, plus a generic fallback) with brace- or indentation-based block ends and container names. Source
dependencies (imports, requires, `use`, `#include`; not package-manager dependencies) come from per-language import
patterns; relative specifiers resolve to indexed files.

The call graph scans each callable symbol's body once for `name(` call sites and links them to known callables with
that name. Same-file edges have high confidence; cross-file edges medium or low depending on name length. Edges are
cached per option set.

## Optional LSP client

`LocalLspClient` spawns a local language server and speaks Content-Length framed JSON-RPC over stdio: `initialize`,
`textDocument/didOpen`, `definition`, `references`, `documentSymbol`, `shutdown`/`exit`. It answers server-to-client
requests with "method not found", tolerates malformed frames, rejects pending requests with `LspError` when the process
errors or exits, and implements `AsyncDisposable`. It does not install or manage language servers.

## Performance notes

For large repositories keep Git discovery enabled, keep generated directories excluded, tune `maxFileBytes`, install
ripgrep, narrow `include` patterns in monorepos, and bound call-graph construction with `maxSymbols`.

## Correctness model

This is retrieval infrastructure, not a proof system. The intended loop is:

```text
search broadly → fuse/rerank → open source ranges → verify → answer or edit
```
