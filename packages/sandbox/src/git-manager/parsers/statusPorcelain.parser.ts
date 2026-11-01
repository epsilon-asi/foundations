import type { GitStatusEntry, GitStatusKind } from '../contracts/index.js';
import { GitOutputParseError } from '../errors.js';
import { splitNulFields, takeField } from './nulFields.js';

/** Codes whose meaning depends on the full `XY` pair. */
const EXACT_STATUS_KINDS: ReadonlyMap<string, GitStatusKind> = new Map([
  ['??', 'untracked'],
  ['!!', 'ignored'],
  ['DD', 'unmerged'],
  ['AA', 'unmerged'],
]);

/** Single-letter codes in precedence order; the first one present in either column wins. */
const STATUS_CODE_KINDS: readonly (readonly [code: string, kind: GitStatusKind])[] = [
  ['U', 'unmerged'],
  ['R', 'renamed'],
  ['C', 'copied'],
  ['A', 'added'],
  ['D', 'deleted'],
  ['T', 'type-changed'],
  ['M', 'modified'],
];

/** Classifies a two-character porcelain `XY` status code. */
export function inferStatusKind(rawStatus: string): GitStatusKind {
  const exact = EXACT_STATUS_KINDS.get(rawStatus);

  if (exact !== undefined) {
    return exact;
  }

  const [indexStatus, worktreeStatus] = rawStatus;
  const match = STATUS_CODE_KINDS.find(([code]) => indexStatus === code || worktreeStatus === code);
  return match?.[1] ?? 'unknown';
}

/** Parses `git status --porcelain=v1 -z` output. */
export function parseStatusPorcelainV1Z(output: string): GitStatusEntry[] {
  const fields = splitNulFields(output).values();
  const entries: GitStatusEntry[] = [];

  for (const field of fields) {
    if (field.length < 4) {
      throw new GitOutputParseError(`Malformed status porcelain entry: ${JSON.stringify(field)}`, output);
    }

    const rawStatus = field.slice(0, 2);
    const kind = inferStatusKind(rawStatus);
    const hasOriginalPath = kind === 'renamed' || kind === 'copied';

    entries.push({
      rawStatus,
      indexStatus: rawStatus.charAt(0),
      worktreeStatus: rawStatus.charAt(1),
      path: field.slice(3),
      originalPath: hasOriginalPath ? takeField(fields, output, `the original path of ${JSON.stringify(field)}`) : null,
      kind,
    });
  }

  return entries;
}
