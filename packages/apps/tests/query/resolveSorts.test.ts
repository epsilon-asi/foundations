import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Editable, Id, Internal, Readable, Secret, WriteOnly } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { uiExtension } from '../../src/model/extensions/ui.js';
import { resolveSorts, type SortDescriptor } from '../../src/query/resolveSorts.js';
import { dateWireCodec } from '../../src/wire/date.js';

const { Prop, Type, resolve } = createTypeRegistry().use(crudExtension).use(uiExtension);

it('selects inherited and local readable scalars in declaration order and freezes their labels and paths', () => {
  class StoredRecord {
    @Prop.uuid({ crud: 'id' }) id!: Id<string>;
    @Prop.string() externalId!: string;
  }
  @Type({ name: 'CatalogItem' })
  class Item extends StoredRecord {
    @Prop.string({ crud: 'editable', ui: { label: 'catalog.itemTitle' } }) title!: Editable<string>;
    @Prop.number({ crud: 'readable', default: 1 }) rank!: Readable<number>;
    @(Prop.enum(['draft', 'live'], { crud: 'readable', optional: true })) status?: Readable<'draft' | 'live'>;
    @Prop(z.bigint().nullable().optional(), { crud: 'readable' }) count?: Readable<bigint | null>;
    @Prop(z.boolean().default(true), { crud: 'readable' }) active!: Readable<boolean>;
    @Prop(z.literal('new').or(z.literal('old')), { crud: 'readable' }) version!: Readable<'new' | 'old'>;
    @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
    @Prop.string({ crud: 'internal' }) memo!: Internal<string>;
    @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
    @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  }

  const sorts = resolveSorts(resolve(Item));
  const paths = ['id', 'title', 'rank', 'status', 'count', 'active', 'version'];
  expect(Object.keys(sorts)).toEqual(paths);
  expect(Object.values(sorts)).toEqual(paths.map(path => ({
    path, labelKey: path === 'title' ? 'catalog.itemTitle' : `catalogItem.${path}`,
  })));
  expect(Object.isFrozen(sorts)).toBe(true);
  expect(Object.values(sorts).every(Object.isFrozen)).toBe(true);
  expectTypeOf(sorts.title).toEqualTypeOf<SortDescriptor<'title'> | undefined>();
  expectTypeOf<keyof typeof sorts>().toEqualTypeOf<'id' | 'title' | 'rank' | 'status' | 'count' | 'active' | 'version'>();

  const model = resolve(Item);
  const selected = resolveSorts({ ...model, sort: ['rank', 'title', 'id', 'rank'] });
  expect(Object.keys(selected)).toEqual(['rank', 'title', 'id']);
  expect(selected.title).toEqual(sorts.title);
  expect(Object.isFrozen(selected)).toBe(true);
  expect(Object.values(selected).every(Object.isFrozen)).toBe(true);
  expectTypeOf<keyof typeof selected>().toEqualTypeOf<'rank' | 'title' | 'id'>();
  expect(resolveSorts({ ...model, sort: [] })).toEqual({});
  // @ts-expect-error A write-only field cannot be selected for sorting.
  expect(() => resolveSorts({ ...model, sort: ['password'] })).toThrow(/CatalogItem.*unreadable.*password/);
  // @ts-expect-error An array field cannot be selected for sorting.
  expect(() => resolveSorts({ ...model, sort: ['tags'] })).toThrow(/CatalogItem.*non-scalar.*tags/);
});

it('uses a codec’s decoded schema and omits objects, JSON, arrays and resource references', () => {
  class Author {
    @Prop.string({ crud: 'readable' }) name!: Readable<string>;
    @Prop.nested(() => Author, { crud: 'readable', optional: true }) editor?: Readable<Author>;
  }
  const author = vi.fn(() => Author);
  const payload = z.json().optional();
  const details = z.codec(z.string(), z.object({ text: z.string() }), {
    decode: text => ({ text }), encode: object => object.text,
  });
  class Book {
    @Prop(dateWireCodec, { crud: 'readable' }) published!: Readable<Date>;
    @Prop(details, { crud: 'readable' }) details!: Readable<{ text: string }>;
    @Prop(z.object({ title: z.string() }), { crud: 'readable' }) nested!: Readable<{ title: string }>;
    @Prop(z.array(z.number()).default([]), { crud: 'readable' }) ratings!: Readable<number[]>;
    @Prop(payload, { crud: 'readable' }) metadata?: Readable<z.output<typeof payload>>;
    @Prop.nested(author, { crud: 'readable', optional: true }) author?: Readable<Author>;
  }

  const sorts = resolveSorts(resolve(Book));
  expectTypeOf<keyof typeof sorts>().toEqualTypeOf<'published'>();
  expect(Object.keys(sorts)).toEqual(['published']);
  for (const path of ['details', 'metadata', 'author', 'author.name', 'missing']) {
    const { name, fields } = resolve(Book);
    expect(() => resolveSorts({ name, fields, sort: [path] })).toThrow(`field "${path}"`);
  }
  expect(author).toHaveBeenCalledTimes(0);
});

it('supports field-map lookups and treats prototype property names as ordinary declarations', () => {
  class Tags {
    @Prop.string({ crud: 'readable' }) ['__proto__']!: string;
  }
  const model = resolve(Tags);
  const fields = new Map([['__proto__', model.fields.get('__proto__')!] as const]);
  const sorts = resolveSorts({ name: model.name, fields });
  expect(Object.getPrototypeOf(sorts)).toBeNull();
  expect(sorts.__proto__).toEqual({ path: '__proto__', labelKey: 'tags.__proto__' });
  expectTypeOf(sorts.__proto__).toEqualTypeOf<SortDescriptor<'__proto__'> | undefined>();
});
