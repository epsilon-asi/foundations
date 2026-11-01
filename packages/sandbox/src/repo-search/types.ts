/** Public type definitions for repo search (`@epsilon-asi/sandbox/repo-search`). */

import type { CommandExecutor } from '../shared/index.js';

export type SearchBackend = 'node' | 'ripgrep' | 'auto';

export type SearchMethod =
  'text' | 'regex' | 'path' | 'bm25' | 'similarity' | 'symbol' | 'dependency' | 'callgraph' | 'stacktrace' | 'hybrid';

/** Single-channel methods that take a free-text query; these are the channels hybrid search can fuse. */
export type QuerySearchMethod = 'text' | 'regex' | 'path' | 'bm25' | 'similarity' | 'symbol' | 'dependency';

export type SymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'module'
  | 'namespace'
  | 'struct'
  | 'trait'
  | 'impl'
  | 'property'
  | 'unknown';

export type SourceDependencyKind = 'import' | 'require' | 'export' | 'use' | 'module' | 'include' | 'unknown';

export interface RepositorySearchOptions {
  /** Local directory to search. It may be the repository root or any subdirectory. */
  root: string;
  /** Prefer `git ls-files -co --exclude-standard` when the root is inside a Git work tree. Default: true. */
  useGit?: boolean;
  /** Honor .gitignore-like rules in the fallback scanner. Default: true. */
  respectGitIgnore?: boolean;
  /** Include dotfiles and dot-directories. Default: false. */
  includeHidden?: boolean;
  /** Follow symlinks while walking the filesystem. Default: false. */
  followSymlinks?: boolean;
  /** Maximum file size read into indexes. Default: 1 MiB. */
  maxFileBytes?: number;
  /** Glob-like include patterns, relative to root. Empty means include all searchable text files. */
  include?: readonly string[];
  /** Glob-like exclude patterns, relative to root. */
  exclude?: readonly string[];
  /** Directory names excluded anywhere in the tree. Default: `DEFAULT_SEARCH_EXCLUDED_DIRECTORIES`. */
  defaultExcludedDirectories?: readonly string[];
  /** Extensions to include, for example [".ts", ".tsx"]. Empty means all text-like files. */
  allowedExtensions?: readonly string[];
  /** Number of files stat'ed or read concurrently while building indexes. Default: 16. */
  concurrency?: number;
  /** Chunk size, in lines, for BM25/similarity documents. Default: 160. */
  chunkLines?: number;
  /** Overlap, in lines, between adjacent chunks. Default: 32. */
  chunkOverlap?: number;
  /** Text/regex backend. `auto` and `ripgrep` use ripgrep when it is installed. Default: auto. */
  backend?: SearchBackend;
  /**
   * Runs `git` (file discovery) and `rg` (text/regex backend). It must see the same filesystem as `root`, because
   * files are always read in-process. Default: a `ChildProcessCommandExecutor`. Ripgrep availability is a `PATH`
   * lookup for `rg` by default; with a custom executor it is probed by running `rg --version` through the executor.
   */
  executor?: CommandExecutor;
}

/** Repository options with every default filled in; `executor` stays unset unless the caller supplied one. */
export type ResolvedRepositorySearchOptions = Required<Omit<RepositorySearchOptions, 'executor'>> &
  Pick<RepositorySearchOptions, 'executor'>;

export interface RepoFileEntry {
  /** Path relative to the search root, always using forward slashes. */
  path: string;
  /** Absolute filesystem path. */
  absolutePath: string;
  size: number;
  mtimeMs: number;
  extension: string;
  language: string;
}

export interface SearchDocument {
  id: number;
  path: string;
  absolutePath: string;
  language: string;
  text: string;
  lines: string[];
  size: number;
  mtimeMs: number;
}

export interface SearchRange {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** 1-based end line number, inclusive. */
  endLine: number;
  /** 1-based end column number, exclusive. */
  endColumn: number;
}

export interface SearchMatch extends SearchRange {
  text: string;
}

export interface SearchResult {
  method: SearchMethod;
  path: string;
  absolutePath: string;
  score: number;
  /** 1-based line where the primary result starts. */
  line: number;
  /** 1-based line where the primary result ends. */
  endLine: number;
  /** 1-based column, if applicable. */
  column?: number;
  /** 1-based end column, if applicable. */
  endColumn?: number;
  language: string;
  preview: string;
  contextBefore: string[];
  contextAfter: string[];
  matches: SearchMatch[];
  /** Search methods that contributed to a fused hybrid result. */
  channels?: SearchMethod[];
  metadata?: Record<string, unknown>;
}

/** Result scoping shared by every search method. */
export interface SearchPathScope {
  /** Only search these repository-relative paths. */
  paths?: readonly string[];
  /** Glob-like patterns a path must match. */
  include?: readonly string[];
  /** Glob-like patterns that exclude a path. */
  exclude?: readonly string[];
}

