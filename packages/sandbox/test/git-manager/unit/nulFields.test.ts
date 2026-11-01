import { describe, expect, it } from 'vitest';

import { GitOutputParseError } from '../../../src/git-manager/index.js';
import { splitNulFields, takeField } from '../../../src/git-manager/parsers/nulFields.js';

describe('splitNulFields', () => {
  it.each([
    ['', []],
    ['a\0', ['a']],
    ['a\0b c\0\0d\0', ['a', 'b c', 'd']],
    ['no-terminator', ['no-terminator']],
  ])('splits %j', (output, expected) => {
    expect(splitNulFields(output)).toEqual(expected);
  });
});

describe('takeField', () => {
  it('returns the next field and throws once the output is exhausted', () => {
    const fields = ['only'].values();

    expect(takeField(fields, 'only\0', 'a path')).toBe('only');
    expect(() => takeField(fields, 'only\0', 'a path')).toThrow(GitOutputParseError);
    expect(() => takeField(fields, 'only\0', 'a path')).toThrow('Unexpected end of git output: expected a path.');
  });
});
