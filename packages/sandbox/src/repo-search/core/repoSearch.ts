import { CommandExecutionError, CommandFailedError, type CommandExecutor } from '../../shared/index.js';
import { RipgrepError } from '../errors.js';
import type { PathMention } from '../schemas.js';
import { CallGraphIndex } from '../search/callGraph.js';
import type { SearchChunk } from '../search/chunks.js';
import { DEFAULT_MAX_RESULTS } from '../search/defaults.js';
import { SourceDependencyIndex } from '../search/dependencies.js';
import { defaultHybridSearchMethods, reciprocalRankFusion, type SearchCandidateSet } from '../search/hybrid.js';
import { PathSearchEngine } from '../search/pathSearch.js';
import { RankedIndex } from '../search/ranked.js';
import {
  ripgrepAvailable,
  searchRegexWithRipgrep,
  searchTextWithRipgrep,
  shouldUseRipgrep,
  type RipgrepContext,
} from '../search/ripgrep.js';
import { searchStackTrace } from '../search/stackTrace.js';
import { SymbolIndex } from '../search/symbols.js';
import { TextSearchEngine } from '../search/textSearch.js';
import type {
  CallGraphEdge,
  CallGraphOptions,
  CallGraphSearchOptions,
  SourceDependencyEntry,
  DependencySearchOptions,
  RepoFileEntry,
  HybridSearchOptions,
  RepoSearchIndexStats,
  OpenRepoFileOptions,
  OpenRepoFileResult,
  PathMentionSearchOptions,
  PathSearchOptions,
  QuerySearchMethod,
  QuerySearchOptions,
  RankedSearchOptions,
  RegexSearchOptions,
  RepositorySearchOptions,
  ResolvedRepositorySearchOptions,
  SearchBackend,
  SearchMethod,
  SearchResult,
  SimilaritySearchOptions,
  StackTraceSearchOptions,
  StackTraceSearchResult,
  StructuralSearchQuery,
  SymbolEntry,
  SymbolSearchOptions,
  SearchDocument,
  TextSearchOptions,
} from '../types.js';
import { discoverFiles } from './discovery.js';
import { SearchDocumentStore } from './searchDocumentStore.js';
import { loadDocuments, openFile } from './files.js';
import { resolveExecutor, resolveOptions } from './options.js';

/** Runs one query channel against a repository. */
type QueryRunner = (
  repo: LocalRepoSearch,
  query: string,
  options: QuerySearchOptions,
) => Promise<SearchResult[]> | SearchResult[];

/** Dispatch table behind `search()`, hybrid fusion, and the CLI. */
const QUERY_RUNNERS: Readonly<Record<QuerySearchMethod, QueryRunner>> = {
  text: (repo, query, options) => repo.searchText(query, options),
  regex: (repo, query, options) => repo.searchRegex(query, options),
  path: (repo, query, options) => repo.searchPaths(query, options),
  bm25: (repo, query, options) => repo.searchBM25(query, options),
  similarity: (repo, query, options) => repo.searchSimilarity(query, options),
  symbol: (repo, query, options) => repo.searchSymbols(query, options),
  dependency: (repo, query, options) => repo.searchDependencies(query, options),
};

const TEST_PATH_PATTERN =
  /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|_test\.go$|test_.*\.py$|.*_test\.py$/i;
/** Hybrid search asks each channel for at least this many candidates before fusing. */
const MIN_HYBRID_CANDIDATES = 20;

interface RepoSearchParts {
  options: ResolvedRepositorySearchOptions;
  files: readonly RepoFileEntry[];
  store: SearchDocumentStore;
  rankedIndex: RankedIndex;
  symbolIndex: SymbolIndex;
  dependencyIndex: SourceDependencyIndex;
  stats: RepoSearchIndexStats;
}

/** Local repository search: builds every index once, then answers exact, ranked, structural, and hybrid queries. */
export class LocalRepoSearch {
  readonly root: string;
  readonly options: ResolvedRepositorySearchOptions;
  readonly files: readonly RepoFileEntry[];
  readonly documents: readonly SearchDocument[];
  readonly chunks: readonly SearchChunk[];
  readonly stats: Readonly<RepoSearchIndexStats>;

  private readonly store: SearchDocumentStore;
  private readonly textEngine: TextSearchEngine;
  private readonly pathEngine: PathSearchEngine;
  private readonly rankedIndex: RankedIndex;
  private readonly symbolIndex: SymbolIndex;
  private readonly dependencyIndex: SourceDependencyIndex;
  private readonly callGraphIndex: CallGraphIndex;
  private readonly executor: CommandExecutor;
  private ripgrepReady: Promise<boolean> | undefined;

