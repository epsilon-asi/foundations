import type { HybridSearchOptions, SearchMethod, SearchResult } from '../types.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { rankResults } from './results.js';

/** Ranked results from one search channel, as input to reciprocal-rank fusion. */
export interface SearchCandidateSet {
  method: SearchMethod;
  results: readonly SearchResult[];
  /** Overrides the channel's weight from `methodWeights` / `DEFAULT_HYBRID_SEARCH_WEIGHTS`. */
  weight?: number;
}

/** Default per-channel fusion weights: exact, symbol, and path channels outrank fuzzy similarity. */
export const DEFAULT_HYBRID_SEARCH_WEIGHTS: Readonly<Partial<Record<SearchMethod, number>>> = {
  text: 1.55,
  regex: 1.35,
  symbol: 1.45,
  path: 1.25,
  dependency: 1.0,
  bm25: 1.0,
  similarity: 0.85,
  callgraph: 1.1,
  stacktrace: 1.4,
};

const DEFAULT_RRF_K = 60;
/** Results within this many lines of each other in one file fuse into one hybrid result. */
const FUSION_LINE_BUCKET = 8;

/**
 * Fuses ranked candidate sets with weighted reciprocal-rank fusion: each result contributes
 * `weight / (rrfK + rank)`; results in the same file and line bucket merge, keeping the best-scoring
 * representative and recording every contributing channel.
 */
export function reciprocalRankFusion(
  candidateSets: readonly SearchCandidateSet[],
  options: HybridSearchOptions = {},
): SearchResult[] {
  const k = options.rrfK ?? DEFAULT_RRF_K;
  const weights = { ...DEFAULT_HYBRID_SEARCH_WEIGHTS, ...options.methodWeights };
  const fused = new Map<string, { best: SearchResult; score: number; channels: Set<SearchMethod> }>();

  for (const set of candidateSets) {
    const weight = set.weight ?? weights[set.method] ?? 1;
    set.results.forEach((result, rank) => {
      const key = fusionKey(result);
      const entry = fused.get(key) ?? { best: result, score: 0, channels: new Set<SearchMethod>() };
      entry.score += weight / (k + rank + 1);
      if (result.score > entry.best.score) entry.best = result;
      entry.channels.add(set.method);
      for (const channel of result.channels ?? []) entry.channels.add(channel);
      fused.set(key, entry);
    });
  }

  const results = [...fused].map(([key, { best, score, channels }]) => ({
    ...best,
    method: 'hybrid' as const,
    score,
    channels: [...channels],
    metadata: { ...best.metadata, originalMethod: best.method, fusionKey: key },
  }));
  return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.hybrid);
}

/** Channels for a query: path and symbol channels lead when the query looks like a path or identifier. */
export function defaultHybridSearchMethods(query: string): SearchMethod[] {
  const leading: SearchMethod[] = [];
  if (looksLikePath(query)) leading.push('path');
  if (looksLikeSymbol(query)) leading.push('symbol');
  return [...new Set<SearchMethod>([...leading, 'text', 'bm25', 'similarity', 'dependency', 'path', 'symbol'])];
}

function fusionKey(result: SearchResult): string {
  const bucketLine = Math.max(1, Math.floor((result.line - 1) / FUSION_LINE_BUCKET) * FUSION_LINE_BUCKET + 1);
  return `${result.path}:${bucketLine}:${result.method === 'path' ? 'path' : ''}`;
}

function looksLikePath(query: string): boolean {
  return /[/.\\]/.test(query) || /\.(ts|tsx|js|jsx|py|go|rs|java|cs|json|ya?ml|md)$/i.test(query.trim());
}

function looksLikeSymbol(query: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(query.trim());
}
