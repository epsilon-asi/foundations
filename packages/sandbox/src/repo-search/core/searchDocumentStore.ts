import type { SearchDocument } from '../types.js';
import { LineIndex } from '../utils/text.js';

/**
 * The indexed text documents, shared by every search engine: O(1) lookup by repository path and lazily built,
 * cached offset → line/column indexes.
 */
export class SearchDocumentStore {
  readonly documents: readonly SearchDocument[];
  private readonly byPath: ReadonlyMap<string, SearchDocument>;
  private readonly lineIndexes = new Map<string, LineIndex>();

  constructor(documents: readonly SearchDocument[]) {
    this.documents = documents;
    this.byPath = new Map(documents.map((document) => [document.path, document]));
  }

  get size(): number {
    return this.documents.length;
  }

  /** The document indexed under a repository-relative path. */
  get(repoPath: string): SearchDocument | undefined {
    return this.byPath.get(repoPath);
  }

  has(repoPath: string): boolean {
    return this.byPath.has(repoPath);
  }

  /** Offset → line/column index for `document`, built on first use. */
  lineIndex(document: SearchDocument): LineIndex {
    let index = this.lineIndexes.get(document.path);
    if (!index) {
      index = new LineIndex(document.text);
      this.lineIndexes.set(document.path, index);
    }
    return index;
  }
}
