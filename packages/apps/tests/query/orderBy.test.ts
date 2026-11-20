import { createTypeRegistry } from '@epsilon-asi/foundation';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { Editable, Id, Readable, Secret } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { SortDirection } from '../../src/query/sortDirection.js';
import { wireInputJsonSchema } from '../../src/wire/wireInputJsonSchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class BaseRecord {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
}
class Offering extends BaseRecord {
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  @Prop.number({ crud: 'readable', optional: true }) rank?: Readable<number>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
}
const model = resolve(Offering);

describe.each([
  ['offset', offsetListQuerySchema],
  ['cursor', cursorListQuerySchema],
] as const)('%s list ordering', (_mode, build) => {
  const list = build({ model, sort: true, search: { fields: ['title'] } });

  it('keeps every requested sort in priority order through decode and encode, alongside search', () => {
    const orderBy = { rank: SortDirection.Desc, key: SortDirection.Asc, title: 'desc' } as const;
    const decoded = list.decode({ q: 'book', orderBy });
    expect(decoded).toMatchObject({ q: 'book', orderBy });
    expect(Object.keys(decoded.orderBy!)).toEqual(['rank', 'key', 'title']);
    const encoded = z.encode(list, decoded);
    expect(Object.entries(encoded.orderBy!)).toEqual(Object.entries(orderBy));
    expect(decoded.orderBy).not.toBe(orderBy);
    expect(list.decode({})).not.toHaveProperty('orderBy');
    expect(list.decode({ orderBy: {} }).orderBy).toStrictEqual({});

    type Ordering = { key?: SortDirection; title?: SortDirection; rank?: SortDirection };
    expectTypeOf<z.input<typeof list>['orderBy']>().toEqualTypeOf<Ordering | undefined>();
    expectTypeOf<z.output<typeof list>['orderBy']>().toEqualTypeOf<Ordering | undefined>();
  });

  it('rejects a hidden, nonscalar or unknown key and a bad direction at the supplied field', () => {
    for (const path of ['unknown', 'token', 'tags', 'key.child', '__proto__', 'prototype', 'constructor']) {
      const orderBy = Object.fromEntries([['title', 'asc'], [path, 'desc']]);
      expect(list.safeParse({ orderBy }).error?.issues[0].path).toEqual(['orderBy', path]);
    }
    expect(list.safeParse({ orderBy: { rank: 'up' } }).error?.issues[0].path).toEqual(['orderBy', 'rank']);
    expect(list.safeParse({ orderBy: [] }).error?.issues[0].path).toEqual(['orderBy']);
    const firstPage = list.decode({});
    // @ts-expect-error Each selected key must have a declared sort direction.
    expect(z.safeEncode(list, { ...firstPage, orderBy: { rank: 'up' } }).success).toBe(false);
    // @ts-expect-error Write-only and secret fields are absent from the typed order.
    expect(z.safeEncode(list, { ...firstPage, orderBy: { token: 'asc' } }).success).toBe(false);
  });

  it('requires sorting and model metadata before accepting orderBy', () => {
    for (const schema of [build(), build({ model }), build({ sort: true })]) {
      expect(schema.safeParse({ orderBy: { title: 'asc' } }).success).toBe(false);
    }
    const sorted = build({ model, sort: true });
    expect(sorted.decode({ orderBy: { title: 'asc' } }).orderBy).toEqual({ title: 'asc' });
    expect(sorted.safeParse({ q: 'book' }).success).toBe(false);
  });

  it('admits only explicitly sorted fields and applies them in the request’s priority order', () => {
    const selected = build({ model, sort: ['title', 'rank'], search: { fields: ['title'] } });
    const wire = { q: 'book', orderBy: { rank: 'desc', title: 'asc' } } as const;
    const decoded = selected.decode(wire);
    expect(Object.entries(z.encode(selected, decoded).orderBy!)).toEqual(Object.entries(wire.orderBy));
    expectTypeOf<keyof NonNullable<typeof decoded.orderBy>>().toEqualTypeOf<'title' | 'rank'>();
    expect(selected.safeParse({ orderBy: { key: 'asc' } }).error?.issues[0].path).toEqual(['orderBy', 'key']);
    // @ts-expect-error The readable ID is outside the declared allowlist.
    expect(z.safeEncode(selected, { ...decoded, orderBy: { key: 'asc' } }).success).toBe(false);
    // @ts-expect-error A secret field cannot appear in the sort declaration.
    expect(() => build({ model, sort: ['token'] })).toThrow(/Offering.*unreadable.*token/);
    // @ts-expect-error A field must be declared on the resource.
    expect(() => build({ model, sort: ['typo'] })).toThrow(/Offering.*undeclared.*typo/);
    expect(build({ model, sort: [] }).safeParse({ orderBy: { title: 'asc' } }).success).toBe(false);
    expect(build({ sort: ['title'] }).safeParse({ orderBy: { title: 'asc' } }).success).toBe(false);
  });
});

