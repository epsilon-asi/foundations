import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import type {
  CallGraphEdge,
  CallGraphOptions,
  CallGraphSearchOptions,
  SearchResult,
  SymbolEntry,
  SymbolKind,
} from '../types.js';
import { pushToMap } from '../utils/collections.js';
import { LineIndex } from '../utils/text.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { createAnchoredResult, rankResults } from './results.js';

const CALLABLE_KINDS: ReadonlySet<SymbolKind> = new Set(['function', 'method', 'class']);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** `name(` not preceded by another identifier character; group 1 is the called name. */
const CALL_SITE = /(?<![\w$])([A-Za-z_$][\w$]*)\s*\(/g;
const DEFAULT_MAX_SYMBOLS = 5000;
/** Callee names at least this long are less likely to be coincidental cross-file matches. */
const DISTINCTIVE_NAME_LENGTH = 5;
const CONFIDENCE_SCORES = { high: 1, medium: 0.75, low: 0.45 } as const satisfies Record<
  CallGraphEdge['confidence'],
  number
>;

/**
 * Approximate, name-based call graph: an edge links each callable symbol to every known callable whose name is
 * called (`name(`) inside its body. Same-file edges have high confidence; cross-file edges depend on name length.
 */
export class CallGraphIndex {
  private readonly store: SearchDocumentStore;
  private readonly symbols: readonly SymbolEntry[];
  private readonly cache = new Map<string, readonly CallGraphEdge[]>();

  constructor(store: SearchDocumentStore, symbols: readonly SymbolEntry[]) {
    this.store = store;
    this.symbols = symbols;
  }

  /** Edges for the given options; each distinct option set is computed once and cached. */
  build(options: CallGraphOptions = {}): readonly CallGraphEdge[] {
    const maxSymbols = options.maxSymbols ?? DEFAULT_MAX_SYMBOLS;
    const sameFileOnly = options.sameFileOnly ?? false;
    const key = `${maxSymbols}:${sameFileOnly}`;
    let edges = this.cache.get(key);
    if (!edges) {
      edges = this.computeEdges(maxSymbols, sameFileOnly);
      this.cache.set(key, edges);
    }
    return edges;
  }

  /** Call sites of `name`. */
  findCallers(name: string, options: CallGraphSearchOptions = {}): SearchResult[] {
    return this.toResults(
      this.build(options).filter((edge) => edge.callee.name === name),
      options.maxResults,
    );
  }

  /** Calls made from inside `name`. */
  findCallees(name: string, options: CallGraphSearchOptions = {}): SearchResult[] {
    return this.toResults(
      this.build(options).filter((edge) => edge.caller.name === name),
      options.maxResults,
    );
  }

  private computeEdges(maxSymbols: number, sameFileOnly: boolean): CallGraphEdge[] {
    const callables = this.symbols
      .filter((symbol) => CALLABLE_KINDS.has(symbol.kind) && IDENTIFIER.test(symbol.name))
      .slice(0, maxSymbols);
    const callablesByName = new Map<string, SymbolEntry[]>();
    for (const symbol of callables) pushToMap(callablesByName, symbol.name, symbol);

    const edges: CallGraphEdge[] = [];
    for (const caller of callables) {
      const doc = this.store.get(caller.path);
      if (!doc) continue;
      // One scan of the body per caller; callee lookup is by name.
      const body = doc.lines.slice(caller.line - 1, caller.endLine).join('\n');
      const positions = new LineIndex(body);
      for (const call of body.matchAll(CALL_SITE)) {
        const callees = callablesByName.get(call[1] ?? '') ?? [];
        const position = positions.locate(call.index);
        for (const callee of callees) {
          if (callee.id === caller.id || (sameFileOnly && callee.path !== caller.path)) continue;
          edges.push({
            caller,
            callee,
            path: caller.path,
            line: caller.line + position.line - 1,
            column: position.column,
            confidence: edgeConfidence(caller, callee),
          });
        }
      }
    }
    return edges;
  }

  private toResults(
    edges: readonly CallGraphEdge[],
    maxResults: number = DEFAULT_MAX_RESULTS.callgraph,
  ): SearchResult[] {
    const results = edges.map((edge) =>
      // The result points at the call site, which is always in the caller's file.
      createAnchoredResult({
        method: 'callgraph',
        source: edge.caller,
        score: CONFIDENCE_SCORES[edge.confidence],
        line: edge.line,
        column: edge.column,
        token: edge.callee.name,
        lines: this.store.get(edge.path)?.lines,
        fallbackPreview: `${edge.caller.name} -> ${edge.callee.name}`,
        metadata: { edge },
      }),
    );
    return rankResults(results, maxResults);
  }
}

function edgeConfidence(caller: SymbolEntry, callee: SymbolEntry): CallGraphEdge['confidence'] {
  if (callee.path === caller.path) return 'high';
  return callee.name.length >= DISTINCTIVE_NAME_LENGTH ? 'medium' : 'low';
}
