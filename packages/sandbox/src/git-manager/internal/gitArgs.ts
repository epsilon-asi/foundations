/**
 * Pure builders for every git argument vector the library runs. Keeping argv construction separate from execution
 * makes the exact command lines unit-testable; `docs/git-manager/git-command-mapping.md` documents them per public method.
 */
import type {
  CreateGitBranchOptions,
  CreateWorktreeOptions,
  GitCommitOptions,
  RemoveWorktreeOptions,
} from '../contracts/index.js';
import { assertUsage } from '../errors.js';

/** Argument vectors for commands that take no caller input. */
export const GIT_ARGS = {
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
} as const satisfies Record<string, readonly string[]>;

const DIFF_FLAGS = {
  tracked: ['--binary', '--find-renames'],
  staged: ['--cached', '--binary', '--find-renames'],
  nameStatus: ['--name-status', '-z'],
} as const satisfies Record<string, readonly string[]>;

/** Which `git diff` variant to build. */
export type DiffKind = keyof typeof DIFF_FLAGS;

export type WorktreeAddArgsOptions = Pick<CreateWorktreeOptions, 'branchName' | 'detached' | 'force' | 'track'> & {
  readonly worktreePath: string;
  readonly startRef: string;
};

function flag(enabled: boolean | undefined, ...args: readonly string[]): readonly string[] {
  return enabled === true ? args : [];
}

/**
 * Guards a caller-supplied positional value (ref, branch name, path). Git parses anything starting with `-` as an
 * option, so a value such as `--output=/tmp/x` would otherwise change what the command does.
 */
function operand(value: string, label: string): string {
  assertUsage(!value.startsWith('-'), `${label} must not start with "-": ${JSON.stringify(value)}`);
  return value;
}

function optionalOperand(value: string | undefined, label: string): readonly string[] {
  return value === undefined ? [] : [operand(value, label)];
}

export function buildResolveRefArgs(ref: string): string[] {
  return ['rev-parse', '--verify', operand(ref, 'ref')];
}

export function buildWorktreeAddArgs(options: WorktreeAddArgsOptions): string[] {
  const branchArgs =
    options.branchName === undefined
      ? []
      : [options.force === true ? '-B' : '-b', operand(options.branchName, 'branchName')];

  return [
    'worktree',
    'add',
    '--quiet',
    ...flag(options.force, '--force'),
    ...flag(options.track, '--track'),
    ...flag(options.detached, '--detach'),
    ...branchArgs,
    operand(options.worktreePath, 'worktreePath'),
    operand(options.startRef, 'startRef'),
  ];
}

export function buildWorktreeRemoveArgs(options: Pick<RemoveWorktreeOptions, 'worktreePath' | 'force'>): string[] {
  return ['worktree', 'remove', ...flag(options.force, '--force'), operand(options.worktreePath, 'worktreePath')];
}

export function buildSwitchArgs(options: Pick<CreateGitBranchOptions, 'branchName' | 'startRef' | 'force'>): string[] {
  return [
    'switch',
    options.force === true ? '-C' : '-c',
    operand(options.branchName, 'branchName'),
    ...optionalOperand(options.startRef, 'startRef'),
  ];
}

export function buildStagePathsArgs(paths: readonly string[]): string[] {
  return ['add', '--', ...paths];
}

export function buildCommitArgs(options: Pick<GitCommitOptions, 'message' | 'allowEmpty' | 'amend'>): string[] {
  return [
    'commit',
    '--no-gpg-sign',
    '-m',
    options.message,
    ...flag(options.allowEmpty, '--allow-empty'),
    ...flag(options.amend, '--amend'),
  ];
}

export function buildDiffArgs(kind: DiffKind, baseRef?: string): string[] {
  return ['diff', ...DIFF_FLAGS[kind], ...optionalOperand(baseRef, 'baseRef')];
}

/** `git apply` reading the patch from stdin. */
export function buildApplyArgs(options: { readonly index: boolean; readonly check: boolean }): string[] {
  return ['apply', '--whitespace=nowarn', ...flag(options.index, '--index'), ...flag(options.check, '--check'), '-'];
}
