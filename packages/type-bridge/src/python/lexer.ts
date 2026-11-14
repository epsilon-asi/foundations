import { ParseError } from '../diagnostics.js';
import type { SourceLocation } from '../ir/types.js';

export type PyTokenType = 'name' | 'number' | 'string' | 'op' | 'newline' | 'indent' | 'dedent' | 'eof';

export interface PyToken {
  type: PyTokenType;
  /** Source text of the token (for strings, including prefix and quotes). */
  value: string;
  loc: SourceLocation;
  /** Offsets into the source, for slicing expression text. */
  start: number;
  end: number;
  /** Decoded value and prefix of a string literal. */
  string?: { value: string; prefix: string };
}

export interface PyComment {
  line: number;
  text: string;
  /** Nothing but whitespace precedes the comment on its line. */
  ownLine: boolean;
}

export interface PyLexResult {
  tokens: PyToken[];
  comments: PyComment[];
}

const OPERATORS = [
  '**=',
  '//=',
  '>>=',
  '<<=',
  '...',
  '->',
  ':=',
  '**',
  '//',
  '<<',
  '>>',
  '<=',
  '>=',
  '==',
  '!=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '@=',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  ',',
  ':',
  ';',
  '.',
  '+',
  '-',
  '*',
  '/',
  '%',
  '|',
  '&',
  '^',
  '~',
  '<',
  '>',
  '=',
  '@',
  '!',
];

const ID_START = /[\p{L}\p{Nl}_]/u;
const ID_CONTINUE = /[\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]/u;
const STRING_PREFIX = /^(?:[rRuUbBfFtT]|[rR][bBfFtT]|[bBfFtT][rR])$/;

