import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class StoredArticle {
  @Prop(z.array(z.string()).readonly().nullable().optional(), { crud: 'readable' }) tags?: Readable<readonly string[] | null>;
}
class Article extends StoredArticle {
  @Prop(z.array(z.int()).nullable().default([]), { crud: 'readable' }) scores!: Readable<number[] | null>;
  @Prop(z.array(z.string().nullable()).optional(), { crud: 'readable' }) notes?: Readable<(string | null)[]>;
  @Prop.number({ crud: 'readable' }) rank!: Readable<number>;
}
const model = resolve(Article);

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s nullable array equality', (_mode, build) => {
  const list = build({ model, filter: { tags: ['$eq'], scores: true, notes: true } });

  it('round-trips native null alone and alongside existence on a wrapped array', () => {
    const stored = list.decode({ where: { tags: { $eq: null }, scores: { $eq: null, $exists: 'OFF' } } });
    expect(stored.where).toEqual({ tags: { $eq: null }, scores: { $eq: null, $exists: false } });
    expect(z.encode(list, stored).where).toEqual({ tags: { $eq: null }, scores: { $eq: null, $exists: 'false' } });
    expect(list.decode({ where: {} }).where).toEqual({});
    type Wire = NonNullable<z.input<typeof list>['where']>;
    type Stored = NonNullable<typeof stored.where>;
    expectTypeOf<NonNullable<Wire['tags']>['$eq']>().toEqualTypeOf<null>();
    expectTypeOf<NonNullable<Stored['tags']>['$eq']>().toEqualTypeOf<null>();
    expectTypeOf<NonNullable<Stored['scores']>['$eq']>().toEqualTypeOf<null | undefined>();
    // @ts-expect-error Whole-array equality is unavailable.
    expect(z.safeEncode(list, { ...stored, where: { scores: { $eq: [4] } } }).error?.issues[0].path).toEqual(['where', 'scores', '$eq']);
    // @ts-expect-error Nullable elements do not make the array itself nullable.
    expect(z.safeEncode(list, { ...stored, where: { notes: { $eq: null } } }).success).toBe(false);
  });

  it('requires a native null at the operator path and describes it on the wire', () => {
    for (const value of [[], ['text'], 'null', false, 0, {}, undefined]) {
      expect(list.safeParse({ where: { tags: { $eq: value } } }).error?.issues[0].path).toEqual(['where', 'tags', '$eq']);
    }
    expect(list.safeParse({ where: { tags: {} } }).error?.issues[0].path).toEqual(['where', 'tags', '$eq']);
    expect(list.safeParse({ where: { tags: { $exists: 'true' } } }).error?.issues[0].path).toEqual(['where', 'tags', '$exists']);
    const where = wireInputJsonSchema(list).properties?.where;
    expect(where).toMatchObject({ properties: {
      tags: { required: ['$eq'], additionalProperties: false, properties: { $eq: { type: 'null' } } },
      scores: { minProperties: 1, properties: { $eq: { type: 'null' }, $exists: { type: 'string' } } },
    } });
  });

  it('retains scalar equality for erased models and can narrow an explicit array capability', () => {
    const { name, fields } = model;
    const caps: readonly '$eq'[] = ['$eq'];
    const filter = { tags: ['$eq', '$contains'], rank: caps } as const;
    const list = build({ model: { name, fields }, filter });
    const stored = list.decode({ where: { tags: { $eq: null }, rank: { $eq: '3' } } });
    expect(stored.where).toEqual({ tags: { $eq: null }, rank: { $eq: 3 } });
    expect(z.encode(list, stored).where).toEqual({ tags: { $eq: null }, rank: { $eq: '3' } });
    type Stored = NonNullable<typeof stored.where>;
    expectTypeOf<Exclude<NonNullable<Stored['tags']>['$eq'], undefined>>().toEqualTypeOf<null>();
    type Scalar = string | number | bigint | boolean | Date | null;
    expectTypeOf<NonNullable<Stored['rank']>['$eq']>().toExtend<Scalar>();
    expectTypeOf<Scalar>().toExtend<NonNullable<Stored['rank']>['$eq']>();
    expect(() => build({ model: { name, fields }, filter: { notes: caps } })).toThrow(/\$eq.*array/);
  });
});
