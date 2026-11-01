import { describe, expect, it } from 'vitest';

import { resolveContainerCommand } from '../../src/container-runtime/defaults.js';
import { assertNonEmptyArray, coerceStringRecord } from '../../src/container-runtime/internal.js';

describe('internal helpers', () => {
  it('coerceStringRecord keeps string entries of plain objects', () => {
    expect(coerceStringRecord({ a: 'x', b: 1, c: null })).toEqual({ a: 'x' });
    expect(coerceStringRecord(['a'])).toEqual({});
    expect(coerceStringRecord(null)).toEqual({});
  });

  it('assertNonEmptyArray throws a TypeError for empty arrays', () => {
    expect(() => assertNonEmptyArray([], 'empty')).toThrow(TypeError);
    expect(() => assertNonEmptyArray([1], 'empty')).not.toThrow();
  });

  it('resolveContainerCommand falls back to the keepalive command and copies its input', () => {
    const command = ['node', 'server.js'];

    expect(resolveContainerCommand(undefined)).toEqual(['sleep', 'infinity']);
    expect(resolveContainerCommand([])).toEqual(['sleep', 'infinity']);
    expect(resolveContainerCommand(command)).toEqual(command);
    expect(resolveContainerCommand(command)).not.toBe(command);
  });
});
