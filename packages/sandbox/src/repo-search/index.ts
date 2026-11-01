// Public API of `@epsilon-asi/sandbox/repo-search`; every name is unique across the package root.
export { LocalRepoSearch, createRepoSearch } from './core/repoSearch.js';
export { SearchDocumentStore } from './core/searchDocumentStore.js';
export { DEFAULT_SEARCH_EXCLUDED_DIRECTORIES } from './core/options.js';
export { RepoSearchError, RipgrepError } from './errors.js';
export { TextSearchEngine, regexFromLiteral } from './search/textSearch.js';
export { PathSearchEngine } from './search/pathSearch.js';
export { searchTextForPaths } from './search/pathMentions.js';
export { RankedIndex } from './search/ranked.js';
export { SymbolIndex, extractSymbols } from './search/symbols.js';
export { SourceDependencyIndex, extractSourceDependencies } from './search/dependencies.js';
export { CallGraphIndex } from './search/callGraph.js';
export { reciprocalRankFusion, defaultHybridSearchMethods, DEFAULT_HYBRID_SEARCH_WEIGHTS } from './search/hybrid.js';
export { ripgrepAvailable } from './search/ripgrep.js';
export { extractStackTraceFrames } from './search/stackTrace.js';
export { InMemoryVectorIndex } from './search/vector.js';
export {
  PathMentionSchema,
  PathMentionKindSchema,
  PathMentionConfidenceSchema,
  PathMentionTextRangeSchema,
} from './schemas.js';

export type { PathMention, PathMentionKind, PathMentionConfidence, PathMentionTextRange } from './schemas.js';
export type { SearchChunk, SearchChunkOptions } from './search/chunks.js';
export type { SearchCandidateSet } from './search/hybrid.js';
export type { VectorRecord, VectorSearchResult, VectorSearchOptions } from './search/vector.js';
export type {
  BaseSearchOptions,
  CallGraphEdge,
  CallGraphOptions,
  CallGraphSearchOptions,
  DependencySearchOptions,
  HybridSearchOptions,
  OpenRepoFileOptions,
  OpenRepoFileResult,
  PathMentionSearchOptions,
  PathSearchOptions,
  QuerySearchMethod,
  QuerySearchOptions,
  RankedSearchOptions,
  RegexSearchOptions,
  RepoFileEntry,
  RepoSearchIndexStats,
  RepoStackTraceFrame,
  RepositorySearchOptions,
  ResolvedRepositorySearchOptions,
  SearchBackend,
  SearchDocument,
  SearchMatch,
  SearchMethod,
  SearchPathScope,
  SearchRange,
  SearchResult,
  SimilaritySearchOptions,
  SourceDependencyEntry,
  SourceDependencyKind,
  StackTraceSearchOptions,
  StackTraceSearchResult,
  StructuralSearchQuery,
  SymbolEntry,
  SymbolKind,
  SymbolSearchOptions,
  TextSearchOptions,
} from './types.js';

// Shared layer used by this API: the executor that runs `git` and `rg`, and the errors it raises.
export {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  CommandFailedError,
  SandboxError,
} from '../shared/index.js';
export type { CommandExecutionOptions, CommandExecutionResult, CommandExecutor } from '../shared/index.js';
