import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import type {
  BaseSearchOptions,
  SearchResult,
  StructuralSearchQuery,
  SymbolEntry,
  SymbolKind,
  SymbolSearchOptions,
  SearchDocument,
} from '../types.js';
import { toSet } from '../utils/collections.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { createAnchoredResult, rankResults } from './results.js';

/** Decides whether a declaration matched by a pattern is exported/public. */
type ExportedPredicate = (match: RegExpExecArray) => boolean;

/** A declaration pattern; capture group 1 is the symbol name. Patterns use the `d` flag for exact columns. */
interface SymbolPattern {
  readonly kind: SymbolKind;
  readonly regex: RegExp;
  /** Default: the line contains `export` or `public`. */
  readonly exported?: ExportedPredicate;
}

function hasKeyword(keyword: string): ExportedPredicate {
  const pattern = new RegExp(`\\b${keyword}\\b`);
  return (match) => pattern.test(match[0]);
}
const isExportDeclaration = hasKeyword('export');
const isPublicDeclaration = hasKeyword('public');
const isRustPub: ExportedPredicate = (match) => /^\s*pub/.test(match[0]);
const isGoExported: ExportedPredicate = (match) => /^\p{Lu}/u.test(match[1] ?? '');
const DEFAULT_EXPORTED = /\bexport\b|\bpublic\b/;

/** Applies one `exported` predicate to a group of `[kind, regex]` patterns. */
function withExported(
  exported: ExportedPredicate,
  patterns: readonly (readonly [SymbolKind, RegExp])[],
): SymbolPattern[] {
  return patterns.map(([kind, regex]) => ({ kind, regex, exported }));
}

const JS_LIKE_PATTERNS: readonly SymbolPattern[] = [
  ...withExported(isExportDeclaration, [
    ['class', /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\b/d],
    ['interface', /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/d],
    ['type', /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/d],
    ['enum', /^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/d],
    ['namespace', /^\s*(?:export\s+)?namespace\s+([A-Za-z_$][\w$]*)\b/d],
    ['function', /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/d],
    [
      'function',
      /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/d,
    ],
    ['variable', /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/d],
  ]),
  {
    kind: 'method',
    regex:
      /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[:{]/d,
  },
];

const JVM_LIKE_PATTERNS: readonly SymbolPattern[] = withExported(isPublicDeclaration, [
  ['class', /^\s*(?:public|private|protected|abstract|final|sealed|open|data|\s)*class\s+([A-Za-z_]\w*)\b/d],
  ['interface', /^\s*(?:public|private|protected|abstract|sealed|\s)*interface\s+([A-Za-z_]\w*)\b/d],
  ['enum', /^\s*(?:public|private|protected|\s)*enum\s+([A-Za-z_]\w*)\b/d],
  [
    'function',
    /^\s*(?:public|private|protected|static|final|abstract|override|suspend|async|\s)*(?:[A-Za-z_<>,.?[\]]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:throws\s+[\w,\s]+)?\{?\s*$/d,
  ],
]);

const C_LIKE_PATTERNS: readonly SymbolPattern[] = [
  { kind: 'struct', regex: /^\s*(?:typedef\s+)?struct\s+([A-Za-z_]\w*)\b/d },
  { kind: 'enum', regex: /^\s*enum\s+([A-Za-z_]\w*)\b/d },
  {
    kind: 'function',
    regex:
      /^\s*(?:static\s+|inline\s+|extern\s+|constexpr\s+)*[A-Za-z_][\w:<>,*&\s]+\s+([A-Za-z_][\w:]*)\s*\([^;]*\)\s*(?:const\s*)?(?:\{|$)/d,
  },
];

const GENERIC_PATTERNS: readonly SymbolPattern[] = [
  { kind: 'class', regex: /^\s*class\s+([A-Za-z_]\w*)\b/d },
  { kind: 'function', regex: /^\s*(?:function|def|fn)\s+([A-Za-z_]\w*)\b/d },
];

const SYMBOL_PATTERNS: ReadonlyMap<string, readonly SymbolPattern[]> = new Map([
  ['typescript', JS_LIKE_PATTERNS],
  ['typescriptreact', JS_LIKE_PATTERNS],
  ['javascript', JS_LIKE_PATTERNS],
  ['javascriptreact', JS_LIKE_PATTERNS],
  [
    'python',
    [
      { kind: 'class', regex: /^\s*class\s+([A-Za-z_]\w*)\b.*:/d },
      { kind: 'function', regex: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/d },
      { kind: 'variable', regex: /^\s*([A-Z_][A-Z0-9_]*)\s*=/d },
    ],
  ],
  [
    'go',
    withExported(isGoExported, [
      ['function', /^\s*func\s+([A-Za-z_]\w*)\s*\(/d],
      ['method', /^\s*func\s*\([^)]*\)\s*([A-Za-z_]\w*)\s*\(/d],
      ['struct', /^\s*type\s+([A-Za-z_]\w*)\s+struct\b/d],
      ['interface', /^\s*type\s+([A-Za-z_]\w*)\s+interface\b/d],
      ['type', /^\s*type\s+([A-Za-z_]\w*)\b/d],
      ['constant', /^\s*const\s+([A-Za-z_]\w*)\b/d],
      ['variable', /^\s*var\s+([A-Za-z_]\w*)\b/d],
    ]),
  ],
  [
    'rust',
    [
      ...withExported(isRustPub, [
        ['function', /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*[<(]/d],
        ['struct', /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)\b/d],
        ['enum', /^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)\b/d],
        ['trait', /^\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)\b/d],
      ]),
      { kind: 'impl', regex: /^\s*impl(?:<[^>]+>)?\s+([A-Za-z_]\w*)\b/d },
    ],
  ],
  ['java', JVM_LIKE_PATTERNS],
  ['kotlin', JVM_LIKE_PATTERNS],
  ['csharp', JVM_LIKE_PATTERNS],
  ['cpp', C_LIKE_PATTERNS],
  ['c', C_LIKE_PATTERNS],
  [
    'php',
    [
      { kind: 'class', regex: /^\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z_]\w*)\b/d },
      { kind: 'interface', regex: /^\s*interface\s+([A-Za-z_]\w*)\b/d },
      {
        kind: 'function',
        regex: /^\s*(?:public|private|protected|static|final|abstract|\s)*function\s+([A-Za-z_]\w*)\s*\(/d,
      },
    ],
  ],
  [
    'ruby',
    [
      { kind: 'class', regex: /^\s*class\s+([A-Z][\w:]*)\b/d },
      { kind: 'module', regex: /^\s*module\s+([A-Z][\w:]*)\b/d },
      { kind: 'function', regex: /^\s*def\s+([A-Za-z_][\w!?=]*)\b/d },
    ],
  ],
]);

/** Kinds whose body can contain other symbols (recorded as `containerName`). */
const CONTAINER_KINDS: ReadonlySet<SymbolKind> = new Set([
  'class',
  'interface',
  'struct',
  'enum',
  'trait',
  'impl',
  'module',
  'namespace',
]);

/** Control-flow keywords that look like calls (`if (x) {`) and are never symbol names. */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'else',
  'do',
  'with',
  'new',
  'typeof',
  'await',
  'super',
  'sizeof',
]);

