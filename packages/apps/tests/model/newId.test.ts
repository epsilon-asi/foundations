import { afterEach, expect, it, vi } from 'vitest';
import { newId } from '../../src/model/newId.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  [0x00, '01234567-89ab-7000-8000-000000000000'],
  [0xff, '01234567-89ab-7fff-bfff-ffffffffffff'],
] as const)('encodes all 48 timestamp bits, the version, and the variant with entropy %i', (byte, expected) => {
  vi.spyOn(Date, 'now').mockReturnValue(0x0123456789ab);
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(byte) });

  expect(newId()).toBe(expected);
});

it('generates distinct IDs with Web Crypto in the same millisecond', () => {
  vi.spyOn(Date, 'now').mockReturnValue(0x0123456789ab);
  const ids = Array.from({ length: 128 }, newId);

  expect(new Set(ids).size).toBe(ids.length);
});

it('sorts IDs lexically across a 32-bit timestamp rollover', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(0x0123ffffffff);
  const earlier = newId();
  now.mockReturnValue(0x012400000000);
  const later = newId();

  expect([later, earlier].sort()).toEqual([earlier, later]);
});