it('rejects reserved wire names even when declared and preserves ordinary prototype property names', () => {
  const paths = ['__proto__', 'prototype', 'constructor', 'toString'] as const;
  const readable = model.fields.get('title')!;
  const fields = new Map(paths.map(path => [path, readable] as const));
  const list = offsetListQuerySchema({ model: { name: 'Names', fields }, sort: true });
  expect(list.decode({ orderBy: { toString: 'desc' } }).orderBy).toStrictEqual({ toString: 'desc' });
  for (const name of ['__proto__', 'prototype', 'constructor']) {
    const orderBy = { toString: SortDirection.Desc, ...Object.fromEntries([[name, 'asc']]) };
    expect(list.safeParse({ orderBy }).error?.issues[0].path).toEqual(['orderBy', name]);
    expect(list.safeEncode({ page: 0, perPage: 10, orderBy }).error?.issues[0].path).toEqual(['orderBy', name]);
  }
  expectTypeOf<keyof NonNullable<z.output<typeof list>['orderBy']>>().toEqualTypeOf<'toString'>();
  expect(wireInputJsonSchema(list).properties?.orderBy).toMatchObject({
    type: 'object', propertyNames: { enum: ['toString'] }, additionalProperties: { enum: ['asc', 'desc'] },
  });
  const selected = offsetListQuerySchema({ model: { name: 'Names', fields }, sort: ['toString', '__proto__'] });
  expect(selected.decode({ orderBy: { toString: 'asc' } }).orderBy).toEqual({ toString: 'asc' });
  const orderBy = Object.fromEntries([['__proto__', 'asc']]);
  expect(selected.safeParse({ orderBy }).error?.issues[0].path).toEqual(['orderBy', '__proto__']);
  expectTypeOf<keyof NonNullable<z.output<typeof selected>['orderBy']>>().toEqualTypeOf<'toString'>();
});

it('allows a declared prototype method name to be omitted independently of ordinary sort fields', () => {
  const readable = model.fields.get('title')!;
  const paths = ['title', 'toString', 'valueOf'] as const;
  const fields = new Map(paths.map(path => [path, readable] as const));
  const list = cursorListQuerySchema({ model: { name: 'Names', fields }, sort: true });
  expect(list.encode({ perPage: 2, orderBy: { title: 'asc' } }).orderBy).toEqual({ title: 'asc' });
  expect(list.decode({ orderBy: { valueOf: 'desc', title: 'asc' } }).orderBy).toEqual({ valueOf: 'desc', title: 'asc' });
  // @ts-expect-error A supplied prototype-named field also requires asc or desc.
  expect(list.safeEncode({ perPage: 2, orderBy: { title: 'asc', toString: 'up' } }).success).toBe(false);
  // @ts-expect-error Supporting prototype-named fields keeps the allowed paths literal.
  expect(list.safeEncode({ perPage: 2, orderBy: { title: 'asc', other: 'desc' } }).success).toBe(false);
});
