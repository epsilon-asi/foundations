export interface Run {
  text: string;
  color?: number;
}
export interface LogLine {
  id: number;
  runs: Run[];
}
type Mode = 'text' | 'escape' | 'csi' | 'string' | 'stringEscape' | 'intermediate';
interface Cursor {
  mode: Mode;
  params: string;
  color?: number;
}
export interface LogState {
  lines: LogLine[];
  cursor: Cursor;
  hidden: number;
}
export function emptyLog(): LogState {
  return { lines: [{ id: 0, runs: [] }], cursor: { mode: 'text', params: '' }, hidden: 0 };
}
function sgr(cursor: Cursor) {
  const codes = cursor.params.split(';').map(Number);
  for (let i = 0; i < codes.length; i++) {
    const n = codes[i];
    if (n === 0 || n === 39) cursor.color = undefined;
    else if (n >= 30 && n <= 37) cursor.color = n - 30;
    else if (n >= 90 && n <= 97) cursor.color = n - 90 + 8;
    else if (n === 38 || n === 48) {
      const mode = codes[++i];
      i += mode === 5 ? 1 : mode === 2 ? 3 : 0;
    }
  }
}
/** Carry the decoder and unfinished line across chunks, even in the middle of a control string. */
export function appendLog(previous: LogState, parts: readonly string[], ansi: boolean, limit: number): LogState {
  const lines = previous.lines.slice(),
    cursor = { ...previous.cursor };
  let line = { ...lines.pop()! };
  line.runs = line.runs.slice();
  let buffer = '';
  function flush() {
    if (!buffer) return;
    const last = line.runs.at(-1);
    if (last && last.color === cursor.color)
      line.runs[line.runs.length - 1] = { ...last, text: last.text + buffer };
    else line.runs.push({ text: buffer, color: cursor.color });
    buffer = '';
  }
  for (const part of parts)
    for (const ch of part) {
      const code = ch.charCodeAt(0);
      if (cursor.mode === 'stringEscape') {
        cursor.mode = ch === '\\' ? 'text' : 'string';
        continue;
      }
      if (cursor.mode === 'string') {
        if (ch === '\x1b') cursor.mode = 'stringEscape';
        else if (ch === '\x07' || code === 0x9c) cursor.mode = 'text';
        continue;
      }
      if (cursor.mode === 'csi') {
        if (code >= 0x40 && code <= 0x7e) {
          if (ch === 'm' && ansi) sgr(cursor);
          cursor.mode = 'text';
        } else if (cursor.params.length < 100) cursor.params += ch;
        continue;
      }
      if (cursor.mode === 'escape') {
        cursor.mode =
          ch === '['
            ? 'csi'
            : ']P^_X'.includes(ch)
              ? 'string'
              : code >= 0x20 && code <= 0x2f
                ? 'intermediate'
                : 'text';
        cursor.params = '';
        continue;
      }
      if (cursor.mode === 'intermediate') {
        if (code >= 0x30 && code <= 0x7e) cursor.mode = 'text';
        continue;
      }
      if (ch === '\x1b' || code === 0x9b || [0x90, 0x98, 0x9d, 0x9e, 0x9f].includes(code)) {
        flush();
        cursor.params = '';
        cursor.mode = ch === '\x1b' ? 'escape' : code === 0x9b ? 'csi' : 'string';
        continue;
      }
      if (ch === '\n') {
        flush();
        lines.push(line);
        line = { id: line.id + 1, runs: [] };
      } else if (ch === '\t' || (code >= 32 && !(code >= 127 && code <= 159))) buffer += ch;
    }
  flush();
  lines.push(line);
  const drop = Math.max(0, lines.length - limit);
  return { lines: drop ? lines.slice(drop) : lines, hidden: previous.hidden + drop, cursor };
}
