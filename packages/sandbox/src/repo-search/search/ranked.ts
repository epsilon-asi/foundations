import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import type { BaseSearchOptions, RankedSearchOptions, SearchResult, SimilaritySearchOptions } from '../types.js';
import { createPathFilter } from '../utils/pathFilter.js';
import { buildChunks, type SearchChunkOptions, type SearchChunk } from './chunks.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { createResult, rankResults, snippetExcerpt } from './results.js';
import { termFrequency, tokenize } from './tokenizer.js';

const BM25_DEFAULTS = { k1: 1.5, b: 0.75, pathBoost: 0.15 } as const;
const SIMILARITY_DEFAULT_PATH_BOOST = 0.1;

/** BM25 and TF-IDF cosine ranking over overlapping line chunks of the indexed documents. */
export class RankedIndex {
  readonly chunks: readonly SearchChunk[];
  private readonly store: SearchDocumentStore;
  private readonly idf = new Map<string, number>();
  private readonly averageLength: number;
  /** TF-IDF vector norm per chunk, indexed by chunk id. */
  private readonly norms: number[];

  constructor(store: SearchDocumentStore, chunkOptions: SearchChunkOptions) {
    this.store = store;
    this.chunks = buildChunks(store.documents, chunkOptions);

    const documentFrequency = new Map<string, number>();
    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
      for (const term of chunk.termFrequency.keys())
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    const chunkCount = Math.max(1, this.chunks.length);
    for (const [term, frequency] of documentFrequency) {
      this.idf.set(term, Math.log(1 + (chunkCount - frequency + 0.5) / (frequency + 0.5)));
    }
    this.averageLength = totalLength / chunkCount || 1;
    this.norms = this.chunks.map((chunk) => {
      let sum = 0;
      for (const [term, tf] of chunk.termFrequency) sum += tfidfWeight(tf, this.idf.get(term) ?? 0) ** 2;
      return Math.sqrt(sum);
    });
  }

  searchBM25(query: string, options: RankedSearchOptions = {}): SearchResult[] {
    const queryTerms = [...new Set(tokenize(query, { keepStopwords: true }))];
    if (queryTerms.length === 0) return [];
    const k1 = options.k1 ?? BM25_DEFAULTS.k1;
    const b = options.b ?? BM25_DEFAULTS.b;
    const pathBoost = options.pathBoost ?? BM25_DEFAULTS.pathBoost;

    const results: SearchResult[] = [];
    for (const chunk of this.scopedChunks(options)) {
      let score = 0;
      for (const term of queryTerms) {
        const tf = chunk.termFrequency.get(term) ?? 0;
        if (tf === 0) continue;
        const lengthNorm = 1 - b + (b * chunk.length) / this.averageLength;
        score += (this.idf.get(term) ?? 0) * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));
      }
      if (score <= 0) continue;
      score += pathBoost * pathTokenCoverage(chunk.pathTokens, queryTerms);
      results.push(this.toResult('bm25', chunk, score, query, options));
    }
    return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.bm25);
  }

  searchSimilarity(query: string, options: SimilaritySearchOptions = {}): SearchResult[] {
    const queryTf = termFrequency(tokenize(query, { keepStopwords: true }));
    if (queryTf.size === 0) return [];
    // Unseen query terms get the IDF of a term that appears in no chunk.
    const unseenIdf = Math.log(1 + Math.max(1, this.chunks.length));
    const queryVector = new Map(
      [...queryTf].map(([term, tf]) => [term, tfidfWeight(tf, this.idf.get(term) ?? unseenIdf)] as const),
    );
    const queryNorm = Math.sqrt([...queryVector.values()].reduce((sum, weight) => sum + weight * weight, 0));
    if (queryNorm === 0) return [];

    const pathBoost = options.pathBoost ?? SIMILARITY_DEFAULT_PATH_BOOST;
    const queryTerms = [...queryTf.keys()];
    const results: SearchResult[] = [];
    for (const chunk of this.scopedChunks(options)) {
      const norm = this.norms[chunk.id] ?? 0;
      if (norm === 0) continue;
      let dot = 0;
      for (const [term, queryWeight] of queryVector) {
        const tf = chunk.termFrequency.get(term) ?? 0;
        if (tf > 0) dot += queryWeight * tfidfWeight(tf, this.idf.get(term) ?? 0);
      }
      const cosine = dot / (queryNorm * norm);
      if (cosine <= 0) continue;
      const score = cosine + pathBoost * pathTokenCoverage(chunk.pathTokens, queryTerms);
      results.push(this.toResult('similarity', chunk, score, query, options));
    }
    return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.similarity);
  }

  private scopedChunks(options: BaseSearchOptions): SearchChunk[] {
    const accepts = createPathFilter(options);
    return this.chunks.filter((chunk) => accepts(chunk.path));
  }

  private toResult(
    method: 'bm25' | 'similarity',
    chunk: SearchChunk,
    score: number,
    query: string,
    options: BaseSearchOptions,
  ): SearchResult {
    const range = { line: chunk.startLine, endLine: chunk.endLine };
    return createResult({
      method,
      source: chunk,
      score,
      ...range,
      excerpt: snippetExcerpt(
        this.store.get(chunk.path)?.lines,
        range,
        chunk.text,
        options.contextBefore ?? 0,
        options.contextAfter ?? 0,
      ),
      metadata: {
        query,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        chunkStartLine: chunk.startLine,
        chunkEndLine: chunk.endLine,
      },
    });
  }
}

/** Log-scaled term frequency times inverse document frequency. */
function tfidfWeight(tf: number, idf: number): number {
  return (1 + Math.log(tf)) * idf;
}

/** Fraction of query terms that appear in the path. */
function pathTokenCoverage(pathTokens: readonly string[], queryTerms: readonly string[]): number {
  if (queryTerms.length === 0) return 0;
  const pathSet = new Set(pathTokens);
  return queryTerms.filter((term) => pathSet.has(term)).length / queryTerms.length;
}
