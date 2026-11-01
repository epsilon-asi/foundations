import * as path from 'node:path';
import type { PathMention } from '../schemas.js';
import type { RepoFileEntry, PathMentionSearchOptions, PathSearchOptions, SearchResult } from '../types.js';
import { createPathFilter } from '../utils/pathFilter.js';
import { languageForPath } from '../utils/path.js';
import { makeSnippet, normalizeForSearch } from '../utils/text.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { PathMentionIndex } from './pathMentions.js';
import { createResult, previewExcerpt, rankResults } from './results.js';
import { tokenize } from './tokenizer.js';

/** Fuzzy path search and path-mention extraction over a file list. */
export class PathSearchEngine {
  private readonly files: readonly RepoFileEntry[];
  private mentionIndex: PathMentionIndex | undefined;

  constructor(files: readonly RepoFileEntry[]) {
    this.files = files;
  }

  search(query: string, options: PathSearchOptions = {}): SearchResult[] {
    const caseSensitive = options.caseSensitive ?? false;
    const normalizedQuery = normalizeForSearch(query.trim(), caseSensitive);
    if (!normalizedQuery) return [];
    const queryTokens = caseSensitive
      ? normalizedQuery.split(/[^A-Za-z0-9_$@#.-]+/).filter(Boolean)
      : tokenize(normalizedQuery, { keepStopwords: true });
    const accepts = createPathFilter(options);

    const results: SearchResult[] = [];
    for (const file of this.files) {
      if (!accepts(file.path)) continue;
      const score = scorePath(normalizeForSearch(file.path, caseSensitive), normalizedQuery, queryTokens);
      if (score <= 0) continue;
      results.push(
        createResult({
          method: 'path',
          source: { ...file, language: file.language || languageForPath(file.path) },
          score,
          line: 1,
          excerpt: previewExcerpt(makeSnippet(file.path)),
          metadata: { basename: path.posix.basename(file.path), extension: file.extension, size: file.size },
        }),
      );
    }
    return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.path);
  }

  /**
   * Finds repository files explicitly mentioned in arbitrary text such as prompts, stack traces, compiler output,
   * or review comments. Unlike fuzzy `search`, every mention must name an actual file; ambiguous bare filenames
   * are returned with lower confidence unless `includeAmbiguousBasenames` is false.
   */
  searchTextForPaths(text: string | readonly string[], options: PathMentionSearchOptions = {}): PathMention[] {
    this.mentionIndex ??= new PathMentionIndex(this.files);
    return this.mentionIndex.find(text, options);
  }

  /** Alias of `searchTextForPaths` for callers that prefer extraction terminology. */
  findPathMentions(text: string | readonly string[], options: PathMentionSearchOptions = {}): PathMention[] {
    return this.searchTextForPaths(text, options);
  }
}

/** Scores how well `pathValue` matches `query`: exact > basename > suffix > substring > tokens/subsequence. */
export function scorePath(pathValue: string, query: string, queryTokens: readonly string[]): number {
  if (!query) return 0;
  const base = pathValue.split('/').pop() ?? pathValue;
  if (pathValue === query) return 100;
  if (base === query) return 95;
  if (pathValue.endsWith(`/${query}`)) return 90;
  if (pathValue.includes(query)) return 70 + (query.length / Math.max(pathValue.length, 1)) * 10;

  const tokenHits = queryTokens.filter((token) => pathValue.includes(token)).length;
  const tokenScore = queryTokens.length > 0 ? (tokenHits / queryTokens.length) * 55 : 0;
  return Math.max(tokenScore, scoreSubsequence(pathValue, query) * 45);
}

function scoreSubsequence(haystack: string, needle: string): number {
  let matched = 0;
  let consecutive = 0;
  let bestConsecutive = 0;
  let first = -1;
  for (let h = 0; h < haystack.length && matched < needle.length; h += 1) {
    if (haystack[h] === needle[matched]) {
      if (first === -1) first = h;
      matched += 1;
      consecutive += 1;
      bestConsecutive = Math.max(bestConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }
  if (matched < needle.length) return 0;
  const coverage = needle.length / haystack.length;
  const compactness = bestConsecutive / needle.length;
  const startBonus = first <= 2 ? 0.15 : 0;
  return Math.min(1, coverage * 0.45 + compactness * 0.4 + startBonus);
}
