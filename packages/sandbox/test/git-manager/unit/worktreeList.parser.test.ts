import { describe, expect, it } from 'vitest';

import { GitOutputParseError } from '../../../src/git-manager/index.js';
import { parseWorktreeList } from '../../../src/git-manager/parsers/worktreeList.parser.js';
import { captureError } from '../fixtures/captureError.js';

describe('parseWorktreeList', () => {
  it('returns an empty array for empty input', () => {
    expect(parseWorktreeList('')).toEqual([]);
  });

  it('parses porcelain worktree records', () => {
    const parsed = parseWorktreeList(
      [
        'worktree /repo',
        'HEAD 1111111111111111111111111111111111111111',
        'branch refs/heads/main',
        '',
        'worktree /repo/worktree',
        'HEAD 2222222222222222222222222222222222222222',
        'detached',
        'locked busy',
        'prunable missing path',
        '',
        'worktree /bare',
        'bare',
        '',
      ].join('\u0000'),
    );

    expect(parsed).toEqual([
      {
        worktreePath: '/repo',
        headSha: '1111111111111111111111111111111111111111',
        branchRef: 'refs/heads/main',
        branchName: 'main',
        detached: false,
        bare: false,
        locked: false,
        lockedReason: null,
        prunable: false,
        prunableReason: null,
      },
      {
        worktreePath: '/repo/worktree',
        headSha: '2222222222222222222222222222222222222222',
        branchRef: null,
        branchName: null,
        detached: true,
        bare: false,
        locked: true,
        lockedReason: 'busy',
        prunable: true,
        prunableReason: 'missing path',
      },
      {
        worktreePath: '/bare',
        headSha: null,
        branchRef: null,
        branchName: null,
        detached: false,
        bare: true,
        locked: false,
        lockedReason: null,
        prunable: false,
        prunableReason: null,
      },
    ]);
  });

  it('keeps spaces in paths and reasons and accepts reason-less locked/prunable markers', () => {
    const parsed = parseWorktreeList(
      ['worktree /tmp/my worktree', 'HEAD abc', 'branch refs/remotes/origin/x', 'locked', 'prunable', ''].join('\0'),
    );

    expect(parsed).toEqual([
      {
        worktreePath: '/tmp/my worktree',
        headSha: 'abc',
        branchRef: 'refs/remotes/origin/x',
        branchName: null,
        detached: false,
        bare: false,
        locked: true,
        lockedReason: null,
        prunable: true,
        prunableReason: null,
      },
    ]);
  });

  it.each([
    ['an attribute before the first header', 'HEAD abc\0'],
    ['an unknown attribute', 'worktree /repo\0mystery value\0'],
    ['HEAD without a value', 'worktree /repo\0HEAD\0'],
    ['branch without a value', 'worktree /repo\0branch\0'],
  ])('rejects %s', (_label, output) => {
    const error = captureError(() => parseWorktreeList(output));

    expect(error).toBeInstanceOf(GitOutputParseError);
    expect(error).toMatchObject({ output });
  });
});
