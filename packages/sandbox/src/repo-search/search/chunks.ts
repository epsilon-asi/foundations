import type { SearchDocument } from '../types.js';
import { termFrequency, tokenize, tokenizePath } from './tokenizer.js';

/** An overlapping line window of one document, tokenized for BM25 and TF-IDF ranking. */
export interface SearchChunk {
  /** Position of the chunk in the index (0-based, dense). */
  id: number;
  documentId: number;
  path: string;
  absolutePath: string;
  language: string;
  startLine: number;
  endLine: number;
  text: string;
  pathTokens: string[];
  termFrequency: Map<string, number>;
  /** Token count (at least 1), used for BM25 length normalization. */
  length: number;
}

export interface SearchChunkOptions {
  chunkLines: number;
  chunkOverlap: number;
}

export function buildChunks(documents: readonly SearchDocument[], options: SearchChunkOptions): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const size = Math.max(1, options.chunkLines);
  const overlap = Math.min(Math.max(0, options.chunkOverlap), size - 1);
  const step = size - overlap;

  for (const doc of documents) {
    const pathTokens = tokenizePath(doc.path);
    const lineCount = Math.max(1, doc.lines.length);
    for (let start = 0; start < lineCount; start += step) {
      const end = Math.min(lineCount, start + size);
      const text = doc.lines.slice(start, end).join('\n');
      const tokens = tokenize(`${doc.path}\n${text}`);
      chunks.push({
        id: chunks.length,
        documentId: doc.id,
        path: doc.path,
        absolutePath: doc.absolutePath,
        language: doc.language,
        startLine: start + 1,
        endLine: end,
        text,
        pathTokens,
        termFrequency: termFrequency(tokens),
        length: Math.max(1, tokens.length),
      });
      if (end >= lineCount) break;
    }
  }
  return chunks;
}
