import * as path from 'node:path';
import { omitUndefined } from '../../shared/objects.js';
import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import type {
  SourceDependencyEntry,
  SourceDependencyKind,
  DependencySearchOptions,
  SearchResult,
  SearchDocument,
} from '../types.js';
import { pushToMap, toSet } from '../utils/collections.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';
import { createAnchoredResult, rankResults } from './results.js';

/** An import-like statement pattern; capture group 1 is the specifier. Patterns use the `d` flag for exact columns. */
interface DependencyPattern {
  readonly kind: SourceDependencyKind;
  readonly regex: RegExp;
}

const JS_DEPENDENCY_PATTERNS: readonly DependencyPattern[] = [
  { kind: 'import', regex: /^\s*import\s+(?:type\s+)?(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/d },
  { kind: 'require', regex: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/d },
  { kind: 'export', regex: /^\s*export\s+(?:type\s+)?(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/d },
  { kind: 'import', regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/d },
];

const C_INCLUDE_PATTERNS: readonly DependencyPattern[] = [
  { kind: 'include', regex: /^\s*#\s*include\s+[<"]([^>"]+)[>"]/d },
];

const DEPENDENCY_PATTERNS: ReadonlyMap<string, readonly DependencyPattern[]> = new Map([
  ['typescript', JS_DEPENDENCY_PATTERNS],
  ['typescriptreact', JS_DEPENDENCY_PATTERNS],
  ['javascript', JS_DEPENDENCY_PATTERNS],
  ['javascriptreact', JS_DEPENDENCY_PATTERNS],
  [
    'python',
    [
      { kind: 'import', regex: /^\s*import\s+([A-Za-z_][\w.]*)(?:\s+as\s+[A-Za-z_]\w*)?/d },
      { kind: 'import', regex: /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+/d },
    ],
  ],
  [
    'rust',
    [
      { kind: 'use', regex: /^\s*use\s+([^;]+);/d },
      { kind: 'module', regex: /^\s*(?:pub\s+)?mod\s+([A-Za-z_]\w*);?/d },
    ],
  ],
  ['java', [{ kind: 'import', regex: /^\s*import\s+(?:static\s+)?([A-Za-z_][\w.*]*);/d }]],
  ['kotlin', [{ kind: 'import', regex: /^\s*import\s+([A-Za-z_][\w.*]*)/d }]],
  ['csharp', [{ kind: 'import', regex: /^\s*using\s+([A-Za-z_][\w.]*)\s*;/d }]],
  ['cpp', C_INCLUDE_PATTERNS],
  ['c', C_INCLUDE_PATTERNS],
  [
    'ruby',
    [
      { kind: 'require', regex: /^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/d },
      { kind: 'include', regex: /^\s*include\s+([A-Z][\w:]*)/d },
    ],
  ],
  [
    'php',
    [
      { kind: 'include', regex: /^\s*(?:include|require)(?:_once)?\s*[('"]+([^'")]+)['")]+/d },
      { kind: 'import', regex: /^\s*use\s+([^;]+);/d },
    ],
  ],
]);

/** Go: `import "x"` / `import alias "x"` on one line, or one spec per line inside `import ( … )`. */
const GO_IMPORT_LINE = /^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/d;
const GO_IMPORT_BLOCK_START = /^\s*import\s*\(\s*$/;
const GO_IMPORT_BLOCK_END = /^\s*\)\s*$/;
const GO_IMPORT_SPEC = /^\s*(?:[\w.]+\s+)?"([^"]+)"/d;

/** Extensions tried, in order, when resolving relative specifiers to indexed files. */
const RESOLVABLE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.cs'];

/** Import/require/use/include index over the indexed documents, with relative specifiers resolved to files. */
export class SourceDependencyIndex {
  readonly dependencies: readonly SourceDependencyEntry[];
  private readonly store: SearchDocumentStore;
  private readonly byPath = new Map<string, SourceDependencyEntry[]>();

  constructor(store: SearchDocumentStore) {
    this.store = store;
    this.dependencies = store.documents.flatMap((doc) =>
      extractSourceDependencies(doc).map((dependency) => ({
        ...dependency,
        ...omitUndefined({ resolvedPath: resolveSpecifier(dependency, store) }),
      })),
    );
    for (const dependency of this.dependencies) pushToMap(this.byPath, dependency.path, dependency);
  }

  search(query: string, options: DependencySearchOptions = {}): SearchResult[] {
    const caseSensitive = options.caseSensitive ?? false;
    const exact = options.exact ?? false;
    const wantedKinds = toSet(options.kind);
    const needle = caseSensitive ? query : query.toLowerCase();

    const results: SearchResult[] = [];
    for (const dependency of this.dependencies) {
      if (wantedKinds && !wantedKinds.has(dependency.kind)) continue;
      const haystack = caseSensitive ? dependency.specifier : dependency.specifier.toLowerCase();
      if (exact ? haystack !== needle : !haystack.includes(needle)) continue;
      results.push(this.toResult(dependency, exact ? 100 : scoreDependency(haystack, needle), options));
    }
    return rankResults(results, options.maxResults ?? DEFAULT_MAX_RESULTS.dependency);
  }

  /** Files importing `specifier` (exact match unless `exact: false`). */
  findImporters(specifier: string, options: DependencySearchOptions = {}): SearchResult[] {
    return this.search(specifier, { ...options, exact: options.exact ?? true });
  }

  listForFile(repoPath: string): SourceDependencyEntry[] {
    return [...(this.byPath.get(repoPath) ?? [])];
  }

  private toResult(dependency: SourceDependencyEntry, score: number, options: DependencySearchOptions): SearchResult {
    return createAnchoredResult({
      method: 'dependency',
      source: dependency,
      score,
      line: dependency.line,
      column: dependency.column,
      token: dependency.specifier,
      lines: this.store.get(dependency.path)?.lines,
      fallbackPreview: dependency.statement,
      contextBefore: options.contextBefore,
      contextAfter: options.contextAfter,
      metadata: { dependency },
    });
  }
}

/** Extracts dependency statements from one document using its language's patterns. */
export function extractSourceDependencies(doc: SearchDocument): SourceDependencyEntry[] {
  if (doc.language === 'go') return extractGoDependencies(doc);
  const patterns = DEPENDENCY_PATTERNS.get(doc.language) ?? [];
  return doc.lines.flatMap((line, index) => {
    for (const { kind, regex } of patterns) {
      const entry = toDependencyEntry(doc, index, kind, regex.exec(line));
      if (entry) return [entry];
    }
    return [];
  });
}

function extractGoDependencies(doc: SearchDocument): SourceDependencyEntry[] {
  const entries: SourceDependencyEntry[] = [];
  let inImportBlock = false;
  doc.lines.forEach((line, index) => {
    if (!inImportBlock && GO_IMPORT_BLOCK_START.test(line)) {
      inImportBlock = true;
    } else if (inImportBlock && GO_IMPORT_BLOCK_END.test(line)) {
      inImportBlock = false;
    } else {
      const entry = toDependencyEntry(
        doc,
        index,
        'import',
        (inImportBlock ? GO_IMPORT_SPEC : GO_IMPORT_LINE).exec(line),
      );
      if (entry) entries.push(entry);
    }
  });
  return entries;
}

function toDependencyEntry(
  doc: SearchDocument,
  index: number,
  kind: SourceDependencyKind,
  match: RegExpExecArray | null,
): SourceDependencyEntry | undefined {
  const raw = match?.[1];
  const specifier = raw?.trim();
  if (!match || !raw || !specifier) return undefined;
  const captureStart = match.indices?.[1]?.[0] ?? match.index;
  const line = doc.lines[index] ?? '';
  return {
    kind,
    specifier,
    path: doc.path,
    absolutePath: doc.absolutePath,
    language: doc.language,
    line: index + 1,
    column: captureStart + raw.indexOf(specifier) + 1,
    statement: line.trim(),
  };
}

/** Resolves a relative specifier (`./x`, `../y`) to an indexed file, trying known extensions and `index` files. */
function resolveSpecifier(dependency: SourceDependencyEntry, store: SearchDocumentStore): string | undefined {
  if (!dependency.specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(dependency.path), dependency.specifier));
  for (const extension of RESOLVABLE_EXTENSIONS) {
    for (const candidate of [`${base}${extension}`, path.posix.join(base, `index${extension}`)]) {
      const repoPath = candidate.replace(/^\.\//, '');
      if (store.has(repoPath)) return repoPath;
    }
  }
  return undefined;
}

function scoreDependency(haystack: string, needle: string): number {
  if (haystack === needle) return 100;
  if (haystack.endsWith(needle)) return 80;
  return 60;
}