/** Tokenizes Python source the way CPython's tokenizer does, minus the parts types never need. */
export function tokenizePython(source: string): PyLexResult {
  const src = source.replace(/\r\n?/g, '\n');
  const tokens: PyToken[] = [];
  const comments: PyComment[] = [];
  const indents = [0];
  let pos = 0;
  let line = 1;
  let lineStart = 0;
  let depth = 0;
  let atLineStart = true;

  const loc = (offset: number): SourceLocation => ({ line, column: offset - lineStart + 1 });
  const fail = (message: string, offset = pos): never => {
    throw new ParseError({ language: 'python', message, loc: loc(offset), source: src });
  };
  const push = (type: PyTokenType, start: number, end: number, extra?: Partial<PyToken>): void => {
    tokens.push({ type, value: src.slice(start, end), loc: loc(start), start, end, ...extra });
  };
  const newline = (): void => {
    line++;
    lineStart = pos;
  };

  while (pos <= src.length) {
    if (atLineStart && depth === 0) {
      // Measure indentation; skip blank and comment-only lines entirely.
      let col = 0;
      let p = pos;
      while (p < src.length && (src[p] === ' ' || src[p] === '\t' || src[p] === '\f')) {
        col = src[p] === '\t' ? (Math.floor(col / 8) + 1) * 8 : src[p] === '\f' ? 0 : col + 1;
        p++;
      }
      if (p >= src.length) {
        pos = p;
        break;
      }
      if (src[p] === '\n' || src[p] === '#' || (src[p] === '\\' && src[p + 1] === '\n')) {
        if (src[p] === '#') {
          const endOfLine = src.indexOf('\n', p);
          const end = endOfLine === -1 ? src.length : endOfLine;
          comments.push({ line, text: src.slice(p + 1, end), ownLine: true });
          p = end;
        }
        if (src[p] === '\\') p++;
        pos = p + 1;
        newline();
        continue;
      }
      pos = p;
      atLineStart = false;
      const current = indents[indents.length - 1]!;
      if (col > current) {
        indents.push(col);
        push('indent', pos, pos);
      } else {
        while (col < indents[indents.length - 1]!) {
          indents.pop();
          push('dedent', pos, pos);
        }
        if (col !== indents[indents.length - 1]) fail('unindent does not match any outer indentation level');
      }
    }

    if (pos >= src.length) break;
    const ch = src[pos]!;

    if (ch === '\n') {
      if (depth === 0) {
        push('newline', pos, pos + 1);
        atLineStart = true;
      }
      pos++;
      newline();
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\f') {
      pos++;
      continue;
    }
    if (ch === '\\' && src[pos + 1] === '\n') {
      pos += 2;
      newline();
      continue;
    }
    if (ch === '#') {
      const endOfLine = src.indexOf('\n', pos);
      const end = endOfLine === -1 ? src.length : endOfLine;
      comments.push({ line, text: src.slice(pos + 1, end), ownLine: false });
      pos = end;
      continue;
    }

    // Names, and string literals with a prefix.
    if (ID_START.test(ch)) {
      const start = pos;
      while (pos < src.length && ID_CONTINUE.test(src[pos]!)) pos++;
      const word = src.slice(start, pos);
      if ((src[pos] === '"' || src[pos] === "'") && STRING_PREFIX.test(word)) {
        readString(start, word);
        continue;
      }
      push('name', start, pos);
      continue;
    }

    if (ch === '"' || ch === "'") {
      readString(pos, '');
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[pos + 1] ?? ''))) {
      const start = pos;
      const match =
        /^(?:0[xX](?:_?[0-9a-fA-F])+|0[oO](?:_?[0-7])+|0[bB](?:_?[01])+|(?:(?:[0-9](?:_?[0-9])*)?\.[0-9](?:_?[0-9])*|[0-9](?:_?[0-9])*\.?)(?:[eE][+-]?[0-9](?:_?[0-9])*)?[jJ]?)/.exec(
          src.slice(pos),
        );
      pos += match![0].length;
      push('number', start, pos);
      continue;
    }

    const op = OPERATORS.find((o) => src.startsWith(o, pos));
    if (!op) fail(`unexpected character ${JSON.stringify(ch)}`);
    if (op === '(' || op === '[' || op === '{') depth++;
    if (op === ')' || op === ']' || op === '}') depth = Math.max(0, depth - 1);
    push('op', pos, pos + op!.length);
    pos += op!.length;
  }

  if (tokens.length && tokens[tokens.length - 1]!.type !== 'newline') push('newline', src.length, src.length);
  while (indents.length > 1) {
    indents.pop();
    push('dedent', src.length, src.length);
  }
  push('eof', src.length, src.length);
  return { tokens, comments };

  function readString(start: number, prefix: string): void {
    const startLoc = loc(start);
    let p = start + prefix.length;
    const quote = src[p]!;
    const triple = src.startsWith(quote.repeat(3), p);
    const delimiter = triple ? quote.repeat(3) : quote;
    p += delimiter.length;
    const bodyStart = p;
    const raw = /[rR]/.test(prefix);
    const formatted = /[fFtT]/.test(prefix);
    let braces = 0;

    for (;;) {
      if (p >= src.length) {
        throw new ParseError({
          language: 'python',
          message: 'unterminated string literal',
          loc: startLoc,
          source: src,
        });
      }
      const c = src[p]!;
      if (c === '\\') {
        if (src[p + 1] === '\n') {
          line++;
          lineStart = p + 2;
        }
        p += 2;
        continue;
      }
      if (c === '\n') {
        if (!triple && braces === 0) {
          throw new ParseError({
            language: 'python',
            message: 'unterminated string literal',
            loc: startLoc,
            source: src,
          });
        }
        p++;
        line++;
        lineStart = p;
        continue;
      }
      if (formatted) {
        if ((c === '{' || c === '}') && src[p + 1] === c && braces === 0) {
          p += 2;
          continue;
        }
        if (c === '{') {
          braces++;
          p++;
          continue;
        }
        if (c === '}' && braces > 0) {
          braces--;
          p++;
          continue;
        }
        // Since 3.12 an f-string replacement field may contain strings with the same quotes.
        if (braces > 0 && (c === '"' || c === "'")) {
          p = skipNestedString(p);
          continue;
        }
      }
      if (src.startsWith(delimiter, p) && braces === 0) break;
      p++;
    }

    const body = src.slice(bodyStart, p);
    p += delimiter.length;
    const value = raw ? body : decodeEscapes(body, /[bB]/.test(prefix));
    tokens.push({
      type: 'string',
      value: src.slice(start, p),
      loc: startLoc,
      start,
      end: p,
      string: { value, prefix: prefix.toLowerCase() },
    });
    pos = p;
  }

  function skipNestedString(p: number): number {
    const quote = src[p]!;
    const triple = src.startsWith(quote.repeat(3), p);
    const delimiter = triple ? quote.repeat(3) : quote;
    p += delimiter.length;
    while (p < src.length && !src.startsWith(delimiter, p)) {
      if (src[p] === '\\') p++;
      else if (src[p] === '\n') {
        line++;
        lineStart = p + 1;
      }
      p++;
    }
    return p + delimiter.length;
  }
}

const SIMPLE_ESCAPES: Record<string, string> = {
  '\n': '',
  '\\': '\\',
  "'": "'",
  '"': '"',
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

/** Decodes Python escape sequences. Unknown escapes are kept verbatim, as Python does. */
function decodeEscapes(body: string, bytes: boolean): string {
  return body.replace(
    /\\(?:([\n\\'"abfnrtv])|([0-7]{1,3})|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|N\{([^}]+)\})/g,
    (match, simple: string, octal: string, hex: string, u4: string, u8: string, named: string) => {
      if (simple !== undefined) return SIMPLE_ESCAPES[simple]!;
      if (octal !== undefined) return String.fromCharCode(parseInt(octal, 8));
      if (hex !== undefined) return String.fromCharCode(parseInt(hex, 16));
      if (bytes) return match;
      if (u4 !== undefined) return String.fromCharCode(parseInt(u4, 16));
      if (u8 !== undefined) return String.fromCodePoint(parseInt(u8, 16));
      return named === undefined ? match : match;
    },
  );
}
