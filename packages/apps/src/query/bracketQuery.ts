import { z } from 'zod/v4';
import { reservedQueryFields } from './queryFieldNames.js';

export interface BracketQuery {
  readonly [field: string]: string | null | undefined | BracketQuery;
}

type QueryTree = { [field: string]: string | null | QueryTree };

// Offset lists currently accept scalar parameters, orderBy[field] and where[field][operator].
const maxSegments = 3;
const segmentPattern = /^[^\[\]]+$/u;

function validSegment(key: string) {
  return segmentPattern.test(key) && !reservedQueryFields.has(key);
}

/** Serializes an encoded query in insertion order. A bare key represents null and key= an empty string. */
export function encodeBracketQuery(query: BracketQuery): string {
  const pairs: string[] = [];
  function append(fields: object, parent: string, depth: number) {
    for (const [key, value] of Object.entries(fields)) {
      if (!validSegment(key) || depth > maxSegments) throw new TypeError('Invalid query field.');
      const path = parent ? parent + '[' + key + ']' : key;
      if (value === undefined) continue;
      if (value === null || typeof value === 'string') {
        const pair = new URLSearchParams([[path, value ?? '']]).toString();
        pairs.push(value === null ? pair.slice(0, -1) : pair);
      } else if (z.core.util.isPlainObject(value)) {
        append(value, path, depth + 1);
      } else {
        throw new TypeError('Expected an encoded scalar query field.');
      }
    }
  }
  append(query, '', 1);
  return pairs.join('&');
}

/** Reconstructs own fields only, rejecting malformed paths, duplicates and scalar/object conflicts. */
export function decodeBracketQuery(search: string): QueryTree {
  const root: QueryTree = Object.create(null);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [key, value] = new URLSearchParams('?' + pair).entries().next().value!;
    const segments = key.match(/[^\[\]]+/gu) ?? [];
    const [first, ...rest] = segments;
    if (!first || segments.length > maxSegments || first + rest.map(part => '[' + part + ']').join('') !== key ||
        !segments.every(validSegment)) {
      throw new z.ZodError([{ code: 'custom', path: ['query', key], message: 'Invalid query field.' }]);
    }
    let current = root;
    for (const [index, segment] of segments.entries()) {
      const previous = current[segment];
      const last = index === segments.length - 1;
      if (previous !== undefined && (last || previous === null || typeof previous === 'string')) {
        throw new z.ZodError([{ code: 'custom', path: ['query', ...segments], message: 'Conflicting query fields.' }]);
      }
      if (last) current[segment] = pair.includes('=') ? value : null;
      else current = current[segment] ??= Object.create(null);
    }
  }
  return root;
}
