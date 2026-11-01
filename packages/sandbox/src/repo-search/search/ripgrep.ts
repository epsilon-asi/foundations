import * as path from 'node:path';
import { z } from 'zod';
import {
  ChildProcessCommandExecutor,
  CommandExecutionError,
  commandExists,
  ensureSuccess,
  isSuccessfulResult,
  type CommandExecutionResult,
  type CommandExecutor,
} from '../../shared/index.js';
import type {
  BaseSearchOptions,
  RegexSearchOptions,
  SearchBackend,
  SearchResult,
  TextSearchOptions,
} from '../types.js';
import type { PathPredicate } from '../utils/pathFilter.js';
import { languageForPath, normalizeRepoPath } from '../utils/path.js';
import { LineIndex, splitLines, type LineColumn } from '../utils/text.js';
import { DEFAULT_CONTEXT_LINES, DEFAULT_MAX_RESULTS, MATCH_SCORES } from './defaults.js';
import { createResult, spanToMatch } from './results.js';

const RIPGREP_COMMAND = 'rg';
const RIPGREP_PROBE_TIMEOUT_MS = 5_000;
const RIPGREP_TIMEOUT_MS = 30_000;
const RIPGREP_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
/** ripgrep exits with 0 when something matched and 1 when nothing did; anything else is an error. */
const RIPGREP_OK_EXIT_CODES: ReadonlySet<number | null> = new Set([0, 1]);

/** ripgrep `--json` encodes text as UTF-8 `text`, or base64 `bytes` when it is not valid UTF-8. */
const RgDataSchema = z.union([z.object({ text: z.string() }), z.object({ bytes: z.string() })]);

/** The `match` and `context` events of ripgrep's JSON Lines output (other event types are ignored). */
const RgLineEventSchema = z.object({
  type: z.enum(['match', 'context']),
  data: z.object({
    path: RgDataSchema,
    lines: RgDataSchema,
    line_number: z.number().int().positive(),
    submatches: z.array(
      z.object({
        match: RgDataSchema.optional(),
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      }),
    ),
  }),
});

type RgData = z.infer<typeof RgDataSchema>;
type RgLineEvent = z.infer<typeof RgLineEventSchema>;

/**
 * Whether ripgrep can run. Without an executor this is a `PATH` lookup for `rg` (no process is spawned). With an
 * executor — which may run commands elsewhere, such as in a container — it runs `rg --version` through it: available
 * when that exits with 0, unavailable when it fails, times out, or cannot be spawned (`CommandExecutionError`).
 * Not cached; `LocalRepoSearch` checks once per instance.
 */
export async function ripgrepAvailable(executor?: CommandExecutor): Promise<boolean> {
  if (!executor) return commandExists(RIPGREP_COMMAND);
  try {
    const probe = await executor.run(RIPGREP_COMMAND, ['--version'], { timeoutMs: RIPGREP_PROBE_TIMEOUT_MS });
    return isSuccessfulResult(probe);
  } catch (error) {
    if (error instanceof CommandExecutionError) return false;
    throw error;
  }
}

/** Whether `rg` should be tried for a request: the per-call backend wins over the configured one. */
export function shouldUseRipgrep(configured: SearchBackend | undefined, requested: SearchBackend | undefined): boolean {
  return (requested ?? configured ?? 'auto') !== 'node';
}

/** How to run one ripgrep search. */
export interface RipgrepContext {
  /** Runs `rg`. Default: a `ChildProcessCommandExecutor`. */
  executor?: CommandExecutor;
  /** Restricts results to these repository paths (for example, the files the index contains). */
  acceptPath?: PathPredicate;
}

/**
 * Literal search with `rg -F`. Rejects with `CommandFailedError` when ripgrep exits with an error, is killed, or
 * times out, and with `CommandExecutionError` when it cannot be spawned or exceeds the output limit.
 */