/** Heuristic symbol index over the indexed documents. */
export class SymbolIndex {
  readonly symbols: readonly SymbolEntry[];
  private readonly store: SearchDocumentStore;

  constructor(store: SearchDocumentStore) {
    this.store = store;
    this.symbols = store.documents.flatMap(extractSymbols);
  }

  /** Fuzzy (or `exact`) name search; scores exact > prefix > substring > subsequence. */
  search(query: string, options: SymbolSearchOptions = {}): SearchResult[] {
    const caseSensitive = options.caseSensitive ?? false;
    const wantedKinds = toSet(options.kind);
    const needle = caseSensitive ? query : query.toLowerCase();

    const results: SearchResult[] = [];
    for (const symbol of this.symbols) {
      if (wantedKinds && !wantedKinds.has(symbol.kind)) continue;
      if (options.exported !== undefined && symbol.exported !== options.exported) continue;
      const haystack = caseSensitive ? symbol.name : symbol.name.toLowerCase();
      const score = options.exact ? (haystack === needle ? 100 : 0) : scoreSymbolName(haystack, needle);
      if (score > 0) results.push(this.toResult(symbol, score, options));
    }
    return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.symbol);
  }

  findDefinition(name: string, options: SymbolSearchOptions = {}): SearchResult[] {
    return this.search(name, {
      ...options,
      exact: true,
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS.definition,
    });
  }

  /** Filters symbols by kind, language, export status, signature, path, name, and nearby body text. */
  structuralSearch(query: StructuralSearchQuery, maxResults: number = DEFAULT_MAX_RESULTS.structural): SearchResult[] {
    const wantedKinds = toSet(query.kind);
    const languages = toSet(query.language);
    const wantedLanguages = languages && new Set([...languages].map((language) => language.toLowerCase()));
    const nameText = typeof query.name === 'string' ? query.name.toLowerCase() : undefined;
    const nearText = query.nearText?.toLowerCase();

    const results: SearchResult[] = [];
    for (const symbol of this.symbols) {
      if (results.length >= maxResults) break;
      if (wantedKinds && !wantedKinds.has(symbol.kind)) continue;
      if (wantedLanguages && !wantedLanguages.has(symbol.language.toLowerCase())) continue;
      if (query.exported !== undefined && symbol.exported !== query.exported) continue;
      if (query.pathIncludes && !symbol.path.includes(query.pathIncludes)) continue;
      if (query.signatureIncludes && !symbol.signature.includes(query.signatureIncludes)) continue;
      if (nameText !== undefined && !symbol.name.toLowerCase().includes(nameText)) continue;
      // `search` ignores `lastIndex`, so global/sticky patterns behave the same on every symbol.
      if (query.name instanceof RegExp && symbol.name.search(query.name) === -1) continue;
      if (nearText && !this.symbolBody(symbol).toLowerCase().includes(nearText)) continue;
      results.push(this.toResult(symbol, 1, {}));
    }
    return results;
  }

  private symbolBody(symbol: SymbolEntry): string {
    return (
      this.store
        .get(symbol.path)
        ?.lines.slice(symbol.line - 1, symbol.endLine)
        .join('\n') ?? ''
    );
  }

  private toResult(symbol: SymbolEntry, score: number, options: BaseSearchOptions): SearchResult {
    return createAnchoredResult({
      method: 'symbol',
      source: symbol,
      score,
      line: symbol.line,
      endLine: symbol.endLine,
      column: symbol.column,
      token: symbol.name,
      lines: this.store.get(symbol.path)?.lines,
      fallbackPreview: symbol.signature,
      contextBefore: options.contextBefore,
      contextAfter: options.contextAfter,
      metadata: { symbol },
    });
  }
}