  private constructor(parts: RepoSearchParts) {
    this.options = parts.options;
    this.root = parts.options.root;
    this.files = parts.files;
    this.store = parts.store;
    this.documents = parts.store.documents;
    this.rankedIndex = parts.rankedIndex;
    this.chunks = parts.rankedIndex.chunks;
    this.symbolIndex = parts.symbolIndex;
    this.dependencyIndex = parts.dependencyIndex;
    this.stats = parts.stats;
    this.textEngine = new TextSearchEngine(parts.store);
    this.pathEngine = new PathSearchEngine(parts.files);
    this.callGraphIndex = new CallGraphIndex(parts.store, parts.symbolIndex.symbols);
    this.executor = resolveExecutor(parts.options);
  }

  /** Discovers files under `options.root` and builds all local indexes. */
  static async create(options: RepositorySearchOptions): Promise<LocalRepoSearch> {
    const started = Date.now();
    const resolved = resolveOptions(options);
    const discovery = await discoverFiles(resolved);
    const store = new SearchDocumentStore(await loadDocuments(discovery.files, resolved.concurrency));
    const rankedIndex = new RankedIndex(store, {
      chunkLines: resolved.chunkLines,
      chunkOverlap: resolved.chunkOverlap,
    });
    const symbolIndex = new SymbolIndex(store);
    const dependencyIndex = new SourceDependencyIndex(store);
    const stats: RepoSearchIndexStats = {
      root: resolved.root,
      filesDiscovered: discovery.files.length,
      filesIndexed: store.size,
      chunksIndexed: rankedIndex.chunks.length,
      symbolsIndexed: symbolIndex.symbols.length,
      dependenciesIndexed: dependencyIndex.dependencies.length,
      skippedFiles: discovery.skipped + (discovery.files.length - store.size),
      buildMs: Date.now() - started,
    };
    return new LocalRepoSearch({
      options: resolved,
      files: discovery.files,
      store,
      rankedIndex,
      symbolIndex,
      dependencyIndex,
      stats,
    });
  }

  /** Rebuilds every index from disk with the same options. */
  rebuild(): Promise<LocalRepoSearch> {
    return LocalRepoSearch.create(this.options);
  }

  listFiles(): RepoFileEntry[] {
    return [...this.files];
  }

  listSymbols(): SymbolEntry[] {
    return [...this.symbolIndex.symbols];
  }

  listDependencies(): SourceDependencyEntry[] {
    return [...this.dependencyIndex.dependencies];
  }

  /** Opens a line range of a file inside the root (repository-relative or absolute path). */
  openFile(path: string, options: OpenRepoFileOptions = {}): Promise<OpenRepoFileResult> {
    return openFile(this.root, this.store, path, options);
  }

  /** Runs one query method by name; `hybrid` fuses several. */
  async search(
    method: QuerySearchMethod | 'hybrid',
    query: string,
    options: HybridSearchOptions = {},
  ): Promise<SearchResult[]> {
    return method === 'hybrid' ? this.hybridSearch(query, options) : QUERY_RUNNERS[method](this, query, options);
  }

  /** Literal search, via ripgrep when the backend allows it and it is installed. */
  searchText(query: string, options: TextSearchOptions = {}): Promise<SearchResult[]> {
    return this.withBackend(
      options.backend,
      'text',
      (context) => searchTextWithRipgrep(this.root, query, options, context),
      () => this.textEngine.searchText(query, options),
    );
  }

  /** Regular-expression search; string patterns may use ripgrep, `RegExp` objects always run in-process. */
  searchRegex(pattern: string | RegExp, options: RegexSearchOptions = {}): Promise<SearchResult[]> {
    const viaRipgrep =
      typeof pattern === 'string'
        ? (context: RipgrepContext) => searchRegexWithRipgrep(this.root, pattern, options, context)
        : undefined;
    return this.withBackend(options.backend, 'regex', viaRipgrep, () => this.textEngine.searchRegex(pattern, options));
  }

  searchPaths(query: string, options: PathSearchOptions = {}): SearchResult[] {
    return this.pathEngine.search(query, options);
  }

  /** Finds repository files explicitly mentioned in arbitrary text, prompts, logs, or review comments. */
  searchTextForPaths(text: string | readonly string[], options: PathMentionSearchOptions = {}): PathMention[] {
    return this.pathEngine.searchTextForPaths(text, options);
  }

  /** Alias of `searchTextForPaths` for callers that prefer extraction terminology. */
  findPathMentions(text: string | readonly string[], options: PathMentionSearchOptions = {}): PathMention[] {
    return this.searchTextForPaths(text, options);
  }

  searchBM25(query: string, options: RankedSearchOptions = {}): SearchResult[] {
    return this.rankedIndex.searchBM25(query, options);
  }

  searchSimilarity(query: string, options: SimilaritySearchOptions = {}): SearchResult[] {
    return this.rankedIndex.searchSimilarity(query, options);
  }

  searchSymbols(query: string, options: SymbolSearchOptions = {}): SearchResult[] {
    return this.symbolIndex.search(query, options);
  }

