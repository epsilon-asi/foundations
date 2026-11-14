import { describe, expect, it } from 'vitest';
import { t, typeKey, unionOf } from '../src/ir/build.js';
import { stableTopologicalSort } from '../src/shared/graph.js';
import { formatPythonModule, formatTsModule, parsePythonModule, parseTsModule } from '../src/shared/modules.js';
import {
  applyCase,
  isPythonIdentifier,
  singularize,
  splitWords,
  toCamelCase,
  toPascalCase,
  toPythonIdentifier,
  toSnakeCase,
  toTsTypeName,
  uniqueName,
} from '../src/shared/naming.js';
import { dedent, docstringBody, jsDocLines, pyString, tsString } from '../src/shared/strings.js';

describe('naming', () => {
  it('splits identifiers into words', () => {
    expect(splitWords('HTTPServerError2')).toEqual(['http', 'server', 'error2']);
    expect(splitWords('user_id')).toEqual(['user', 'id']);
    expect(splitWords('content-type')).toEqual(['content', 'type']);
  });

  it('converts case while keeping leading and trailing underscores', () => {
    expect(toCamelCase('user_id')).toBe('userId');
    expect(toSnakeCase('userId')).toBe('user_id');
    expect(toPascalCase('user_id')).toBe('UserId');
    expect(toSnakeCase('_privateField')).toBe('_private_field');
    expect(toCamelCase('class_')).toBe('class_');
    expect(applyCase('a_b', (n) => n.toUpperCase())).toBe('A_B');
    expect(applyCase('a_b', 'preserve')).toBe('a_b');
    expect(applyCase('a_b', 'PascalCase')).toBe('AB');
  });

  it('makes valid Python identifiers', () => {
    expect(isPythonIdentifier('naïve')).toBe(true);
    expect(isPythonIdentifier('match')).toBe(true); // soft keyword
    expect(toPythonIdentifier('from')).toBe('from_');
    expect(toPythonIdentifier('content-type')).toBe('content_type');
    expect(toPythonIdentifier('$scope')).toBe('_scope');
    expect(toPythonIdentifier('2fa')).toBe('_2fa');
  });

  it('makes valid TypeScript type names', () => {
    expect(toTsTypeName('string')).toBe('string_');
    expect(toTsTypeName('class')).toBe('class_');
    expect(toTsTypeName('User')).toBe('User');
    expect(toTsTypeName('9lives')).toBe('_9lives');
  });

  it('finds unique names and singulars', () => {
    const taken = new Set(['A', 'A2']);
    expect(uniqueName('A', taken)).toBe('A3');
    expect(singularize('UserItems')).toBe('UserItem');
    expect(singularize('Categories')).toBe('Category');
    expect(singularize('Addresses')).toBe('Address');
    expect(singularize('Status')).toBe('Status');
  });
});

describe('strings', () => {
  it('escapes string literals for each language', () => {
    expect(tsString("it's\n")).toBe("'it\\'s\\n'");
    expect(tsString('"q"', 'double')).toBe('"\\"q\\""');
    expect(pyString('plain')).toBe('"plain"');
    expect(pyString('say "hi"')).toBe('\'say "hi"\'');
    expect(pyString('tab\t\u0001')).toBe('"tab\\t\\x01"');
  });

  it('dedents like inspect.cleandoc', () => {
    expect(dedent('Summary.\n\n    Details\n      more\n')).toBe('Summary.\n\nDetails\n  more');
  });

  it('protects comment and docstring delimiters', () => {
    expect(jsDocLines('a */ b')).toEqual(['a *\\/ b']);
    expect(docstringBody('has """ and \\ and "')).toBe('has \\"\\"\\" and \\\\ and \\"');
  });
});

describe('modules', () => {
  it('round-trips specifiers between languages', () => {
    const spec = parsePythonModule('..models.user');
    expect(spec).toEqual({ level: 2, segments: ['models', 'user'] });
    expect(formatTsModule(spec, '.js')).toBe('../models/user.js');
    expect(parseTsModule('../models/user.js')).toEqual(spec);
    expect(formatPythonModule(parseTsModule('./a/../b/index.ts'))).toBe('.b');
    expect(formatTsModule({ level: 1, segments: [] }, '.js')).toBe('./index.js');
    expect(parseTsModule('pkg/sub')).toEqual({ level: 0, segments: ['pkg', 'sub'] });
    expect(formatTsModule({ level: 0, segments: ['pkg'] }, '.js')).toBe('pkg');
  });
});

describe('graph', () => {
  it('orders dependencies first and keeps the original order otherwise', () => {
    const items = ['a', 'b', 'c', 'd'];
    const deps: Record<string, string[]> = { a: ['c'], b: [], c: [], d: ['a', 'missing'] };
    expect(
      stableTopologicalSort(
        items,
        (x) => x,
        (x) => deps[x]!,
      ),
    ).toEqual(['b', 'c', 'a', 'd']);
  });

  it('breaks cycles at the earliest item', () => {
    const deps: Record<string, string[]> = { a: ['b'], b: ['a'] };
    expect(
      stableTopologicalSort(
        ['a', 'b'],
        (x) => x,
        (x) => deps[x]!,
      ),
    ).toEqual(['a', 'b']);
  });
});

describe('IR', () => {
  it('normalizes unions', () => {
    expect(unionOf([t.literal(true), t.literal(false)])).toEqual(t.primitive('boolean'));
    expect(unionOf([t.primitive('string'), t.any()])).toEqual(t.any());
    expect(unionOf([t.never()])).toEqual(t.never());
    expect(unionOf([t.primitive('string'), unionOf([t.primitive('string'), t.primitive('int')])])).toEqual({
      kind: 'union',
      members: [t.primitive('string'), t.primitive('int')],
    });
  });

  it('keys types structurally', () => {
    expect(typeKey(t.array(t.primitive('string')))).toBe(typeKey(t.array(t.primitive('string'))));
    expect(typeKey(t.array(t.primitive('string'), true))).not.toBe(typeKey(t.array(t.primitive('string'))));
  });
});