export function searchTextWithRipgrep(
  root: string,
  query: string,
  options: TextSearchOptions = {},
  context: RipgrepContext = {},
): Promise<SearchResult[]> {
  const args = [...baseArgs(options), '-F'];
  if (options.caseSensitive !== true) args.push('-i');
  if (options.wholeWord) args.push('-w');
  return runRipgrep(root, [...args, '--', query, '.'], 'text', options, context);
}

/** Regular-expression search with ripgrep's regex dialect; fails like `searchTextWithRipgrep`. */
export function searchRegexWithRipgrep(
  root: string,
  pattern: string,
  options: RegexSearchOptions = {},
  context: RipgrepContext = {},
): Promise<SearchResult[]> {
  const args = baseArgs(options);
  if (options.flags?.includes('i')) args.push('-i');
  if (options.multiline || options.flags?.includes('s')) args.push('-U', '--multiline', '--multiline-dotall');
  return runRipgrep(root, [...args, '--', pattern, '.'], 'regex', options, context);
}

function baseArgs(options: BaseSearchOptions): string[] {
  return [
    '--json',
    '--line-number',
    '--column',
    '--with-filename',
    '--color',
    'never',
    '--hidden',
    '-B',
    String(options.contextBefore ?? DEFAULT_CONTEXT_LINES),
    '-A',
    String(options.contextAfter ?? DEFAULT_CONTEXT_LINES),
    ...(options.include ?? []).flatMap((glob) => ['-g', glob]),
    ...(options.exclude ?? []).flatMap((glob) => ['-g', `!${glob}`]),
    ...(options.paths ?? []).flatMap((repoPath) => ['-g', normalizeRepoPath(repoPath)]),
  ];
}

async function runRipgrep(
  root: string,
  args: string[],
  method: 'text' | 'regex',
  options: BaseSearchOptions,
  context: RipgrepContext,
): Promise<SearchResult[]> {
  const executor = context.executor ?? new ChildProcessCommandExecutor();
  const result = ensureRipgrepSuccess(
    await executor.run(RIPGREP_COMMAND, args, {
      cwd: root,
      timeoutMs: RIPGREP_TIMEOUT_MS,
      maxOutputBytes: RIPGREP_MAX_OUTPUT_BYTES,
    }),
  );
  const collector = new RipgrepResultCollector(root, method, {
    maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS[method],
    before: options.contextBefore ?? DEFAULT_CONTEXT_LINES,
    after: options.contextAfter ?? DEFAULT_CONTEXT_LINES,
    acceptPath: context.acceptPath ?? (() => true),
  });
  for (const line of splitLines(result.stdout)) {
    const event = parseEvent(line);
    if (event && collector.add(event)) break;
  }
  return collector.results;
}

/** Exit codes 0 (matches) and 1 (no matches) succeed; anything else, a signal, or a timeout is a `CommandFailedError`. */
function ensureRipgrepSuccess(result: CommandExecutionResult): CommandExecutionResult {
  if (!result.timedOut && RIPGREP_OK_EXIT_CODES.has(result.exitCode)) return result;
  return ensureSuccess(result, 'ripgrep search failed');
}

function parseEvent(line: string): RgLineEvent | undefined {
  if (!line) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return undefined;
  }
  const parsed = RgLineEventSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

interface CollectorLimits {
  maxResults: number;
  before: number;
  after: number;
  acceptPath: PathPredicate;
}

/**
 * Turns the per-file stream of match/context events into results. Lines seen so far in the current file feed
 * `contextBefore` of later matches; later lines feed `contextAfter` of earlier matches. Match lines count as
 * context for neighbouring matches, as in the Node backend.
 */
class RipgrepResultCollector {
  readonly results: SearchResult[] = [];
  private currentPath: string | undefined;
  private recentLines = new Map<number, string>();
  private awaitingContext: SearchResult[] = [];
  private readonly root: string;
  private readonly method: 'text' | 'regex';
  private readonly limits: CollectorLimits;

