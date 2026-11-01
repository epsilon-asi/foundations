/** Default `maxResults` per search operation — the single source of truth for result limits. */
export const DEFAULT_MAX_RESULTS = {
  text: 100,
  regex: 100,
  path: 50,
  pathMentions: 100,
  bm25: 20,
  similarity: 20,
  symbol: 50,
  definition: 20,
  dependency: 50,
  callgraph: 50,
  structural: 100,
  tests: 20,
  hybrid: 20,
} as const;

/** Default lines of context around line-anchored results (text, regex, symbol, dependency, call graph). */
export const DEFAULT_CONTEXT_LINES = 2;

/** Scores of literal and regex matches; both backends (Node and ripgrep) use the same values. */
export const MATCH_SCORES = { text: 1, regex: 0.95 } as const;