/** Extracts declarations from one document using its language's patterns (or generic ones). */
export function extractSymbols(doc: SearchDocument): SymbolEntry[] {
  const patterns = SYMBOL_PATTERNS.get(doc.language) ?? GENERIC_PATTERNS;
  const symbols: SymbolEntry[] = [];
  const containers: SymbolEntry[] = [];

  doc.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    while ((containers.at(-1)?.endLine ?? Infinity) < lineNumber) containers.pop();
    const declaration = matchDeclaration(line, patterns);
    if (!declaration) return;

    const { pattern, match, name } = declaration;
    const column = (match.indices?.[1]?.[0] ?? line.indexOf(name)) + 1;
    const entry: SymbolEntry = {
      id: `${doc.path}:${lineNumber}:${column}:${name}`,
      name,
      kind: pattern.kind,
      path: doc.path,
      absolutePath: doc.absolutePath,
      language: doc.language,
      line: lineNumber,
      column,
      endLine: estimateSymbolEndLine(doc.lines, index, doc.language),
      signature: line.trim(),
      exported: pattern.exported ? pattern.exported(match) : DEFAULT_EXPORTED.test(line),
    };
    const container = containers.at(-1);
    if (container) entry.containerName = container.name;
    symbols.push(entry);
    if (CONTAINER_KINDS.has(entry.kind)) containers.push(entry);
  });
  return symbols;
}

function matchDeclaration(
  line: string,
  patterns: readonly SymbolPattern[],
): { pattern: SymbolPattern; match: RegExpExecArray; name: string } | undefined {
  for (const pattern of patterns) {
    const match = pattern.regex.exec(line);
    const name = match?.[1];
    if (match && name && !RESERVED_NAMES.has(name)) return { pattern, match, name };
  }
  return undefined;
}

function estimateSymbolEndLine(lines: readonly string[], startIndex: number, language: string): number {
  return language === 'python' || language === 'ruby'
    ? estimateIndentBlockEnd(lines, startIndex)
    : estimateBraceBlockEnd(lines, startIndex);
}

function estimateIndentBlockEnd(lines: readonly string[], startIndex: number): number {
  const indent = leadingWhitespace(lines[startIndex] ?? '');
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trim() && leadingWhitespace(line) <= indent && !line.trim().startsWith('#')) return i;
  }
  return lines.length;
}

function estimateBraceBlockEnd(lines: readonly string[], startIndex: number): number {
  let depth = 0;
  let seenBrace = false;
  for (let i = startIndex; i < lines.length; i += 1) {
    for (const char of stripStringsAndComments(lines[i] ?? '')) {
      if (char === '{') {
        depth += 1;
        seenBrace = true;
      } else if (char === '}') {
        depth -= 1;
      }
    }
    if (seenBrace && depth <= 0) return i + 1;
    if (!seenBrace && i > startIndex + 25) return startIndex + 1;
  }
  return lines.length;
}

function stripStringsAndComments(line: string): string {
  return line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '').replace(/\/\/.*$/, '');
}

function leadingWhitespace(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

function scoreSymbolName(haystack: string, needle: string): number {
  if (!needle) return 0;
  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 85;
  if (haystack.includes(needle)) return 70;
  return isSubsequence(haystack, needle) ? (45 * needle.length) / haystack.length : 0;
}

function isSubsequence(haystack: string, needle: string): boolean {
  let matched = 0;
  for (const char of haystack) if (char === needle[matched]) matched += 1;
  return matched === needle.length;
}
