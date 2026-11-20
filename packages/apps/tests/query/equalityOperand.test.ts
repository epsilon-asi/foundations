import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { equalityOperand } from '../../src/query/equalityOperand.js';
import { dateWireCodec } from '../../src/wire/date.js';

it('round-trips scalar values and validates their field constraints in both directions', () => {
  const rank = equalityOperand(z.int().min(1))!;
  expect(rank.decode('3')).toBe(3);
  expect(rank.encode(3)).toBe('3');
  for (const invalid of ['', ' 3', '0', '2.4', 3]) expect(rank.safeParse(invalid).success).toBe(false);
  expect(rank.safeEncode(0).success).toBe(false);
  const enabled = equalityOperand(z.boolean())!;
  expect(enabled.decode('false')).toBe(false);
  expect(enabled.encode(true)).toBe('true');
  const total = equalityOperand(z.bigint().nonnegative())!;
  const large = BigInt('12345678901234567890');
  expect(total.decode('12345678901234567890')).toBe(large);
  expect(total.encode(large)).toBe('12345678901234567890');
  for (const invalid of ['1e2', '-1', '', '2.5']) expect(total.safeParse(invalid).success).toBe(false);
  const dates = [equalityOperand(z.date())!, equalityOperand(dateWireCodec)!];
  for (const date of dates) {
    const instant = date.decode('2026-11-19T10:00:00+02:00');
    expect(instant).toEqual(new Date('2026-11-19T08:00:00Z'));
    expect(date.encode(instant)).toBe('2026-11-19T08:00:00.000Z');
  }
});

it('requires a supplied value and preserves field checks without running create defaults or catch fallbacks', () => {
  const fallback = vi.fn(() => 42);
  const field = z.int().catch(fallback).default(fallback).optional().nullable().refine(x => x !== 13);
  const operand = equalityOperand(field)!;
  expect(operand.decode(null)).toBeNull();
  expect(operand.encode(null)).toBeNull();
  for (const value of [undefined, 'bad', '13']) expect(operand.safeParse(value).success).toBe(false);
  expect(operand.safeEncode(13).success).toBe(false);
  expect(fallback).not.toHaveBeenCalled();
  expect(equalityOperand(z.string().min(2))!.safeParse('').success).toBe(false);
  expect(equalityOperand(z.coerce.string())!.safeParse(4).success).toBe(false);
});

it('preserves the string wire format of a field codec and uses stored enum choices for menus', () => {
  const priority = z.codec(z.string().regex(/^P[1-9]$/), z.int(), {
    decode: wire => Number(wire.slice(1)), encode: rank => 'P' + rank,
  });
  const operand = equalityOperand(priority.optional())!;
  expect(operand.decode('P3')).toBe(3);
  expect(operand.encode(3)).toBe('P3');
  expect(operand.safeParse('3').success).toBe(false);
  const stage = z.codec(z.enum(['D', 'L']), z.enum(['DRAFT', 'LIVE']), {
    decode: value => value === 'D' ? 'DRAFT' : 'LIVE',
    encode: value => value === 'DRAFT' ? 'D' : 'L',
  });
  const choice = equalityOperand(stage)!;
  expect(choice.decode('DRAFT')).toBe('DRAFT');
  expect(choice.encode('LIVE')).toBe('LIVE');
  expect(choice.safeParse('D').success).toBe(false);
  const stages = z.enum(['DRAFT', 'LIVE']);
  const legacy = z.codec(stages, stages, {
    decode: value => value === 'DRAFT' ? 'LIVE' : 'DRAFT',
    encode: value => value === 'DRAFT' ? 'LIVE' : 'DRAFT',
  }).refine(value => value !== 'DRAFT');
  const storedChoice = equalityOperand(legacy)!;
  expect(storedChoice.decode('LIVE')).toBe('LIVE');
  expect(storedChoice.safeEncode('DRAFT').success).toBe(false);
});

it('compares the stored scalar from a one-way transform and leaves non-scalar fields out', () => {
  const stored = z.string().transform(text => Number(text)).pipe(z.int().positive()).refine(value => value !== 13);
  const operand = equalityOperand(stored)!;
  expect(operand.decode('2')).toBe(2);
  expect(operand.encode(2)).toBe('2');
  expect(operand.safeParse('-2').success).toBe(false);
  expect(operand.safeParse('13').success).toBe(false);
  const text = z.string().min(2);
  const sameBase = equalityOperand(text.transform(value => value.toUpperCase()).pipe(text))!;
  expect(sameBase.decode('stored')).toBe('stored');
  expect(sameBase.encode('stored')).toBe('stored');
  const follow = vi.fn(() => z.strictObject({ city: z.string() }));
  for (const field of [z.array(z.string()).nullable(), z.lazy(follow), z.object({ name: z.string() })]) {
    expect(equalityOperand(field)).toBeUndefined();
  }
  expect(follow).not.toHaveBeenCalled();
});
