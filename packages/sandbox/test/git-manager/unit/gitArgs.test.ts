import { describe, expect, it } from 'vitest';

import { GitUsageError } from '../../../src/git-manager/errors.js';
import {
  GIT_ARGS,
  buildApplyArgs,
  buildCommitArgs,
  buildDiffArgs,
  buildResolveRefArgs,
  buildStagePathsArgs,
  buildSwitchArgs,
  buildWorktreeAddArgs,
  buildWorktreeRemoveArgs,
} from '../../../src/git-manager/internal/gitArgs.js';

describe('GIT_ARGS', () => {
  it('pins the fixed command lines', () => {
    expect(GIT_ARGS).toEqual({
      showToplevel: ['rev-parse', '--show-toplevel'],
      headSha: ['rev-parse', 'HEAD'],
      currentBranch: ['rev-parse', '--abbrev-ref', 'HEAD'],
      commonDir: ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      worktreeList: ['worktree', 'list', '--porcelain', '-z'],
      worktreePrune: ['worktree', 'prune'],
      status: ['status', '--porcelain=v1', '-z'],
      stageAll: ['add', '-A', '--', '.'],
      resetHard: ['reset', '--hard', 'HEAD'],
      cleanUntracked: ['clean', '-fd'],
      listUntracked: ['ls-files', '--others', '--exclude-standard', '-z'],
    });
  });
});

describe('buildResolveRefArgs', () => {
  it('verifies the ref', () => {
    expect(buildResolveRefArgs('main~1')).toEqual(['rev-parse', '--verify', 'main~1']);
  });
});

describe('buildWorktreeAddArgs', () => {
  it('creates a new branch with -b', () => {
    expect(buildWorktreeAddArgs({ worktreePath: '/sb', startRef: 'HEAD', branchName: 'feature' })).toEqual([
      'worktree',
      'add',
      '--quiet',
      '-b',
      'feature',
      '/sb',
      'HEAD',
    ]);
  });

  it('forces and resets the branch with -B when force is set', () => {
    expect(
      buildWorktreeAddArgs({ worktreePath: '/sb', startRef: 'v1', branchName: 'feature', force: true, track: true }),
    ).toEqual(['worktree', 'add', '--quiet', '--force', '--track', '-B', 'feature', '/sb', 'v1']);
  });

  it('detaches without a branch', () => {
    expect(buildWorktreeAddArgs({ worktreePath: '/sb', startRef: 'abc123', detached: true })).toEqual([
      'worktree',
      'add',
      '--quiet',
      '--detach',
      '/sb',
      'abc123',
    ]);
  });
});

describe('buildWorktreeRemoveArgs', () => {
  it.each([
    [{ worktreePath: '/sb' }, ['worktree', 'remove', '/sb']],
    [{ worktreePath: '/sb', force: true }, ['worktree', 'remove', '--force', '/sb']],
  ])('builds %j', (options, expected) => {
    expect(buildWorktreeRemoveArgs(options)).toEqual(expected);
  });
});

describe('buildSwitchArgs', () => {
  it.each([
    [{ branchName: 'feature' }, ['switch', '-c', 'feature']],
    [{ branchName: 'feature', startRef: 'main' }, ['switch', '-c', 'feature', 'main']],
    [{ branchName: 'feature', force: true }, ['switch', '-C', 'feature']],
  ])('builds %j', (options, expected) => {
    expect(buildSwitchArgs(options)).toEqual(expected);
  });
});

describe('buildStagePathsArgs', () => {
  it('separates pathspecs with --', () => {
    expect(buildStagePathsArgs(['a.txt', '-weird'])).toEqual(['add', '--', 'a.txt', '-weird']);
  });
});

describe('buildCommitArgs', () => {
  it.each([
    [{ message: 'msg' }, ['commit', '--no-gpg-sign', '-m', 'msg']],
    [
      { message: 'msg', allowEmpty: true, amend: true },
      ['commit', '--no-gpg-sign', '-m', 'msg', '--allow-empty', '--amend'],
    ],
  ])('builds %j', (options, expected) => {
    expect(buildCommitArgs(options)).toEqual(expected);
  });
});

describe('buildDiffArgs', () => {
  it.each([
    ['tracked', undefined, ['diff', '--binary', '--find-renames']],
    ['tracked', 'HEAD', ['diff', '--binary', '--find-renames', 'HEAD']],
    ['staged', undefined, ['diff', '--cached', '--binary', '--find-renames']],
    ['staged', 'main', ['diff', '--cached', '--binary', '--find-renames', 'main']],
    ['nameStatus', undefined, ['diff', '--name-status', '-z']],
    ['nameStatus', 'HEAD~1', ['diff', '--name-status', '-z', 'HEAD~1']],
  ] as const)('builds %s diff against %s', (kind, baseRef, expected) => {
    expect(buildDiffArgs(kind, baseRef)).toEqual(expected);
  });
});

describe('buildApplyArgs', () => {
  it.each([
    [{ index: false, check: false }, ['apply', '--whitespace=nowarn', '-']],
    [{ index: false, check: true }, ['apply', '--whitespace=nowarn', '--check', '-']],
    [{ index: true, check: true }, ['apply', '--whitespace=nowarn', '--index', '--check', '-']],
  ])('builds %j', (options, expected) => {
    expect(buildApplyArgs(options)).toEqual(expected);
  });
});

describe('option injection guard', () => {
  it.each([
    ['ref', () => buildResolveRefArgs('--all')],
    ['baseRef', () => buildDiffArgs('tracked', '--output=/tmp/pwned')],
    ['branchName', () => buildSwitchArgs({ branchName: '-D' })],
    ['startRef', () => buildSwitchArgs({ branchName: 'feature', startRef: '--orphan' })],
    ['branchName', () => buildWorktreeAddArgs({ worktreePath: '/s', startRef: 'HEAD', branchName: '-f' })],
    ['startRef', () => buildWorktreeAddArgs({ worktreePath: '/s', startRef: '--lock' })],
    ['worktreePath', () => buildWorktreeAddArgs({ worktreePath: '-s', startRef: 'HEAD', detached: true })],
    ['worktreePath', () => buildWorktreeRemoveArgs({ worktreePath: '--force' })],
  ])('rejects a %s that starts with "-"', (label, build) => {
    expect(build).toThrow(GitUsageError);
    expect(build).toThrow(`${label} must not start with "-"`);
  });
});
