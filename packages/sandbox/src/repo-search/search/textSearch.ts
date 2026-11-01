import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import type {
  BaseSearchOptions,
  RegexSearchOptions,
  SearchResult,
  SearchDocument,
  TextSearchOptions,
} from '../types.js';
import { createPathFilter } from '../utils/pathFilter.js';
import { escapeRegExp, getLineContext, isWordBoundary, normalizeForSearch } from '../utils/text.js';
import { DEFAULT_CONTEXT_LINES, DEFAULT_MAX_RESULTS, MATCH_SCORES } from './defaults.js';
import { createResult, spanToMatch, type MatchSpan } from './results.js';

const SUPPORTED_REGEX_FLAGS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);

/** In-process literal and regular-expression search over indexed documents. */
export class TextSearchEngine {
  private readonly store: SearchDocumentStore;

  constructor(store: SearchDocumentStore) {
    this.store = store;
  }

  searchText(query: string, options: TextSearchOptions = {}): SearchResult[] {
    if (!query) return [];
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS.text;
    const caseSensitive = options.caseSensitive ?? false;
    const needle = normalizeForSearch(query, caseSensitive);
    const results: SearchResult[] = [];

    for (const doc of this.documents(options)) {
      const haystack = normalizeForSearch(doc.text, caseSensitive);
      const lines = this.store.lineIndex(doc);
      let found = haystack.indexOf(needle);
      while (found !== -1 && results.length < maxResults) {
        const end = found + needle.length;
        if (!options.wholeWord || (isWordBoundary(doc.text, found - 1) && isWordBoundary(doc.text, end))) {
          const span = { start: lines.locate(found), end: lines.locate(end), text: doc.text.slice(found, end) };
          results.push(toResult('text', doc, span, options));
        }
        found = haystack.indexOf(needle, end);
      }
      if (results.length >= maxResults) break;
    }
    return results;
  }

  searchRegex(pattern: string | RegExp, options: RegexSearchOptions = {}): SearchResult[] {
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS.regex;
    const regex = toGlobalRegex(pattern, options.flags);
    const results: SearchResult[] = [];

    for (const doc of this.documents(options)) {
      const spans = options.multiline ? this.documentSpans(doc, regex) : lineSpans(doc, regex);
      for (const span of spans) {
        if (results.length >= maxResults) return results;
        results.push(toResult('regex', doc, span, options));
      }
    }
    return results;
  }

  private documents(options: BaseSearchOptions): SearchDocument[] {
    const accepts = createPathFilter(options);
    return this.store.documents.filter((doc) => accepts(doc.path));
  }

  /** Non-empty matches across the whole document text, so patterns may span lines. */
  private *documentSpans(doc: SearchDocument, regex: RegExp): Generator<MatchSpan> {
    const lines = this.store.lineIndex(doc);
    for (const match of doc.text.matchAll(regex)) {
      const text = match[0];
      if (text) yield { start: lines.locate(match.index), end: lines.locate(match.index + text.length), text };
    }
  }
}

/** Builds a regular expression that matches `query` literally. */
export function regexFromLiteral(query: string, options: TextSearchOptions = {}): RegExp {
  const escaped = escapeRegExp(query);
  const startsWithWord = /^[A-Za-z0-9_$]/.test(query);
  const endsWithWord = /[A-Za-z0-9_$]$/.test(query);
  const body = options.wholeWord ? `${startsWithWord ? '\\b' : ''}${escaped}${endsWithWord ? '\\b' : ''}` : escaped;
  return new RegExp(body, options.caseSensitive ? 'g' : 'gi');
}

/** Non-empty matches within each line. */
function* lineSpans(doc: SearchDocument, regex: RegExp): Generator<MatchSpan> {
  for (const [index, line] of doc.lines.entries()) {
    for (const match of line.matchAll(regex)) {
      const text = match[0];
      if (!text) continue;
      yield {
        start: { line: index + 1, column: match.index + 1 },
        end: { line: index + 1, column: match.index + text.length + 1 },
        text,
      };
    }
  }
}

function toResult(
  method: 'text' | 'regex',
  doc: SearchDocument,
  span: MatchSpan,
  options: BaseSearchOptions,
): SearchResult {
  return createResult({
    method,
    source: doc,
    score: MATCH_SCORES[method],
    line: span.start.line,
    endLine: span.end.line,
    column: span.start.column,
    endColumn: span.end.column,
    excerpt: getLineContext(
      doc.lines,
      span.start.line,
      span.end.line,
      options.contextBefore ?? DEFAULT_CONTEXT_LINES,
      options.contextAfter ?? DEFAULT_CONTEXT_LINES,
    ),
    matches: [spanToMatch(span)],
  });
}

/** Compiles `pattern` with its own (RegExp) or the given (string) flags, deduplicated and always global. */
function toGlobalRegex(pattern: string | RegExp, flags: string | undefined): RegExp {
  const source = typeof pattern === 'string' ? pattern : pattern.source;
  const requested = `${typeof pattern === 'string' ? (flags ?? '') : pattern.flags}g`;
  const normalized = [...new Set(requested)].filter((flag) => SUPPORTED_REGEX_FLAGS.has(flag)).join('');
  return new RegExp(source, normalized);
}
