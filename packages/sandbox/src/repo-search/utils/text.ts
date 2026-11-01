const WORD_CHARACTER = /[A-Za-z0-9_$]/;
const LINE_BREAK = /\r\n|\n|\r/g;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits on `\r\n`, `\n`, or `\r`, the same line breaks `LineIndex` recognizes. */
export function splitLines(text: string): string[] {
  return text.split(LINE_BREAK);
}

export function isWordBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return true;
  return !WORD_CHARACTER.test(text[index] ?? '');
}

export function normalizeForSearch(text: string, caseSensitive = false): string {
  return caseSensitive ? text : text.toLowerCase();
}

/** 1-based line/column position. */
export interface LineColumn {
  line: number;
  column: number;
}

/** Precomputed line starts for a text, so offset → line/column lookups are a binary search instead of a scan. */
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(text: string) {
    for (const lineBreak of text.matchAll(LINE_BREAK)) this.starts.push(lineBreak.index + lineBreak[0].length);
  }

  /** Converts a zero-based UTF-16 offset to a 1-based line and column. */
  locate(offset: number): LineColumn {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((this.starts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - (this.starts[low] ?? 0) + 1 };
  }
}

/** A preview of a line range plus surrounding context lines. */
export interface LineExcerpt {
  preview: string;
  contextBefore: string[];
  contextAfter: string[];
}

/** Excerpt of lines `line..endLine` (1-based, inclusive) with up to `before`/`after` context lines. */
export function getLineContext(
  lines: readonly string[],
  line: number,
  endLine: number,
  before = 0,
  after = 0,
): LineExcerpt {
  const startIndex = Math.max(0, line - 1);
  const endIndex = Math.min(lines.length, Math.max(endLine, line));
  return {
    preview: lines.slice(startIndex, endIndex).join('\n'),
    contextBefore: lines.slice(Math.max(0, startIndex - before), startIndex),
    contextAfter: lines.slice(endIndex, Math.min(lines.length, endIndex + after)),
  };
}

export function numberLines(lines: readonly string[], startLine: number): string {
  const width = String(startLine + lines.length).length;
  return lines.map((line, index) => `${String(startLine + index).padStart(width, ' ')} | ${line}`).join('\n');
}

/** Collapses whitespace and truncates to `maxLength` characters with an ellipsis. */
export function makeSnippet(text: string, maxLength = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
