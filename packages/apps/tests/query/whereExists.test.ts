import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class RecordBase {
  @Prop(z.array(z.string()).nullable(), { crud: 'readable' }) tags!: Readable<string[] | null>;
}
class Article extends RecordBase {
  @Prop(z.string().nullable().optional(), { crud: 'readable' }) title?: Readable<string | null>;
  @Prop(z.date().nullable(), { crud: 'readable' }) publishedAt!: Readable<Date | null>;
  @Prop(z.boolean().nullable(), { crud: 'readable' }) archived!: Readable<boolean | null>;
  @Prop(z.string().optional(), { crud: 'readable' }) description?: Readable<string>;
  @Prop(z.array(z.string()), { crud: 'readable' }) files!: Readable<string[]>;
}
const model = resolve(Article);
const filter = { tags: ['$exists'], title: ['$exists', '$ilike', '$eq'], publishedAt: true, archived: ['$eq'], description: true, files: true } as const;

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s field existence', (_mode, build) => {
  const query = build({ model, filter });

  it('round-trips existence independently of the stored value and preserves false', () => {
    const wire = { tags: { $exists: 'Off' }, title: { $ilike: 'A_%', $exists: 'YES', $eq: null },
      publishedAt: { $exists: '0', $gt: '2026-08-01T00:00:00Z' } };
    const stored = query.decode({ where: wire });
    expect(stored.where).toEqual({ tags: { $exists: false }, title: { $ilike: 'A_%', $exists: true, $eq: null },
      publishedAt: { $exists: false, $gt: new Date('2026-08-01T00:00:00Z') } });
    expect(z.encode(query, stored).where).toEqual({ tags: { $exists: 'false' }, title: { ...wire.title, $exists: 'true' },
      publishedAt: { $exists: 'false', $gt: '2026-08-01T00:00:00.000Z' } });
    expect(query.decode({ where: { tags: { $exists: '1' } } }).where).toEqual({ tags: { $exists: true } });
    expect(query.decode({ where: { title: { $eq: null } } }).where).toEqual({ title: { $eq: null } });
    expect(query.decode({ where: {} }).where).toEqual({});

    type Stored = NonNullable<z.output<typeof query>['where']>;
    type Wire = NonNullable<z.input<typeof query>['where']>;
    expectTypeOf<NonNullable<Stored['tags']>>().toMatchTypeOf<{ $exists: boolean }>();
    expectTypeOf<NonNullable<Wire['tags']>['$exists']>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<Stored['publishedAt']>['$exists']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NonNullable<Wire['title']>['$exists']>().toEqualTypeOf<string | undefined>();
    // @ts-expect-error The decoded existence condition takes a boolean.
    expect(z.safeEncode(query, { ...stored, where: { tags: { $exists: 'false' } } }).error?.issues[0].path).toEqual(['where', 'tags', '$exists']);
    // @ts-expect-error An omitted comparison was not enabled by the nullable field's explicit subset.
    expect(z.safeEncode(query, { ...stored, where: { archived: { $exists: false } } }).success).toBe(false);
    // @ts-expect-error An optional string is not nullable.
    expect(z.safeEncode(query, { ...stored, where: { description: { $exists: true } } }).success).toBe(false);
    // @ts-expect-error An existence-only array does not accept equality.
    expect(z.safeEncode(query, { ...stored, where: { tags: { $eq: null } } }).success).toBe(false);
  });

  it('rejects missing operands, invalid wire values and unavailable capabilities at the field or operator path', () => {
    for (const [where, path] of [
      [{ tags: {} }, ['tags', '$exists']], [{ tags: { $exists: undefined } }, ['tags', '$exists']],
      [{ tags: { $exists: null } }, ['tags', '$exists']], [{ tags: { $exists: false } }, ['tags', '$exists']],
      [{ title: { $exists: '' } }, ['title', '$exists']], [{ title: { $exists: 'sometimes' } }, ['title', '$exists']],
      [{ publishedAt: { $exists: 0 } }, ['publishedAt', '$exists']], [{ archived: { $exists: 'true' } }, ['archived', '$exists']],
      [{ description: { $exists: 'false' } }, ['description', '$exists']], [{ files: { $exists: 'true' } }, ['files']],
    ] as const) {
      expect(query.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
    const where = wireInputJsonSchema(query).properties?.where;
    expect(where).toMatchObject({ additionalProperties: false, properties: {
      tags: { required: ['$exists'], additionalProperties: false, properties: { $exists: { type: 'string' } } },
      title: { minProperties: 1, properties: { $exists: { type: 'string' } } },
    } });
    if (where && typeof where === 'object') {
      const fields = where.properties;
      expect(fields?.description).not.toHaveProperty('properties.$exists');
      expect(fields?.archived).not.toHaveProperty('properties.$exists');
      expect(fields).not.toHaveProperty('files');
    }
  });

  it('resolves nullable arrays with erased model types and checks widened declarations at runtime', () => {
    const { name, fields } = model;
    const operators: readonly '$exists'[] = ['$exists'];
    const erased = build({ model: { name, fields }, filter: { tags: operators } });
    const result = erased.decode({ where: { tags: { $exists: 'NO' } } });
    expect(result.where).toEqual({ tags: { $exists: false } });
    expect(z.encode(erased, result).where).toEqual({ tags: { $exists: 'false' } });
    expectTypeOf<NonNullable<NonNullable<typeof result.where>['tags']>['$exists']>().toEqualTypeOf<boolean>();
    expect(build({ model, filter: { tags: true } }).decode({ where: { tags: { $exists: 'on' } } }).where).toEqual({ tags: { $exists: true } });
    for (const path of ['description', 'files']) {
      expect(() => build({ model: { name, fields }, filter: { [path]: operators } })).toThrow(/\$exists/);
    }
    expect(build({ filter: { tags: operators } }).safeParse({ where: { tags: { $exists: 'true' } } }).success).toBe(false);
  });
});
