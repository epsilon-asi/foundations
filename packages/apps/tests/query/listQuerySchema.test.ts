import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import type { Id, Readable, Secret } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { DEFAULT_LIST_PAGING, listQuerySchema, type ListPaging, type ListQuerySchemaOptions } from '../../src/query/listQuerySchema.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Offering {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @Prop.date({ crud: 'readable' }) availableAt!: Readable<Date>;
  @Prop.string({ crud: 'secret' }) secret!: Secret<string>;
}
const model = resolve(Offering);
const caps = {
  perPage: { default: 2, max: 5 },
  search: { fields: ['title'] },
  sort: ['title'],
  filter: { availableAt: ['$gte'] },
} as const;

it('uses offset paging for omitted, undefined and explicit offset declarations', () => {
  expect(DEFAULT_LIST_PAGING).toBe('offset');
  for (const schema of [listQuerySchema(), listQuerySchema(undefined), listQuerySchema({}), listQuerySchema({ paging: 'offset' })]) {
    expect(schema.decode({})).toEqual({ page: 0, perPage: 20 });
    expect(schema.safeParse({ cursor: 'next' }).success).toBe(false);
    expectTypeOf<z.output<typeof schema>>().toEqualTypeOf<{ page: number; perPage: number }>();
    expectTypeOf<z.input<typeof schema>>().toEqualTypeOf<{ page?: string | undefined; perPage?: string | undefined }>();
  }
});

it.each(['offset', 'cursor'] as const)('preserves list capabilities and page-size limits with %s paging', paging => {
  const list = { paging, ...caps };
  expect(crudRouteMetadata({ ...model, list }).find(route => route.operation === 'List')?.Sorts.title?.path).toBe('title');
  const schema = listQuerySchema({ model, ...list });
  const location = paging === 'cursor' ? { cursor: ' next:+/%2F== ' } : { page: '4' };
  const date = '2026-11-19T12:30:00.000Z';
  const wire = { ...location, perPage: '5', q: 'x', orderBy: { title: 'desc' }, where: { availableAt: { $gte: date } } } as const;
  const parsed = schema.decode(wire);
  expect(parsed.perPage).toBe(5);
  expect(parsed.where?.availableAt?.$gte).toEqual(new Date(date));
  expectTypeOf(parsed.where?.availableAt?.$gte).toEqualTypeOf<Date | undefined>();
  expectTypeOf(parsed.orderBy?.title).toEqualTypeOf<'asc' | 'desc' | undefined>();
  expectTypeOf(parsed.q).toEqualTypeOf<string | undefined>();
  expect(z.encode(schema, parsed)).toEqual(wire);
  expect(schema.decode({}).perPage).toBe(2);
  expect(schema.safeParse({ perPage: '6' }).error?.issues[0].path).toEqual(['perPage']);
  expect(schema.safeParse(paging === 'cursor' ? { page: '0' } : { cursor: 'next' }).success).toBe(false);
  expect(schema.safeParse({ orderBy: { availableAt: 'asc' } }).success).toBe(false);
  expect(schema.safeParse({ where: { availableAt: { $lt: date } } }).success).toBe(false);
});

it('keeps cursor paging strict and caps an omitted page size', () => {
  const cursor = listQuerySchema({ paging: 'cursor', perPage: { max: 3 } });
  expectTypeOf<z.output<typeof cursor>>().toEqualTypeOf<{ cursor?: string | undefined; perPage: number }>();
  expectTypeOf<z.input<typeof cursor>>().toEqualTypeOf<{ cursor?: string | undefined; perPage?: string | undefined }>();
  expect(cursor.decode({})).toEqual({ perPage: 3 });
  expect(cursor.safeParse({ q: 'x' }).success).toBe(false);
  expect(cursor.safeParse({ where: {} }).success).toBe(false);
  expect(cursor.safeParse({ orderBy: {} }).success).toBe(false);
});

it.each([null, false, '', 'pages'])('rejects unsupported paging declarations at both declaration entry points', paging => {
  // @ts-expect-error Dynamic application declarations are checked at runtime too.
  expect(() => listQuerySchema({ paging })).toThrow(ApiDefinitionError);
  // @ts-expect-error CRUD uses the same paging declaration.
  expect(() => crudRouteMetadata({ name: 'Offering', list: { paging } })).toThrow(/paging.*offset.*cursor/);
});

it('checks page-size configuration when the resource declares its list', () => {
  for (const paging of ['offset', 'cursor'] as const) {
    const list = { paging, perPage: { default: 6, max: 5 } };
    expect(() => listQuerySchema(list)).toThrow('perPage.default must be less than or equal to perPage.max');
    expect(() => crudRouteMetadata({ ...model, list })).toThrow('perPage.default must be less than or equal to perPage.max');
  }
});

type Offset = { page: number; perPage: number };
type Cursor = { cursor?: string | undefined; perPage: number };
function fromSettings(settings: { paging?: ListPaging } | undefined) {
  const schema = listQuerySchema(settings);
  expectTypeOf<z.output<typeof schema>>().toEqualTypeOf<Offset | Cursor>();
  return schema;
}
it('selects the declared mode from optional, widened and generic settings', () => {
  expect(fromSettings(undefined).parse({})).toEqual({ page: 0, perPage: 20 });
  expect(fromSettings({ paging: 'cursor' }).parse({})).toEqual({ perPage: 20 });
  function forward<const Options extends ListQuerySchemaOptions>(options: Options) {
    return listQuerySchema(options);
  }
  const cursor = forward({ paging: 'cursor', search: caps.search });
  expectTypeOf<z.output<typeof cursor>>().toEqualTypeOf<{ cursor?: string | undefined; perPage: number; q?: string | undefined }>();
});

it('checks the selected model fields and operators for either paging mode', () => {
  for (const paging of ['offset', 'cursor'] as const) {
    const search = { fields: ['oldTitle'] } as const;
    // @ts-expect-error The public selector rejects a stale field name, even in saved search settings.
    expect(() => listQuerySchema({ model, paging, search })).toThrow(/undeclared.*oldTitle/);
    // @ts-expect-error Secret fields have no read grant.
    expect(() => listQuerySchema({ model, paging, sort: ['secret'] })).toThrow(/unreadable.*secret/);
    // @ts-expect-error The date field has range operators.
    expect(() => listQuerySchema({ model, paging, filter: { availableAt: ['$ilike'] } })).toThrow();
  }
});
