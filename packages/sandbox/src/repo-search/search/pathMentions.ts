import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PathMention, PathMentionConfidence, PathMentionKind, PathMentionTextRange } from '../schemas.js';
import type { RepoFileEntry, PathMentionSearchOptions } from '../types.js';
import { pushToMap } from '../utils/collections.js';
import { createPathFilter } from '../utils/pathFilter.js';
import { languageForPath, normalizeRepoPath, toPosixPath } from '../utils/path.js';
import { LineIndex } from '../utils/text.js';
import { DEFAULT_MAX_RESULTS } from './defaults.js';

const EXTENSIONLESS_FILENAMES = new Set([
  'dockerfile',
  'makefile',
  'rakefile',
  'gemfile',
  'procfile',
  'license',
  'licence',
  'copying',
  'notice',
  'readme',
  'changelog',
  'contributing',
  'authors',
  'owners',
  'codeowners',
]);

/** Well-known config filenames recognized even without surrounding path syntax (lower-cased). */
const NAMED_CONFIG_FILENAMES = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.build.json',
  'vitest.config.ts',
  'vite.config.ts',
  'rollup.config.js',
  'webpack.config.js',
  'eslint.config.js',
  'prettier.config.js',
  'pyproject.toml',
  'cargo.toml',
  'go.mod',
  'go.sum',
  'makefile',
  'dockerfile',
  'readme.md',
];

