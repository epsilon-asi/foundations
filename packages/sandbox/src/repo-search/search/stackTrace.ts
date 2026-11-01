import * as fs from 'node:fs';
import * as path from 'node:path';
import { omitUndefined } from '../../shared/objects.js';
import type { SearchDocumentStore } from '../core/searchDocumentStore.js';
import { openFile } from '../core/files.js';
import type { RepoStackTraceFrame, StackTraceSearchOptions, StackTraceSearchResult } from '../types.js';
import { isInsideRoot, relativePath } from '../utils/path.js';

/** Frame shapes, most specific first: V8 `at fn (file:line:col)`, Python `File "x", line n`, `file:line[:col]`. */
const FRAME_PATTERNS = [
  /(?:at\s+[^()]+\()?([^()\s]+):(\d+):(\d+)\)?/g,
  /^\s*File\s+"([^"]+)",\s+line\s+(\d+)/gm,
  /([^\s:()]+):(\d+):(\d+)/g,
  /([^\s:()]+):(\d+)/g,
];

const STACK_TRACE_DEFAULTS = { contextLines: 3, maxFrames: 25 } as const;

/** Extracts frames inside `root` from a stack trace and opens the source around each existing frame. */
export async function searchStackTrace(
  root: string,
  store: SearchDocumentStore,
  trace: string,
  options: StackTraceSearchOptions = {},
): Promise<StackTraceSearchResult> {
  const frames = extractStackTraceFrames(root, trace).slice(0, options.maxFrames ?? STACK_TRACE_DEFAULTS.maxFrames);
  const openings = await Promise.allSettled(
    frames
      .filter((frame) => frame.exists)
      .map((frame) =>
        openFile(root, store, frame.path, {
          line: frame.line,
          endLine: frame.line,
          contextBefore: options.contextBefore ?? STACK_TRACE_DEFAULTS.contextLines,
          contextAfter: options.contextAfter ?? STACK_TRACE_DEFAULTS.contextLines,
        }),
      ),
  );
  // Frames that cannot be opened (binary, unreadable) keep their metadata but contribute no source.
  const opened = openings.flatMap((opening) => (opening.status === 'fulfilled' ? [opening.value] : []));
  return { frames, opened };
}

/**
 * Parses JavaScript, Python, and generic `path:line[:column]` frames whose files resolve inside `root`.
 * Text matched by a more specific pattern is not matched again by a looser one (so `a.ts:1:2` is one frame).
 */
export function extractStackTraceFrames(root: string, trace: string): RepoStackTraceFrame[] {
  const frames: RepoStackTraceFrame[] = [];
  const seen = new Set<string>();
  const claimed: (readonly [number, number])[] = [];
  for (const pattern of FRAME_PATTERNS) {
    for (const match of trace.matchAll(pattern)) {
      const [raw, rawPath, lineText, columnText] = match;
      const start = match.index;
      const end = start + raw.length;
      if (claimed.some(([claimedStart, claimedEnd]) => start < claimedEnd && end > claimedStart)) continue;
      claimed.push([start, end]);
      if (!rawPath || !lineText) continue;
      const absolutePath = path.resolve(root, rawPath);
      if (!isInsideRoot(root, absolutePath)) continue;
      const repoPath = relativePath(root, absolutePath);
      const line = Number(lineText);
      const column = columnText ? Number(columnText) : undefined;
      const key = `${repoPath}:${line}:${column ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      frames.push({
        raw,
        path: repoPath,
        absolutePath,
        line,
        ...omitUndefined({ column }),
        exists: fs.existsSync(absolutePath),
      });
    }
  }
  return frames;
}