export interface BaseSearchOptions extends SearchPathScope {
  maxResults?: number;
  /** Lines of context before line-anchored results. */
  contextBefore?: number;
  /** Lines of context after line-anchored results. */
  contextAfter?: number;
}

/** Options every query method understands; hybrid search forwards these to each channel. */
export interface QuerySearchOptions extends BaseSearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface TextSearchOptions extends QuerySearchOptions {
  backend?: SearchBackend;
}

export interface RegexSearchOptions extends BaseSearchOptions {
  flags?: string;
  multiline?: boolean;
  backend?: SearchBackend;
}

export interface PathSearchOptions extends BaseSearchOptions {
  caseSensitive?: boolean;
}

export interface PathMentionSearchOptions extends SearchPathScope {
  maxResults?: number;
  caseSensitive?: boolean;
  /** Match bare filenames such as README.md or auth.ts in addition to slash-delimited paths. Default: true. */
  includeBasenames?: boolean;
  /** Return all matches for ambiguous bare filenames. Default: true. */
  includeAmbiguousBasenames?: boolean;
}

export interface RankedSearchOptions extends BaseSearchOptions {
  /** BM25 k1 saturation parameter. Default: 1.5. */
  k1?: number;
  /** BM25 length normalization parameter. Default: 0.75. */
  b?: number;
  /** Boost documents whose path contains query tokens. Default: 0.15. */
  pathBoost?: number;
}

export interface SimilaritySearchOptions extends BaseSearchOptions {
  /** Boost documents whose path contains query tokens. Default: 0.1. */
  pathBoost?: number;
}

export interface SymbolEntry {
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  absolutePath: string;
  language: string;
  line: number;
  column: number;
  endLine: number;
  signature: string;
  exported: boolean;
  containerName?: string;
}

export interface SymbolSearchOptions extends BaseSearchOptions {
  kind?: SymbolKind | readonly SymbolKind[];
  caseSensitive?: boolean;
  exact?: boolean;
  exported?: boolean;
}

export interface StructuralSearchQuery {
  name?: string | RegExp;
  kind?: SymbolKind | readonly SymbolKind[];
  language?: string | readonly string[];
  exported?: boolean;
  signatureIncludes?: string;
  pathIncludes?: string;
  nearText?: string;
}

export interface SourceDependencyEntry {
  kind: SourceDependencyKind;
  specifier: string;
  path: string;
  absolutePath: string;
  language: string;
  line: number;
  column: number;
  statement: string;
  resolvedPath?: string;
}

export interface DependencySearchOptions extends BaseSearchOptions {
  kind?: SourceDependencyKind | readonly SourceDependencyKind[];
  exact?: boolean;
  caseSensitive?: boolean;
}

export interface CallGraphEdge {
  caller: SymbolEntry;
  callee: SymbolEntry;
  /** File of the call site (the caller's file). */
  path: string;
  line: number;
  column: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CallGraphOptions {
  /** Maximum symbols to consider while building the approximate call graph. Default: 5000. */
  maxSymbols?: number;
  /** Only connect callers and callees declared in the same file. Default: false. */
  sameFileOnly?: boolean;
}

export interface CallGraphSearchOptions extends CallGraphOptions {
  maxResults?: number;
}

export interface HybridSearchOptions extends QuerySearchOptions {
  /** Channels to fuse. Default: chosen from the query shape by `defaultHybridSearchMethods`. */
  methods?: readonly SearchMethod[];
  /** Reciprocal-rank-fusion constant. Default: 60. */
  rrfK?: number;
  methodWeights?: Partial<Record<SearchMethod, number>>;
}

export interface OpenRepoFileOptions {
  line?: number;
  endLine?: number;
  contextBefore?: number;
  contextAfter?: number;
}

export interface OpenRepoFileResult {
  path: string;
  absolutePath: string;
  line: number;
  endLine: number;
  totalLines: number;
  text: string;
  numberedText: string;
}

export interface RepoStackTraceFrame {
  raw: string;
  path: string;
  absolutePath: string;
  line: number;
  column?: number;
  exists: boolean;
}

export interface StackTraceSearchOptions {
  /** Default: 3. */
  contextBefore?: number;
  /** Default: 3. */
  contextAfter?: number;
  /** Default: 25. */
  maxFrames?: number;
}

export interface StackTraceSearchResult {
  frames: RepoStackTraceFrame[];
  opened: OpenRepoFileResult[];
}

export interface RepoSearchIndexStats {
  root: string;
  filesDiscovered: number;
  filesIndexed: number;
  chunksIndexed: number;
  symbolsIndexed: number;
  dependenciesIndexed: number;
  skippedFiles: number;
  buildMs: number;
}
