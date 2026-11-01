import { describe, expect, it } from 'vitest';

import { GitOutputParseError } from '../../../src/git-manager/index.js';
import { parseDiffNameStatus } from '../../../src/git-manager/parsers/diffNameStatus.parser.js';
import { captureError } from '../fixtures/captureError.js';

describe('parseDiffNameStatus', () => {
  it('returns an empty array for empty output', () => {
    expect(parseDiffNameStatus('')).toEqual([]);
  });

  it('parses single-path entries', () => {
    expect(parseDiffNameStatus('M\0tracked.txt\0A\0new file.txt\0D\0gone.txt\0')).toEqual([
      { status: 'M', path: 'tracked.txt' },
      { status: 'A', path: 'new file.txt' },
      { status: 'D', path: 'gone.txt' },
    ]);
  });

  it('parses renames and copies as source then destination', () => {
    expect(parseDiffNameStatus('R100\0old.txt\0new.txt\0C075\0base.txt\0copy.txt\0M\0x.txt\0')).toEqual([
      { status: 'R100', oldPath: 'old.txt', path: 'new.txt' },
      { status: 'C075', oldPath: 'base.txt', path: 'copy.txt' },
      { status: 'M', path: 'x.txt' },
    ]);
  });

  it.each([
    ['a status without a path', 'M\0'],
    ['a rename without a destination', 'R100\0old.txt\0'],
  ])('rejects %s', (_label, output) => {
    const error = captureError(() => parseDiffNameStatus(output));

    expect(error).toBeInstanceOf(GitOutputParseError);
    expect(error).toMatchObject({ name: 'GitOutputParseError', output });
  });
});