  constructor(root: string, method: 'text' | 'regex', limits: CollectorLimits) {
    this.root = root;
    this.method = method;
    this.limits = limits;
  }

  /** Consumes one event; returns true once no later event can change the results. */
  add(event: RgLineEvent): boolean {
    const repoPath = normalizeRepoPath(decode(event.data.path));
    if (!this.limits.acceptPath(repoPath)) return false;
    if (repoPath !== this.currentPath) {
      this.currentPath = repoPath;
      this.recentLines = new Map();
      this.awaitingContext = [];
    }

    const text = decode(event.data.lines).replace(/\r?\n$/, '');
    const firstLine = event.data.line_number;
    const lines = splitLines(text);
    const lastLine = firstLine + lines.length - 1;
    lines.forEach((lineText, offset) => {
      this.appendContextAfter(firstLine + offset, lineText);
    });

    if (event.type === 'match' && this.results.length < this.limits.maxResults) {
      const result = this.toResult(repoPath, event, text, firstLine, lastLine);
      this.results.push(result);
      if (this.limits.after > 0) this.awaitingContext.push(result);
    }
    lines.forEach((lineText, offset) => this.recentLines.set(firstLine + offset, lineText));
    for (const lineNumber of this.recentLines.keys()) {
      if (lineNumber <= lastLine - this.limits.before) this.recentLines.delete(lineNumber);
    }
    return this.results.length >= this.limits.maxResults && this.awaitingContext.length === 0;
  }

  private appendContextAfter(lineNumber: number, lineText: string): void {
    const { after } = this.limits;
    for (const result of this.awaitingContext) {
      if (lineNumber === result.endLine + result.contextAfter.length + 1 && result.contextAfter.length < after) {
        result.contextAfter.push(lineText);
      }
    }
    this.awaitingContext = this.awaitingContext.filter(
      (result) => result.contextAfter.length < after && result.endLine + after > lineNumber,
    );
  }

  private toResult(
    repoPath: string,
    event: RgLineEvent,
    text: string,
    firstLine: number,
    lastLine: number,
  ): SearchResult {
    const { before } = this.limits;
    const contextBefore: string[] = [];
    for (let lineNumber = firstLine - before; lineNumber < firstLine; lineNumber += 1) {
      const lineText = this.recentLines.get(lineNumber);
      if (lineText !== undefined) contextBefore.push(lineText);
    }

    const positions = new LineIndex(text);
    const toCharIndex = byteToCharIndex(text);
    const toPosition = (charIndex: number): LineColumn => {
      const { line, column } = positions.locate(charIndex);
      return { line: firstLine + line - 1, column };
    };
    const matches = event.data.submatches.map((submatch) => {
      const startIndex = toCharIndex(submatch.start);
      const endIndex = toCharIndex(submatch.end);
      return spanToMatch({
        start: toPosition(startIndex),
        end: toPosition(endIndex),
        text: submatch.match ? decode(submatch.match) : text.slice(startIndex, endIndex),
      });
    });
    const first = matches[0];

    return createResult({
      method: this.method,
      source: { path: repoPath, absolutePath: path.resolve(this.root, repoPath), language: languageForPath(repoPath) },
      score: MATCH_SCORES[this.method],
      line: firstLine,
      endLine: lastLine,
      column: first?.column,
      endColumn: first?.endColumn,
      excerpt: { preview: text, contextBefore, contextAfter: [] },
      matches,
      metadata: { backend: 'ripgrep' },
    });
  }
}

function decode(data: RgData): string {
  return 'text' in data ? data.text : Buffer.from(data.bytes, 'base64').toString('utf8');
}

/** ripgrep reports submatch offsets in UTF-8 bytes; results use UTF-16 columns like the Node backend. */
function byteToCharIndex(text: string): (byteOffset: number) => number {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length === text.length) return (byteOffset) => byteOffset;
  return (byteOffset) => bytes.subarray(0, byteOffset).toString('utf8').length;
}
