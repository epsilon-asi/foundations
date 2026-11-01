import { describe, expect, it } from 'vitest';

import { GitOutputParseError } from '../../../src/git-manager/index.js';
import { parseStatusPorcelainV1Z } from '../../../src/git-manager/parsers/statusPorcelain.parser.js';
import { captureError } from '../fixtures/captureError.js';

describe('parseStatusPorcelainV1Z', () => {
  it('returns an empty array for empty input', () => {
    expect(parseStatusPorcelainV1Z('')).toEqual([]);
  });

  it('parses standard status entries', () => {
    const parsed = parseStatusPorcelainV1Z(
      'M  tracked.txt\u0000A  added.txt\u0000D  delete-me.txt\u0000?? untracked.txt\u0000',
    );

    expect(parsed).toEqual([
      {
        rawStatus: 'M ',
        indexStatus: 'M',
        worktreeStatus: ' ',
        path: 'tracked.txt',
        originalPath: null,
        kind: 'modified',
      },
      {
        rawStatus: 'A ',
        indexStatus: 'A',
        worktreeStatus: ' ',
        path: 'added.txt',
        originalPath: null,
        kind: 'added',
      },
      {
        rawStatus: 'D ',
        indexStatus: 'D',
        worktreeStatus: ' ',
        path: 'delete-me.txt',
        originalPath: null,
        kind: 'deleted',
      },
      {
        rawStatus: '??',
        indexStatus: '?',
        worktreeStatus: '?',
        path: 'untracked.txt',
        originalPath: null,
        kind: 'untracked',
      },
    ]);
  });

  it('parses rename and copy entries with original paths', () => {
    const parsed = parseStatusPorcelainV1Z(
      'R  renamed.txt\u0000rename-me.txt\u0000C  copied.txt\u0000tracked.txt\u0000',
    );

    expect(parsed).toEqual([
      {
        rawStatus: 'R ',
        indexStatus: 'R',
        worktreeStatus: ' ',
        path: 'renamed.txt',
        originalPath: 'rename-me.txt',
        kind: 'renamed',
      },
      {
        rawStatus: 'C ',
        indexStatus: 'C',
        worktreeStatus: ' ',
        path: 'copied.txt',
        originalPath: 'tracked.txt',
        kind: 'copied',
      },
    ]);
  });

  it.each([
    ['an entry shorter than "XY path"', 'M \0'],
    ['a rename without its original path', 'R  renamed.txt\0'],
  ])('rejects %s', (_label, output) => {
    const error = captureError(() => parseStatusPorcelainV1Z(output));

    expect(error).toBeInstanceOf(GitOutputParseError);
    expect(error).toMatchObject({ output });
  });
});
