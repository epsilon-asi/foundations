import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Id, Readable, Tenant, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class StoredRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.string({ crud: 'tenant' }) workspaceKey!: Tenant<string>;
}
class Ticket extends StoredRecord {
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @(Prop.enum(['open', 'closed'], { crud: 'readable' })) state!: Readable<'open' | 'closed'>;
  @Prop.number({ crud: 'readable', integer: true }) rank!: Readable<number>;
  @Prop.boolean({ crud: 'readable' }) active!: Readable<boolean>;
  @Prop.date({ crud: 'readable' }) filedAt!: Readable<Date>;
  @Prop(z.string().nullable().optional(), { crud: 'readable' }) note?: Readable<string | null>;
  @Prop(z.array(z.string()).nullable(), { crud: 'readable' }) labels!: Readable<string[] | null>;
  @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
}
const model = resolve(Ticket);
const filter = { key: true, rank: ['$eq'], state: true, active: true, filedAt: true, note: true, title: ['$ilike'], labels: ['$eq'] } as const;
const uuid = '64d7ab56-28de-4f9a-8e24-92bdea512346';

describe.each([['offset', offsetListQuerySchema], ['cursor', cursorListQuerySchema]] as const)('%s scalar equality', (_mode, build) => {
  const query = build({ model, filter, sort: ['rank'], search: { fields: ['title'] } });

  it('round-trips all selected scalar types with search, ordering and paging', () => {
    const wire = { perPage: '4', q: 'ticket', orderBy: { rank: 'asc' }, where: {
      key: { $eq: uuid }, rank: { $eq: '3' }, state: { $eq: 'open' }, active: { $eq: 'yes' },
      filedAt: { $eq: '2026-08-01T11:00:00+01:00' }, note: { $eq: null },
    } } as const;
    const decoded = query.decode(wire);
    expect(decoded).toMatchObject({ ...wire, perPage: 4, where: { ...wire.where,
      rank: { $eq: 3 }, active: { $eq: true }, filedAt: { $eq: new Date('2026-08-01T10:00:00Z') },
    } });
    expect(z.encode(query, decoded)).toMatchObject({ ...wire, where: { ...wire.where,
      active: { $eq: 'true' }, filedAt: { $eq: '2026-08-01T10:00:00.000Z' },
    } });
    expect(query.decode({})).not.toHaveProperty('where');
    expect(query.decode({ where: {} }).where).toEqual({});
    expect(Object.getPrototypeOf(decoded.where!)).toBeNull();

    type Stored = NonNullable<typeof decoded.where>;
    type Wire = NonNullable<z.input<typeof query>['where']>;
    expectTypeOf<keyof Stored>().toEqualTypeOf<'key' | 'state' | 'rank' | 'active' | 'filedAt' | 'note' | 'title' | 'labels'>();
    expectTypeOf<NonNullable<Stored['filedAt']>['$eq']>().toEqualTypeOf<Date | undefined>();
    expectTypeOf<NonNullable<Wire['filedAt']>['$eq']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<Stored['note']>['$eq']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<NonNullable<Wire['state']>['$eq']>().toEqualTypeOf<'open' | 'closed' | undefined>();
    // @ts-expect-error Handlers encode the decoded numeric field.
    expect(query.safeEncode({ ...decoded, where: { rank: { $eq: '3' } } }).success).toBe(false);
    // @ts-expect-error This text field does not declare equality.
    expect(query.safeEncode({ ...decoded, where: { title: { $eq: 'book' } } }).success).toBe(false);
  });

  it('requires each supplied field to have a declared comparison and a valid value', () => {
    for (const [where, path] of [
      [{ rank: {} }, ['rank', '$eq']], [{ rank: { $eq: undefined } }, ['rank', '$eq']],
      [{ rank: undefined }, ['rank']], [{ rank: { $eq: '3.5' } }, ['rank', '$eq']],
      [{ state: { $eq: 'absent' } }, ['state', '$eq']], [{ key: { $eq: 'invalid-uuid' } }, ['key', '$eq']],
      [{ rank: { $eq: 3 } }, ['rank', '$eq']], [{ rank: { $eq: null } }, ['rank', '$eq']],
      [{ rank: { $eq: '3', $ne: '4' } }, ['rank', '$ne']], [{ $or: [] }, ['$or']],
      [{ unknown: { $eq: '3' } }, ['unknown']], [{ 'key.path': { $eq: '3' } }, ['key.path']],
      [{ labels: { $eq: [] } }, ['labels', '$eq']], [{ workspaceKey: { $eq: 'x' } }, ['workspaceKey']],
      [{ password: { $eq: 'x' } }, ['password']], [[], []],
    ] as const) {
      expect(query.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
    const where = wireInputJsonSchema(query).properties?.where;
    expect(where).toMatchObject({ type: 'object', additionalProperties: false, properties: {
      rank: { type: 'object', required: ['$eq'], additionalProperties: false, properties: { $eq: { type: 'string' } } },
    } });
    if (where && typeof where === 'object') expect(where.properties?.title).toMatchObject({ required: ['$ilike'] });
  });

  it('round-trips inequality alone or alongside equality and enforces the declared subset', () => {
    const selected = build({ model, filter: { rank: ['$ne'], note: ['$eq', '$ne'], state: true, title: ['$eq'] } });
    const decoded = selected.decode({ where: { rank: { $ne: '4' }, note: { $ne: 'archived', $eq: null }, state: { $ne: 'closed' } } });
    expect(decoded.where).toEqual({ rank: { $ne: 4 }, note: { $eq: null, $ne: 'archived' }, state: { $ne: 'closed' } });
    expect(z.encode(selected, decoded).where?.rank).toEqual({ $ne: '4' });
    expect(selected.safeParse({ where: { note: { $eq: null } } }).success).toBe(true);
    expect(selected.safeParse({ where: { note: { $ne: 'ok' } } }).success).toBe(true);
    for (const [where, path] of [
      [{ note: {} }, ['note']], [{ rank: {} }, ['rank', '$ne']], [{ note: { $ne: null } }, ['note', '$ne']],
      [{ note: { $eq: 'ok', $ne: undefined } }, ['note', '$ne']], [{ state: { $ne: 'absent' } }, ['state', '$ne']],
      [{ rank: { $ne: '4.5' } }, ['rank', '$ne']], [{ rank: { $eq: '4' } }, ['rank', '$eq']],
      [{ title: { $ne: 'hidden' } }, ['title', '$ne']],
    ] as const) {
      expect(selected.safeParse({ where }).error?.issues[0].path).toEqual(['where', ...path]);
    }
    expect(wireInputJsonSchema(selected).properties?.where).toMatchObject({ properties: {
      rank: { required: ['$ne'], additionalProperties: false, properties: { $ne: { type: 'string' } } },
      note: { minProperties: 1, additionalProperties: false, properties: { $ne: { type: 'string' } } },
    } });
    type Stored = NonNullable<z.output<typeof selected>['where']>;
    type Wire = NonNullable<z.input<typeof selected>['where']>;
    expectTypeOf<NonNullable<Stored['rank']>['$ne']>().toEqualTypeOf<number>();
    expectTypeOf<NonNullable<Wire['rank']>['$ne']>().toEqualTypeOf<string>();
    expectTypeOf<NonNullable<Stored['note']>['$ne']>().toEqualTypeOf<string | undefined>();
    // @ts-expect-error Null equality is the only comparison added to nullable scalars.
    expect(z.safeEncode(selected, { ...decoded, where: { note: { $ne: null } } }).error?.issues[0].path).toEqual(['where', 'note', '$ne']);
    // @ts-expect-error A field condition cannot omit both comparisons.
    expect(z.safeEncode(selected, { ...decoded, where: { note: {} } }).success).toBe(false);
    // @ts-expect-error Equality was not declared on this field.
    expect(z.safeEncode(selected, { ...decoded, where: { rank: { $eq: 3 } } }).success).toBe(false);
    // @ts-expect-error Inequality was not declared on this field.
    expect(z.safeEncode(selected, { ...decoded, where: { title: { $ne: 'ok' } } }).success).toBe(false);
  });

  it('keeps where off lists with no eligible model-backed declaration', () => {
    for (const schema of [
      build(), build({ model }), build({ filter }), build({ model, filter: {} }),
      build({ model, filter: { title: [], rank: [] } }),
    ]) {
      expect(schema.safeParse({ where: {} }).success).toBe(false);
      expect(wireInputJsonSchema(schema).properties).not.toHaveProperty('where');
    }
    const noComparisons = build({ model, filter: { title: [] } });
    // @ts-expect-error There is no where field for this list.
    noComparisons.shape.where;
  });
});

it('accepts declared prototype method names and rejects reserved wire keys at either level in both directions', () => {
  const field = model.fields.get('title')!;
  const names = ['title', 'toString', '__proto__', 'constructor', 'prototype'] as const;
  const fields = new Map(names.map(name => [name, field] as const));
  const query = offsetListQuerySchema({ model: { name: 'Names', fields }, filter: {
    title: true, toString: true, ['__proto__']: true, constructor: true, prototype: true,
  } });
  const page = query.decode({ where: { title: { $eq: 'book' } } });
  expect(query.encode(page).where).toEqual({ title: { $eq: 'book' } });
  expect(query.decode({ where: { toString: { $eq: 'yes' } } }).where).toEqual({ toString: { $eq: 'yes' } });
  const methodOnly = offsetListQuerySchema({ model: { name: 'Names', fields }, filter: { toString: true } });
  const empty = methodOnly.decode({ where: {} });
  expect(methodOnly.encode(empty).where).toEqual({});
  // @ts-expect-error An empty condition object still excludes unlisted fields.
  expect(methodOnly.safeEncode({ ...empty, where: { title: { $eq: 'book' } } }).success).toBe(false);
  type Keys<Fields> = Fields extends unknown ? keyof Fields : never;
  expectTypeOf<Keys<NonNullable<typeof page.where>>>().toEqualTypeOf<'title' | 'toString'>();
  // @ts-expect-error A supplied prototype-named field still requires an equality condition.
  expect(query.safeEncode({ ...page, where: { title: { $eq: 'ok' }, toString: 'wrong' } }).success).toBe(false);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const where = Object.fromEntries([[key, { $eq: 'book' }]]);
    expect(query.safeParse({ where }).error?.issues[0].path).toEqual(['where', key]);
    expect(z.safeEncode(query, { ...page, where }).error?.issues[0].path).toEqual(['where', key]);
    const condition = Object.fromEntries([['$eq', 'book'], [key, 'bad']]);
    expect(query.safeParse({ where: { title: condition } }).error?.issues[0].path).toEqual(['where', 'title', key]);
  }
});

it('keeps an empty enum condition optional while rejecting every supplied value', () => {
  class EmptyChoice {
    @Prop(z.enum([]), { crud: 'readable' }) stage!: Readable<never>;
  }
  const { name, fields } = resolve(EmptyChoice);
  const query = offsetListQuerySchema({ model: { name, fields }, filter: { stage: true } });
  expect(query.decode({ where: {} }).where).toEqual({});
  expect(query.safeParse({ where: { stage: { $eq: 'missing' } } }).success).toBe(false);
  expectTypeOf<keyof NonNullable<z.output<typeof query>['where']>>().toEqualTypeOf<'stage'>();
});

it('checks inequality before and after a two-way nullable field codec', () => {
  const field = z.codec(z.string().nullable(), z.number().nullable(), {
    decode: value => value === null ? 0 : value === 'empty' ? null : Number(value),
    encode: value => value === null ? 'empty' : value === 0 ? null : String(value),
  });
  class Score {
    @Prop(field, { crud: 'readable' }) points!: Readable<number | null>;
  }
  const list = offsetListQuerySchema({ model: resolve(Score), filter: { points: ['$ne'] } });
  const page = list.decode({ where: { points: { $ne: '7' } } });
  expect(page.where).toEqual({ points: { $ne: 7 } });
  expect(list.encode(page).where).toEqual({ points: { $ne: '7' } });
  for (const value of [null, 'empty']) {
    expect(list.safeParse({ where: { points: { $ne: value } } }).error?.issues[0].path).toEqual(['where', 'points', '$ne']);
  }
  expect(list.safeEncode({ ...page, where: { points: { $ne: 0 } } }).error?.issues[0].path).toEqual(['where', 'points', '$ne']);
});
