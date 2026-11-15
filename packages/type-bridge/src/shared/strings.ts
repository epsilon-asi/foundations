/** String literal printing and docstring/JSDoc text handling shared by both languages. */

export type QuoteStyle = 'single' | 'double';

// Control characters are exactly what this matches.
// eslint-disable-next-line no-control-regex
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]', 'g');

function escapeControl(ch: string): string {
  switch (ch) {
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '\t':
      return '\\t';
    case '\b':
      return '\\b';
    case '\f':
      return '\\f';
    case '\v':
      return '\\v';
    case '\0':
      return '\\0';
    default:
      return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
  }
}

/** A TypeScript string literal. */
export function tsString(value: string, quote: QuoteStyle = 'single'): string {
  const q = quote === 'single' ? "'" : '"';
  const body = value
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(q, 'g'), `\\${q}`)
    .replace(CONTROL, (ch) => (ch === '\0' ? '\\x00' : escapeControl(ch)));
  return `${q}${body}${q}`;
}

/**
 * A Python string literal. Double quotes unless the value contains a double quote and no single quote, as
 * `black` formats them.
 */
export function pyString(value: string): string {
  const q = value.includes('"') && !value.includes("'") ? "'" : '"';
  const body = value
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(q, 'g'), `\\${q}`)
    .replace(CONTROL, (ch) => {
      if (ch === '\0') return '\\x00';
      if (ch === '\b' || ch === '\v' || ch === '\f' || ch === '\n' || ch === '\r' || ch === '\t') {
        return escapeControl(ch);
      }
      return `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`;
    });
  return `${q}${body}${q}`;
}

/**
 * Removes common leading indentation, like Python's `inspect.cleandoc`: the first line's indentation is ignored when
 * measuring, leading and trailing blank lines are dropped.
 */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const first = lines[0]!.trim();
  const rest = lines.slice(1);
  const indents = rest.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length);
  const margin = indents.length ? Math.min(...indents) : 0;
  const out = [first, ...rest.map((l) => l.slice(margin).trimEnd())];
  while (out.length && !out[0]!.trim()) out.shift();
  while (out.length && !out[out.length - 1]!.trim()) out.pop();
  return out.join('\n');
}

/** Lines of a JSDoc block. `*\/` inside text is broken up so it cannot end the comment. */
export function jsDocLines(text: string): string[] {
  return text.replace(/\*\//g, '*\\/').split('\n');
}

/** The body of a Python docstring: backslashes and triple quotes escaped. */
export function docstringBody(text: string): string {
  let body = text.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  if (body.endsWith('"')) body = `${body.slice(0, -1)}\\"`;
  return body;
}
