import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { updateFieldSchema } from '../../src/model/updateFieldSchema.js';

it('leaves unsent fields absent and applies their fallbacks only on create', () => {
  const initialStatus = vi.fn(() => 'draft' as const);
  const links = z.array(z.url()).default([]);
  const status = z.enum(['draft', 'live']).prefault(initialStatus);
  const rank = z.int().positive().catch(1);
  const create = z.object({ links, status, rank });
  const patch = z.object({
    links: updateFieldSchema({ schema: links }),
    status: updateFieldSchema({ schema: status }),
    rank: updateFieldSchema({ schema: rank }),
  });

  expect(patch.parse({})).toStrictEqual({});
  expect(patch.parse({ status: 'live' })).toStrictEqual({ status: 'live' });
  expect(patch.safeParse({ links: ['invalid'] }).success).toBe(false);
  expect(patch.safeParse({ status: 'unknown' }).success).toBe(false);
  expect(patch.safeParse({ rank: 0 }).error?.issues[0].path).toEqual(['rank']);
  expect(initialStatus).toHaveBeenCalledTimes(0);
  expect(create.parse({})).toStrictEqual({ links: [], status: 'draft', rank: 1 });
  expect(initialStatus).toHaveBeenCalledTimes(1);
});

it('preserves null to clear a field through stacked fallback and presence wrappers', () => {
  const schema = z.int().positive().catch(1).optional().nullable().default(2);
  const patch = z.object({ rank: updateFieldSchema({ schema }) });
  expect(patch.parse({})).toStrictEqual({});
  expect(patch.parse({ rank: null })).toStrictEqual({ rank: null });
  expect(patch.parse({ rank: 3 })).toStrictEqual({ rank: 3 });
  expect(patch.safeParse({ rank: -1 }).success).toBe(false);
  expectTypeOf<z.output<typeof patch>>().toEqualTypeOf<{ rank?: number | null | undefined }>();
});

it('keeps transforms, refinements on removed wrappers, and the field’s input and output types', () => {
  const schema = z.string().trim().min(1).default('three')
    .refine(value => value !== 'reserved', 'Reserved name')
    .transform(value => value.length)
    .pipe(z.int().min(2).catch(2));
  const patch = z.object({ size: updateFieldSchema({ schema }) });

  expect(patch.parse({})).toStrictEqual({});
  expect(patch.parse({ size: ' xyz ' })).toStrictEqual({ size: 3 });
  expect(patch.safeParse({ size: 'reserved' }).error?.issues[0].message).toBe('Reserved name');
  expect(patch.safeParse({ size: 'x' }).success).toBe(false);
  expectTypeOf<z.input<typeof patch>>().toEqualTypeOf<{ size?: string | undefined }>();
  expectTypeOf<z.output<typeof patch>>().toEqualTypeOf<{ size?: number | undefined }>();
});

it('keeps lazy field resolution deferred and removes fallbacks from union branches', () => {
  const choices = z.union([z.literal('draft').catch('draft'), z.literal(0).default(0)]);
  const target = vi.fn(() => choices);
  const meaning = z.lazy(target);
  const patch = z.object({ meaning: updateFieldSchema({ schema: meaning }) });
  expect(target).toHaveBeenCalledTimes(0);
  expect(meaning.parse(false)).toBe('draft');
  expect(patch.parse({})).toStrictEqual({});
  expect(patch.parse({ meaning: 0 })).toStrictEqual({ meaning: 0 });
  expect(patch.safeParse({ meaning: false }).success).toBe(false);
});

it('derives the PATCH field from the schema returned by a foundation shorthand', () => {
  const registry = createTypeRegistry();
  class Contact {
    @registry.Prop.string({ default: 'Guest', min: 1 }) displayName!: string;
  }
  const field = registry.resolve(Contact).fields.get('displayName')!;
  const patch = z.object({ displayName: updateFieldSchema(field) });
  expect(patch.parse({})).toStrictEqual({});
  expect(patch.parse({ displayName: 'Ada' })).toStrictEqual({ displayName: 'Ada' });
  expect(patch.safeParse({ displayName: '' }).success).toBe(false);
  expect(field.schema.parse(undefined)).toBe('Guest');
});
