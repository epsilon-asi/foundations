import * as fs from 'node:fs/promises';
import { RepoSearchError } from '../errors.js';
import type { RepoFileEntry, OpenRepoFileOptions, OpenRepoFileResult, SearchDocument } from '../types.js';
import { mapConcurrent } from '../utils/async.js';
import { relativePath, resolveInsideRoot } from '../utils/path.js';
import { clamp, numberLines, splitLines } from '../utils/text.js';
import type { SearchDocumentStore } from './searchDocumentStore.js';

const BINARY_SNIFF_BYTES = 8192;
/** Strips a leading byte-order mark (the default for `TextDecoder`). */
const UTF8 = new TextDecoder('utf-8');

/** Heuristic binary detection: any NUL byte, or more than 25% control characters in the first 8 KiB. */
export function isProbablyBinary(bytes: Uint8Array): boolean {
  const length = Math.min(bytes.length, BINARY_SNIFF_BYTES);
  if (length === 0) return false;
  let suspicious = 0;
  for (const value of bytes.subarray(0, length)) {
    if (value === 0) return true;
    if (value < 7 || (value > 14 && value < 32)) suspicious += 1;
  }
  return suspicious / length > 0.25;
}

/** Decodes UTF-8 bytes, dropping a leading byte-order mark. */
export function decodeBuffer(bytes: Uint8Array): string {
  return UTF8.decode(bytes);
}

/** Reads a file as text, or returns `undefined` when it looks binary. */
export async function readTextFile(absolutePath: string): Promise<string | undefined> {
  const bytes = await fs.readFile(absolutePath);
  return isProbablyBinary(bytes) ? undefined : decodeBuffer(bytes);
}

/**
 * Loads text documents for `files` (at most `concurrency` reads in flight), skipping binary and unreadable
 * files. Document ids are assigned in input order.
 */
export async function loadDocuments(files: readonly RepoFileEntry[], concurrency: number): Promise<SearchDocument[]> {
  const texts = await mapConcurrent(files, concurrency, (file) =>
    readTextFile(file.absolutePath).catch(() => undefined),
  );
  const documents: SearchDocument[] = [];
  files.forEach((file, index) => {
    const text = texts[index];
    if (text === undefined) return;
    documents.push({
      id: documents.length,
      path: file.path,
      absolutePath: file.absolutePath,
      language: file.language,
      text,
      lines: splitLines(text),
      size: file.size,
      mtimeMs: file.mtimeMs,
    });
  });
  return documents;
}

/**
 * Opens a line range of a file inside `root` (given repository-relative or absolute), preferring indexed
 * content and falling back to disk for files that are not indexed.
 */
export async function openFile(
  root: string,
  store: SearchDocumentStore,
  target: string,
  options: OpenRepoFileOptions = {},
): Promise<OpenRepoFileResult> {
  const absolutePath = resolveInsideRoot(root, target);
  const repoPath = relativePath(root, absolutePath);
  const lines = store.get(repoPath)?.lines ?? (await readLines(absolutePath, repoPath));

  const requestedLine = options.line ?? 1;
  const requestedEndLine = options.endLine ?? requestedLine;
  const start = clamp(requestedLine - (options.contextBefore ?? 0), 1, Math.max(1, lines.length));
  const end = clamp(requestedEndLine + (options.contextAfter ?? 0), start, Math.max(start, lines.length));
  const slice = lines.slice(start - 1, end);
  return {
    path: repoPath,
    absolutePath,
    line: start,
    endLine: end,
    totalLines: lines.length,
    text: slice.join('\n'),
    numberedText: numberLines(slice, start),
  };
}

async function readLines(absolutePath: string, repoPath: string): Promise<string[]> {
  const text = await readTextFile(absolutePath);
  if (text === undefined) throw new RepoSearchError(`Cannot open binary file as text: ${repoPath}`);
  return splitLines(text);
}
