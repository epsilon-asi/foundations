import { describe, expect, it } from 'vitest';

import { inferStatusKind } from '../../../src/git-manager/parsers/statusPorcelain.parser.js';

describe('inferStatusKind', () => {
  it.each([
    ['??', 'untracked'],
    ['!!', 'ignored'],
    ['UU', 'unmerged'],
    ['DD', 'unmerged'],
    ['AA', 'unmerged'],
    ['AU', 'unmerged'],
    ['UD', 'unmerged'],
    ['R ', 'renamed'],
    ['RM', 'renamed'],
    [' C', 'copied'],
    ['A ', 'added'],
    ['AM', 'added'],
    [' D', 'deleted'],
    ['M ', 'modified'],
    [' M', 'modified'],
    [' T', 'type-changed'],
    ['  ', 'unknown'],
  ] as const)('maps %j to %s', (rawStatus, expectedKind) => {
    expect(inferStatusKind(rawStatus)).toBe(expectedKind);
  });
});