const CANDIDATE_REGEX =
  /file:\/\/[^\s"'`<>]+|(?:[A-Za-z]:)?(?:[./~]+)?[A-Za-z0-9_.$@#~+%=-][A-Za-z0-9_.$@#~+%={}()[\]-]*(?:[\\/][A-Za-z0-9_.$@#~+%={}()[\]-]+)+(?:#L?\d+(?:-L?\d+)?|:\d+(?::\d+)?)?|[A-Za-z0-9_.@$#~+%={}()[\]-]+\.[A-Za-z0-9][A-Za-z0-9._-]{0,16}(?:#L?\d+(?:-L?\d+)?|:\d+(?::\d+)?)?|Dockerfile|Makefile|README(?:\.[A-Za-z0-9]+)?/gi;
const QUOTED_CANDIDATE_REGEX = /[`"']([^`"'\r\n]{1,512})[`"']/g;
const MARKDOWN_LINK_TARGET_REGEX = /\]\(([^)\r\n]{1,512})\)/g;
const FILENAME_CHARACTER = /[A-Za-z0-9_.-]/;
const TRIM_LEADING = /^[\s`'"<({[]+/;
const TRIM_TRAILING = /[\s`'",;.!?<>)}\]]+$/;
const MAX_CANDIDATE_LENGTH = 1024;

const MATCH_SCORES = {
  exact: 100,
  'case-insensitive': 95,
  suffix: 88,
  basename: 82,
  'ambiguous-basename': 55,
} as const satisfies Record<PathMentionConfidence, number>;

/** A path-like span of the searched text. */
interface CandidateMention {
  mention: string;
  offset: number;
  endOffset: number;
}

interface NormalizedCandidate {
  candidate: string;
  normalizedCandidate: string;
  kind: PathMentionKind;
  referencedLine: number | null;
  referencedColumn: number | null;
}

interface CandidateMatch {
  file: RepoFileEntry;
  confidence: PathMentionConfidence;
  alternatives: string[] | null;
}

/** Lookup tables over a file list for resolving path mentions found in free text. */
export class PathMentionIndex {
  private readonly pathByExact = new Map<string, RepoFileEntry>();
  private readonly pathByFolded = new Map<string, RepoFileEntry>();
  private readonly absoluteByExact = new Map<string, RepoFileEntry>();
  private readonly absoluteByFolded = new Map<string, RepoFileEntry>();
  private readonly basenameByExact = new Map<string, RepoFileEntry[]>();
  private readonly basenameByFolded = new Map<string, RepoFileEntry[]>();

  constructor(files: readonly RepoFileEntry[]) {
    for (const file of files) {
      const repoPath = normalizeRepoPath(file.path);
      const absolutePath = toPosixPath(path.resolve(file.absolutePath));
      const basename = path.posix.basename(repoPath);
      this.pathByExact.set(repoPath, file);
      this.pathByFolded.set(repoPath.toLowerCase(), file);
      this.absoluteByExact.set(absolutePath, file);
      this.absoluteByFolded.set(absolutePath.toLowerCase(), file);
      pushToMap(this.basenameByExact, basename, file);
      pushToMap(this.basenameByFolded, basename.toLowerCase(), file);
    }
  }

  /**
   * Finds repository files explicitly mentioned in `text` (a string or an array of text blocks): relative and
   * absolute paths, `file://` URLs, quoted paths, Markdown link targets, and bare filenames, with optional
   * `:line:column` / `#Lline` suffixes. Every candidate is verified against the indexed file list.
   */
  find(text: string | readonly string[], options: PathMentionSearchOptions = {}): PathMention[] {
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS.pathMentions;
    const accepts = createPathFilter(options, options.caseSensitive ?? false);
    const blocks =
      typeof text === 'string'
        ? [{ text, sourceIndex: null }]
        : text.map((block, sourceIndex) => ({ text: block, sourceIndex }));
    const results: PathMention[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      let lines: LineIndex | undefined;
      for (const candidate of extractCandidates(block.text)) {
        const normalized = normalizeCandidate(candidate.mention);
        if (!normalized) continue;
        for (const { file, confidence, alternatives } of this.match(normalized, options)) {
          if (results.length >= maxResults) return results;
          if (!accepts(file.path)) continue;
          const key = `${block.sourceIndex ?? ''}:${candidate.offset}:${candidate.endOffset}:${file.path}`;
          if (seen.has(key)) continue;
          seen.add(key);
          lines ??= new LineIndex(block.text);
          results.push({
            mention: candidate.mention,
            candidate: normalized.candidate,
            normalizedCandidate: normalized.normalizedCandidate,
            path: file.path,
            absolutePath: file.absolutePath,
            basename: path.posix.basename(file.path),
            extension: file.extension,
            language: file.language || languageForPath(file.path),
            kind: normalized.kind,
            confidence,
            score: MATCH_SCORES[confidence],
            textRange: textRange(lines, candidate, block.sourceIndex),
            referencedLine: normalized.referencedLine,
            referencedColumn: normalized.referencedColumn,
            ambiguous: confidence === 'ambiguous-basename',
            alternatives: otherPaths(alternatives, file.path),
          });
        }
      }
    }
    return results;
  }

  private match(candidate: NormalizedCandidate, options: PathMentionSearchOptions): CandidateMatch[] {
    const caseSensitive = options.caseSensitive ?? false;
    const key = candidate.normalizedCandidate;
    const foldedKey = key.toLowerCase();

    if (candidate.kind === 'basename') {
      if (options.includeBasenames === false) return [];
      const files = caseSensitive ? this.basenameByExact.get(key) : this.basenameByFolded.get(foldedKey);
      if (!files?.[0]) return [];
      if (files.length === 1) return [{ file: files[0], confidence: 'basename', alternatives: null }];
      if (options.includeAmbiguousBasenames === false) return [];
      const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
      const alternatives = sorted.map((file) => file.path);
      return sorted.map((file) => ({ file, confidence: 'ambiguous-basename', alternatives }));
    }

    const absolute = candidate.kind === 'absolute-path' || candidate.kind === 'file-url';
    const exact = (absolute ? this.absoluteByExact : this.pathByExact).get(key);
    if (exact) return [{ file: exact, confidence: 'exact', alternatives: null }];
    const folded = caseSensitive ? undefined : (absolute ? this.absoluteByFolded : this.pathByFolded).get(foldedKey);
    if (folded) return [{ file: folded, confidence: 'case-insensitive', alternatives: null }];
    return this.suffixMatches(key, caseSensitive).map((file) => ({ file, confidence: 'suffix', alternatives: null }));
  }

  /** Files whose path ends with the candidate (or vice versa) on a path-segment boundary. */
  private suffixMatches(key: string, caseSensitive: boolean): RepoFileEntry[] {
    const fold = (value: string): string => (caseSensitive ? value : value.toLowerCase());
    const candidate = fold(normalizeRepoPath(key).replace(/^\.\.\//, ''));
    const matches: RepoFileEntry[] = [];
    for (const [repoPath, file] of this.pathByExact) {
      const comparable = fold(repoPath);
      if (comparable.endsWith(`/${candidate}`) || candidate.endsWith(`/${comparable}`)) matches.push(file);
    }
    return matches.sort((a, b) => a.path.localeCompare(b.path));
  }
}

/**
 * Searches arbitrary text for mentions of files in `files`, for example
 * `Please inspect src/auth.ts:42 and README.md`. Build a `PathSearchEngine` to reuse the lookup tables.
 */
export function searchTextForPaths(
  text: string | readonly string[],
  files: readonly RepoFileEntry[],
  options: PathMentionSearchOptions = {},
): PathMention[] {
  return new PathMentionIndex(files).find(text, options);
}

function extractCandidates(text: string): CandidateMention[] {
  const candidates = [
    ...regexCandidates(text, CANDIDATE_REGEX, 0),
    ...regexCandidates(text, QUOTED_CANDIDATE_REGEX, 1),
    ...regexCandidates(text, MARKDOWN_LINK_TARGET_REGEX, 1),
    ...namedConfigCandidates(text),
  ];
  candidates.sort((a, b) => a.offset - b.offset || b.mention.length - a.mention.length);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!candidate.mention || candidate.mention.length > MAX_CANDIDATE_LENGTH) return false;
    const key = `${candidate.offset}:${candidate.endOffset}:${candidate.mention}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function regexCandidates(text: string, regex: RegExp, captureIndex: 0 | 1): CandidateMention[] {
  const candidates: CandidateMention[] = [];
  for (const match of text.matchAll(regex)) {
    const capture = match[captureIndex];
    if (!capture) continue;
    const start = match.index + (captureIndex === 0 ? 0 : match[0].indexOf(capture));
    candidates.push(trimCandidate(text, start, start + capture.length));
  }
  return candidates;
}

function namedConfigCandidates(text: string): CandidateMention[] {
  const lowerText = text.toLowerCase();
  const candidates: CandidateMention[] = [];
  for (const name of NAMED_CONFIG_FILENAMES) {
    for (let index = lowerText.indexOf(name); index !== -1; index = lowerText.indexOf(name, index + 1)) {
      const end = index + name.length;
      if (!FILENAME_CHARACTER.test(text.charAt(index - 1)) && !FILENAME_CHARACTER.test(text.charAt(end))) {
        candidates.push(trimCandidate(text, index, end));
      }
    }
  }
  return candidates;
}

/** Trims quotes, brackets, and trailing punctuation from `text[start, end)`. */
function trimCandidate(text: string, start: number, end: number): CandidateMention {
  const original = text.slice(start, end);
  const leading = TRIM_LEADING.exec(original)?.[0].length ?? 0;
  const withoutLeading = original.slice(leading);
  const trailing = TRIM_TRAILING.exec(withoutLeading)?.[0].length ?? 0;
  const mention = withoutLeading.slice(0, withoutLeading.length - trailing);
  const offset = start + leading;
  return { mention, offset, endOffset: offset + mention.length };
}

function normalizeCandidate(mention: string): NormalizedCandidate | undefined {
  const raw = mention.trim();
  if (!raw || raw.length > MAX_CANDIDATE_LENGTH) return undefined;
  const { pathText, referencedLine, referencedColumn } = stripLineColumnSuffix(raw);
  let value = pathText.trim();
  if (!value) return undefined;

  const isFileUrl = /^file:\/\//i.test(value);
  if (isFileUrl) {
    try {
      value = fileURLToPath(value);
    } catch {
      return undefined;
    }
  }
  value = decodeUriIfPossible(value);
  const posixValue = toPosixPath(value);
  const isAbsolute = path.isAbsolute(value) || /^[A-Za-z]:\//.test(posixValue);
  const kind: PathMentionKind = isFileUrl
    ? 'file-url'
    : isAbsolute
      ? 'absolute-path'
      : posixValue.includes('/')
        ? 'relative-path'
        : 'basename';
  const normalizedCandidate =
    kind === 'absolute-path' || kind === 'file-url'
      ? toPosixPath(path.resolve(value))
      : normalizeRepoPath(path.posix.normalize(posixValue));
  if (!normalizedCandidate || normalizedCandidate === '.') return undefined;
  if (kind === 'basename' && !looksLikeFilename(normalizedCandidate)) return undefined;
  return { candidate: value, normalizedCandidate, kind, referencedLine, referencedColumn };
}

function stripLineColumnSuffix(raw: string): {
  pathText: string;
  referencedLine: number | null;
  referencedColumn: number | null;
} {
  const hashMatch = /^(.*?)(?:#L(\d+)(?:-L?\d+)?)$/i.exec(raw);
  if (hashMatch?.[1] && hashMatch[2]) {
    return { pathText: hashMatch[1], referencedLine: Number(hashMatch[2]), referencedColumn: null };
  }
  const colonMatch = /^(.*?)(?::(\d+)(?::(\d+))?)$/.exec(raw);
  if (colonMatch?.[1] && colonMatch[2] && !/^[A-Za-z]$/.test(colonMatch[1])) {
    return {
      pathText: colonMatch[1],
      referencedLine: Number(colonMatch[2]),
      referencedColumn: colonMatch[3] ? Number(colonMatch[3]) : null,
    };
  }
  return { pathText: raw, referencedLine: null, referencedColumn: null };
}

function looksLikeFilename(value: string): boolean {
  const base = path.posix.basename(value);
  if (base.includes('.') && !base.startsWith('.') && /\.[A-Za-z0-9][A-Za-z0-9._-]{0,16}$/.test(base)) return true;
  if (base.startsWith('.') && base.length > 1 && /\.[A-Za-z0-9._-]+$/.test(base)) return true;
  return EXTENSIONLESS_FILENAMES.has(base.toLowerCase());
}

function textRange(lines: LineIndex, candidate: CandidateMention, sourceIndex: number | null): PathMentionTextRange {
  const start = lines.locate(candidate.offset);
  const end = lines.locate(candidate.endOffset);
  return {
    offset: candidate.offset,
    endOffset: candidate.endOffset,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
    sourceIndex,
  };
}

/** The other files sharing an ambiguous basename, or `null` when there are none. */
function otherPaths(alternatives: readonly string[] | null, repoPath: string): string[] | null {
  const others = alternatives?.filter((alternative) => alternative !== repoPath) ?? [];
  return others.length > 0 ? others : null;
}

function decodeUriIfPossible(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