  findDefinition(name: string, options: SymbolSearchOptions = {}): SearchResult[] {
    return this.symbolIndex.findDefinition(name, options);
  }

  /** Whole-word text references (unless `wholeWord: false`). */
  findReferences(name: string, options: TextSearchOptions = {}): Promise<SearchResult[]> {
    return this.searchText(name, { ...options, wholeWord: options.wholeWord ?? true });
  }

  structuralSearch(query: StructuralSearchQuery, maxResults?: number): SearchResult[] {
    return this.symbolIndex.structuralSearch(query, maxResults);
  }

  searchDependencies(query: string, options: DependencySearchOptions = {}): SearchResult[] {
    return this.dependencyIndex.search(query, options);
  }

  findImporters(specifier: string, options: DependencySearchOptions = {}): SearchResult[] {
    return this.dependencyIndex.findImporters(specifier, options);
  }

  dependenciesForFile(path: string): SourceDependencyEntry[] {
    return this.dependencyIndex.listForFile(path);
  }

  buildCallGraph(options: CallGraphOptions = {}): readonly CallGraphEdge[] {
    return this.callGraphIndex.build(options);
  }

  findCallers(name: string, options: CallGraphSearchOptions = {}): SearchResult[] {
    return this.callGraphIndex.findCallers(name, options);
  }

  findCallees(name: string, options: CallGraphSearchOptions = {}): SearchResult[] {
    return this.callGraphIndex.findCallees(name, options);
  }

  /** BM25 restricted to test files (`*.test.ts`, `*_test.go`, `test_*.py`, `__tests__/`, `tests/`, …). */
  searchTests(query: string, options: RankedSearchOptions = {}): SearchResult[] {
    const testPaths = this.files.map((file) => file.path).filter((repoPath) => TEST_PATH_PATTERN.test(repoPath));
    return this.searchBM25(query, {
      ...options,
      paths: testPaths,
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS.tests,
    });
  }

  /** Resolves stack-trace frames to local files and opens the source around each. */
  searchStackTrace(trace: string, options: StackTraceSearchOptions = {}): Promise<StackTraceSearchResult> {
    return searchStackTrace(this.root, this.store, trace, options);
  }

  /**
   * Runs several channels concurrently and fuses them with reciprocal-rank fusion. A channel that fails (for
   * example an invalid regex) is skipped; methods without a query runner (`callgraph`, `stacktrace`) are ignored.
   */
  async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    const methods = options.methods ?? defaultHybridSearchMethods(query);
    const channelOptions = { ...options, maxResults: Math.max(options.maxResults ?? 0, MIN_HYBRID_CANDIDATES) };
    const settled = await Promise.allSettled(
      methods.filter(isQuerySearchMethod).map(async (method): Promise<SearchCandidateSet> => ({
        method,
        results: await QUERY_RUNNERS[method](this, query, channelOptions),
      })),
    );
    const candidateSets = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
    return reciprocalRankFusion(candidateSets, options);
  }

  /**
   * Tries ripgrep when the backend allows it and `rg` is available (restricted to indexed files), falling back to
   * the in-process engine. A ripgrep failure (`CommandFailedError` or `CommandExecutionError`) is only an error when
   * the backend is forced to `ripgrep`; it is then wrapped in a `RipgrepError`.
   */
  private async withBackend(
    requested: SearchBackend | undefined,
    label: 'text' | 'regex',
    viaRipgrep: ((context: RipgrepContext) => Promise<SearchResult[]>) | undefined,
    viaNode: () => SearchResult[],
  ): Promise<SearchResult[]> {
    if (viaRipgrep && shouldUseRipgrep(this.options.backend, requested) && (await this.isRipgrepAvailable())) {
      try {
        return await viaRipgrep({ executor: this.executor, acceptPath: (repoPath) => this.store.has(repoPath) });
      } catch (error) {
        if (!(error instanceof CommandFailedError || error instanceof CommandExecutionError)) throw error;
        if ((requested ?? this.options.backend) === 'ripgrep') {
          throw new RipgrepError(`ripgrep ${label} search failed and backend was forced to ripgrep`, { cause: error });
        }
      }
    }
    return viaNode();
  }

  /** Checked once per instance: a `PATH` lookup, or a probe through the caller's executor when one was given. */
  private isRipgrepAvailable(): Promise<boolean> {
    this.ripgrepReady ??= ripgrepAvailable(this.options.executor);
    return this.ripgrepReady;
  }
}

/** Alias of `LocalRepoSearch.create`. */
export function createRepoSearch(options: RepositorySearchOptions): Promise<LocalRepoSearch> {
  return LocalRepoSearch.create(options);
}

function isQuerySearchMethod(method: SearchMethod): method is QuerySearchMethod {
  return Object.hasOwn(QUERY_RUNNERS, method);
}
