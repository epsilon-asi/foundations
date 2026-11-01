import { normalizeRepoPath } from '../utils/path.js';

const TOKEN_RE = /[\p{L}\p{N}_$@#.-]+/gu;
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'for',
  'on',
  'with',
  'is',
  'are',
  'be',
  'this',
  'that',
  'it',
  'as',
  'by',
  'from',
  'at',
  'if',
  'else',
  'return',
  'true',
  'false',
  'null',
  'undefined',
]);

export interface TokenizeOptions {
  keepStopwords?: boolean;
  minLength?: number;
}

/** Lower-cased word tokens, with identifiers split on case changes and separators. */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const minLength = options.minLength ?? 1;
  const tokens: string[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    for (const part of splitIdentifier(match[0])) {
      const token = part.toLowerCase();
      if (token.length < minLength) continue;
      if (!options.keepStopwords && STOPWORDS.has(token)) continue;
      tokens.push(token);
    }
  }
  return tokens;
}

export function tokenizePath(repoPath: string): string[] {
  return tokenize(normalizeRepoPath(repoPath).replace(/[/.\\_-]+/g, ' '), { keepStopwords: true });
}

/** Splits `camelCase`, `PascalCase`, `snake_case`, `kebab-case`, and dotted identifiers into words. */
export function splitIdentifier(raw: string): string[] {
  return raw
    .replace(/[.$@#]+/g, ' ')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
}

export function termFrequency(tokens: readonly string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  return frequencies;
}
