import { RepoSearchError } from '../errors.js';

/**
 * Local in-memory vector index for vectors produced by a local embedding model.
 * This module does not call external services.
 */

export interface VectorRecord<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  vector: number[];
  metadata: TMetadata;
}

export interface VectorSearchResult<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends VectorRecord<TMetadata> {
  score: number;
}

export interface VectorSearchOptions {
  /** Default: 20. */
  maxResults?: number;
  /** Minimum cosine similarity. Default: -1 (no minimum). */
  minScore?: number;
}

const DEFAULT_VECTOR_MAX_RESULTS = 20;

/** Cosine-similarity index; vectors are normalized on insert. */
export class InMemoryVectorIndex<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  private readonly records: VectorRecord<TMetadata>[] = [];
  private dimension: number | undefined;

  add(record: VectorRecord<TMetadata>): void {
    if (record.vector.length === 0) throw new RepoSearchError('Vector must not be empty');
    this.dimension ??= record.vector.length;
    assertDimension(this.dimension, record.vector);
    this.records.push({ ...record, vector: normalize(record.vector) });
  }

  addMany(records: readonly VectorRecord<TMetadata>[]): void {
    for (const record of records) this.add(record);
  }

  search(vector: readonly number[], options: VectorSearchOptions = {}): VectorSearchResult<TMetadata>[] {
    if (this.dimension === undefined) return [];
    assertDimension(this.dimension, vector);
    const query = normalize(vector);
    const minScore = options.minScore ?? -1;
    return this.records
      .map((record) => ({ ...record, score: dot(query, record.vector) }))
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults ?? DEFAULT_VECTOR_MAX_RESULTS);
  }

  size(): number {
    return this.records.length;
  }

  clear(): void {
    this.records.length = 0;
    this.dimension = undefined;
  }
}

function assertDimension(expected: number, vector: readonly number[]): void {
  if (vector.length !== expected) {
    throw new RepoSearchError(`Vector dimension mismatch: expected ${expected}, got ${vector.length}`);
  }
}

function normalize(vector: readonly number[]): number[] {
  const norm = Math.sqrt(dot(vector, vector));
  return norm === 0 ? [...vector] : vector.map((value) => value / norm);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let value = 0;
  for (let i = 0; i < a.length; i += 1) value += (a[i] ?? 0) * (b[i] ?? 0);
  return value;
}
