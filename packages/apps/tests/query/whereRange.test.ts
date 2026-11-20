import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class StoredSample {
  @Prop.number({ crud: 'id' }) key!: Id<number>;
  @Prop(z.date().nullable(), { crud: 'readable' }) measuredAt!: Readable<Date | null>;
}
const grade = z.codec(z.string().regex(/^P[0-9]$/), z.int(), {
  decode: value => Number(value.slice(1)), encode: value => 'P' + value,
});
class Sample extends StoredSample {
  @Prop.number({ crud: 'readable', integer: true, min: 0 }) count!: Readable<number>;
  @Prop(z.bigint().nonnegative(), { crud: 'readable' }) sequence!: Readable<bigint>;
  @Prop(grade, { crud: 'readable' }) grade!: Readable<number>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @(Prop.enum(['raw', 'ready'], { crud: 'readable' })) state!: Readable<'raw' | 'ready'>;
  @Prop.boolean({ crud: 'readable' }) active!: Readable<boolean>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
}
const model = resolve(Sample);
const filter = { count: ['$gt', '$lte'], sequence: true, measuredAt: ['$gte', '$lt'], grade: ['$gte'],
  key: true, title: true, state: true, active: true, tags: true } as const;

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s range conditions', (_mode, build) => {
  const list = build({ model, filter, sort: ['count'], search: { fields: ['title'] } });

  it('round-trips mixed numeric, bigint and date bounds through the field codecs', () => {
    const wire = { perPage: '8', orderBy: { count: 'asc' }, q: 'samples', where: {
      count: { $gt: '2', $lte: '12' }, sequence: { $ne: '2', $gte: '9007199254740993', $lt: '9007199254740997' },
      measuredAt: { $gte: '2026-07-01T02:00:00+02:00', $lt: '2026-09-01T00:00:00Z' }, grade: { $gte: 'P4' },
    } } as const;
    const result = list.decode(wire);
    expect(result).toMatchObject({ perPage: 8, q: 'samples', orderBy: { count: 'asc' }, where: {
      count: { $gt: 2, $lte: 12 }, sequence: { $ne: BigInt(2), $gte: BigInt('9007199254740993'), $lt: BigInt('9007199254740997') },
      measuredAt: { $gte: new Date('2026-07-01T00:00:00Z'), $lt: new Date('2026-09-01T00:00:00Z') }, grade: { $gte: 4 },
    } });
    expect(z.encode(list, result)).toMatchObject({ ...wire, where: { ...wire.where,
      measuredAt: { $gte: '2026-07-01T00:00:00.000Z', $lt: '2026-09-01T00:00:00.000Z' },
    } });
    type Stored = NonNullable<z.output<typeof list>['where']>;
    type Wire = NonNullable<z.input<typeof list>['where']>;
    expectTypeOf<keyof NonNullable<Stored['count']>>().toEqualTypeOf<'$gt' | '$lte'>();
    expectTypeOf<NonNullable<Stored['measuredAt']>['$gte']>().toEqualTypeOf<Date | undefined>();
    expectTypeOf<NonNullable<Stored['sequence']>['$lt']>().toEqualTypeOf<bigint | undefined>();
    expectTypeOf<NonNullable<Wire['measuredAt']>['$gte']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<Wire['sequence']>['$lt']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<keyof NonNullable<Stored['key']>>().toEqualTypeOf<'$eq' | '$ne'>();
    // @ts-expect-error The date field bounds use decoded dates and exclude null.
    expect(z.safeEncode(list, { ...result, where: { measuredAt: { $gte: null } } }).success).toBe(false);
    // @ts-expect-error This field omitted the strict upper bound.
    expect(z.safeEncode(list, { ...result, where: { count: { $lt: 5 } } }).success).toBe(false);
    // @ts-expect-error A string has no ordered comparison.
    expect(z.safeEncode(list, { ...result, where: { title: { $gt: 'a' } } }).success).toBe(false);
  });

  it('rejects unlisted operators, non-range fields, null, and invalid wire values at the comparison path', () => {
    for (const [where, path] of [
      [{ count: { $gte: '0' } }, ['count', '$gte']], [{ count: { $gt: '-1' } }, ['count', '$gt']],
      [{ count: { $lte: '2.25' } }, ['count', '$lte']], [{ count: { $gt: 2 } }, ['count', '$gt']],
      [{ sequence: { $lt: '1.5' } }, ['sequence', '$lt']], [{ grade: { $gte: '4' } }, ['grade', '$gte']],
      [{ measuredAt: { $lt: null } }, ['measuredAt', '$lt']], [{ measuredAt: { $gte: 'yesterday' } }, ['measuredAt', '$gte']],
      [{ title: { $gt: 'aa' } }, ['title', '$gt']], [{ state: { $lt: 'ready' } }, ['state', '$lt']],
      [{ active: { $gte: 'true' } }, ['active', '$gte']], [{ key: { $gt: '1' } }, ['key', '$gt']],
      [{ tags: { $gt: 'a' } }, ['tags']], [{ count: {} }, ['count']], [{ grade: {} }, ['grade', '$gte']],
    ] as const) {
      expect(list.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
  });

  it('documents precisely the enabled bounds and their required wire form', () => {
    const query = build({ model, filter: { count: ['$gte', '$lt'], measuredAt: ['$gt'], grade: ['$lte'] } });
    expect(query.decode({ where: { count: { $lt: '5' } } }).where).toEqual({ count: { $lt: 5 } });
    const schema = wireInputJsonSchema(query).properties?.where;
    expect(schema).toMatchObject({ type: 'object', additionalProperties: false, properties: {
      count: { minProperties: 1, additionalProperties: false, properties: { $gte: { type: 'string' }, $lt: { type: 'string' } } },
      measuredAt: { required: ['$gt'], properties: { $gt: { type: 'string' } } },
      grade: { required: ['$lte'], properties: { $lte: { type: 'string', pattern: '^P[0-9]$' } } },
    } });
    if (schema && typeof schema === 'object') {
      const count = schema.properties?.count;
      if (count && typeof count === 'object') expect(Object.keys(count.properties ?? {})).toEqual(['$gte', '$lt']);
    }
  });
});
