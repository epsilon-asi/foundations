import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../../src/endpoints/ApiDefinitionError.js';
import { crudRouteMetadata, type CrudRouteMetadata, type CrudRouteMetadataOptions } from '../../src/endpoints/crudRouteMetadata.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import type { Id, Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { crudSuccessResponseSchema, type CrudSuccessResponseSchemaOptions } from '../../src/responses/crudSuccessResponseSchema.js';
import type { EmptySuccessResponse, SuccessResponse } from '../../src/responses/success.js';
import { dateWireCodec } from '../../src/wire/date.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Person {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.date({ crud: 'readable' }) joinedAt!: Readable<Date>;
}
const routes = crudRouteMetadata({ ...resolve(Person), name: 'Person', plural: 'People', list: { paging: 'cursor' } });
const row = z.strictObject({ id: z.string(), joinedAt: dateWireCodec });
const instant = '2026-11-19T12:30:00.000Z';
const wireRow = { id: 'p-1', joinedAt: instant };
const readRow = { id: 'p-1', joinedAt: new Date(instant) };
const create = routes.find(route => route.operation === 'Create')!;
const get = routes.find(route => route.operation === 'Get')!;
const update = routes.find(route => route.operation === 'Update')!;
const remove = routes.find(route => route.operation === 'Delete')!;
const list = routes.find(route => route.operation === 'List')!;

it('uses the route status and the readable row for Create, Get and Update', () => {
  for (const route of [create, get, update]) {
    const response = crudSuccessResponseSchema({ route, row });
    expect(response.decode({ code: route.code, data: wireRow })).toEqual({ code: route.code, data: readRow });
    expect(response.encode({ code: route.code, data: readRow })).toEqual({ code: route.code, data: wireRow });
    expect(response.safeParse({ code: route.code === 201 ? 200 : 201, data: wireRow }).success).toBe(false);
    expect(response.safeParse({ code: route.code }).success).toBe(false);
    expect(response.safeParse({ code: route.code, data: { people: [wireRow], count: 1 } }).success).toBe(false);
  }
  const created = crudSuccessResponseSchema({ route: create, row });
  const updated = crudSuccessResponseSchema({ route: update, row });
  expectTypeOf<z.input<typeof created>>().toEqualTypeOf<SuccessResponse<typeof wireRow, 201>>();
  expectTypeOf<z.output<typeof created>>().toEqualTypeOf<SuccessResponse<typeof readRow, 201>>();
  expectTypeOf<z.output<typeof updated>>().toEqualTypeOf<SuccessResponse<typeof readRow, 200>>();
});

it('derives an empty Delete success and accepts a common row when mapping over all CRUD routes', () => {
  const response = crudSuccessResponseSchema({ route: remove });
  expectTypeOf<z.output<typeof response>>().toEqualTypeOf<EmptySuccessResponse<200>>();
  expect(response.decode({ code: 200, message: 'Removed' })).toEqual({ code: 200, message: 'Removed' });
  expect(response.safeParse({ code: 200, data: undefined }).success).toBe(false);
  expect(response.safeParse({ code: 201 }).success).toBe(false);
  const all = routes.map(route => crudSuccessResponseSchema({ route, row }));
  expect(all[routes.indexOf(remove)].safeParse({ code: 200, data: wireRow }).success).toBe(false);
});

it('derives the cursor List collection from the actual route and preserves the row codec in the envelope union', () => {
  expect(list.listResponse).toEqual({ name: 'Person', plural: 'People', paging: 'cursor' });
  expect(Object.isFrozen(list.listResponse)).toBe(true);
  expectTypeOf(list.listResponse).toEqualTypeOf<Readonly<{ name: 'Person'; plural: 'People'; paging: 'cursor' }>>();
  const response = crudSuccessResponseSchema({ route: list, row });
  type Data = z.output<typeof response>['data'];
  expectTypeOf<keyof Data>().toEqualTypeOf<'people' | 'nextCursor'>();
  expectTypeOf<Data['people']>().toEqualTypeOf<typeof readRow[]>();
  expectTypeOf<z.input<typeof response>['data']['people']>().toEqualTypeOf<typeof wireRow[]>();
  const union = responseTypeUnion({ response, failures: [404] });
  const wire = { code: 200 as const, data: { people: [wireRow], nextCursor: ' +/== ' } };
  expect(union.decode(wire)).toEqual({ code: 200, data: { people: [readRow], nextCursor: ' +/== ' } });
  expect(union.encode(union.decode(wire))).toEqual(wire);
  expect(response.safeParse({ code: 200, data: { people: [], count: 0 } }).success).toBe(false);
  expect(response.safeParse({ code: 200, data: wireRow }).success).toBe(false);
});

it('supplies the default plural and offset mode for a name-only List route', () => {
  const preview = crudRouteMetadata({ name: 'ApiKey' }).find(route => route.operation === 'List')!;
  const response = crudSuccessResponseSchema({ route: preview, row });
  expectTypeOf<keyof z.output<typeof response>['data']>().toEqualTypeOf<'apiKeys' | 'count'>();
  expect(response.decode({ code: 200, data: { apiKeys: [], count: 3 } })).toEqual({ code: 200, data: { apiKeys: [], count: 3 } });
});

it('requires a row for each operation that returns data', () => {
  for (const route of [create, get, update, list]) {
    // @ts-expect-error Dynamic callers must also supply the read-row schema.
    expect(() => crudSuccessResponseSchema({ route })).toThrow(/requires a row schema/);
  }
  // @ts-expect-error A Create descriptor must have its declared 201 status.
  expect(() => crudSuccessResponseSchema({ route: { ...create, code: 200 }, row })).toThrow(ApiDefinitionError);
});

function fromOptions<const Options extends CrudSuccessResponseSchemaOptions>(options: Options) {
  return crudSuccessResponseSchema(options);
}
function forResource<Options extends CrudRouteMetadataOptions, Row extends z.core.$ZodType>(route: CrudRouteMetadata<Options>, row: Row) {
  return crudSuccessResponseSchema({ route, row });
}
it('supports generic callers that supply declaration options or an enabled route and its row', () => {
  const result = fromOptions({ route: get, row });
  expectTypeOf<z.output<typeof result>>().toEqualTypeOf<SuccessResponse<typeof readRow, 200>>();
  expect(forResource(list, row).safeParse({ code: 200, data: { people: [], nextCursor: null } }).success).toBe(true);
});
