import { omitUndefined } from '../../shared/objects.js';
import type { SearchMatch, SearchMethod, SearchResult } from '../types.js';
import { getLineContext, makeSnippet, type LineColumn, type LineExcerpt } from '../utils/text.js';
import { DEFAULT_CONTEXT_LINES } from './defaults.js';

/** Ranking shared by every search method: score descending, then path, then line. */
export function compareResults(a: SearchResult, b: SearchResult): number {
  return b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line;
}

/** Sorts `results` in place by `compareResults` and keeps the first `maxResults`. */
export function rankResults(results: SearchResult[], maxResults: number): SearchResult[] {
  return results.sort(compareResults).slice(0, maxResults);
}

/** The file a result points into; `RepoFileEntry`, `SearchDocument`, `SymbolEntry`, and `SourceDependencyEntry` all qualify. */
export interface ResultSource {
  readonly path: string;
  readonly absolutePath: string;
  readonly language: string;
}

export interface ResultSpec {
  method: SearchMethod;
  source: ResultSource;
  score: number;
  line: number;
  /** Default: `line`. */
  endLine?: number | undefined;
  column?: number | undefined;
  endColumn?: number | undefined;
  /** Default: empty preview and context. */
  excerpt?: LineExcerpt | undefined;
  matches?: SearchMatch[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** The single constructor for `SearchResult` objects. */
export function createResult(spec: ResultSpec): SearchResult {
  const excerpt = spec.excerpt ?? previewExcerpt('');
  return {
    method: spec.method,
    path: spec.source.path,
    absolutePath: spec.source.absolutePath,
    score: spec.score,
    line: spec.line,
    endLine: spec.endLine ?? spec.line,
    ...omitUndefined({ column: spec.column, endColumn: spec.endColumn }),
    language: spec.source.language,
    preview: excerpt.preview,
    contextBefore: excerpt.contextBefore,
    contextAfter: excerpt.contextAfter,
    matches: spec.matches ?? [],
    ...omitUndefined({ metadata: spec.metadata }),
  };
}

/** An excerpt with only a preview line. */
export function previewExcerpt(preview: string): LineExcerpt {
  return { preview, contextBefore: [], contextAfter: [] };
}

/**
 * Excerpt with a compact single-line preview of `line..endLine`, falling back to `fallback` when the document's
 * lines are unavailable or the range is blank.
 */
export function snippetExcerpt(
  lines: readonly string[] | undefined,
  range: { line: number; endLine: number },
  fallback: string,
  before: number,
  after: number,
): LineExcerpt {
  if (!lines) return previewExcerpt(makeSnippet(fallback));
  const excerpt = getLineContext(lines, range.line, range.endLine, before, after);
  return { ...excerpt, preview: makeSnippet(excerpt.preview || fallback) };
}

/** A located match between two positions. */
export interface MatchSpan {
  start: LineColumn;
  end: LineColumn;
  text: string;
}

export function spanToMatch(span: MatchSpan): SearchMatch {
  return {
    line: span.start.line,
    column: span.start.column,
    endLine: span.end.line,
    endColumn: span.end.column,
    text: span.text,
  };
}

export interface AnchoredResultSpec {
  method: SearchMethod;
  source: ResultSource;
  score: number;
  line: number;
  endLine?: number | undefined;
  column: number;
  /** The token the result is anchored on: a symbol name, import specifier, or callee name. */
  token: string;
  /** Lines of the containing document, when indexed. */
  lines: readonly string[] | undefined;
  /** Preview used when the document's lines are unavailable. */
  fallbackPreview: string;
  contextBefore?: number | undefined;
  contextAfter?: number | undefined;
  metadata: Record<string, unknown>;
}

/** Result anchored on one token of one line (symbols, dependencies, call sites), with snippet preview and context. */
export function createAnchoredResult(spec: AnchoredResultSpec): SearchResult {
  const { line, column, token } = spec;
  return createResult({
    method: spec.method,
    source: spec.source,
    score: spec.score,
    line,
    endLine: spec.endLine,
    column,
    excerpt: snippetExcerpt(
      spec.lines,
      { line, endLine: line },
      spec.fallbackPreview,
      spec.contextBefore ?? DEFAULT_CONTEXT_LINES,
      spec.contextAfter ?? DEFAULT_CONTEXT_LINES,
    ),
    matches: [spanToMatch({ start: { line, column }, end: { line, column: column + token.length }, text: token })],
    metadata: spec.metadata,
  });
}
