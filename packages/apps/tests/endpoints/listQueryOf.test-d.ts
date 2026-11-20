import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { endpointRouteContract } from '../../src/endpoints/endpointRouteContract.js';
import type { ListQueryOf, RequestContentOf, RequestOf } from '../../src/endpoints/endpointTypes.js';
import type { Readable } from '../../src/model/access.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { cursorListQuerySchema } from '../../src/query/cursorListQuerySchema.js';
import { offsetListQuerySchema } from '../../src/query/offsetListQuerySchema.js';
import { transitionRouteMetadata } from '../../src/state/transitionRouteMetadata.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class Report {
  @Prop.string({ crud: 'readable' }) title!: Readable<string>;
  @Prop.date({ crud: 'readable' }) filedAt!: Readable<Date>;
}
const offset = offsetListQuerySchema({ model: resolve(Report), filter: { filedAt: ['$gte'] }, sort: ['filedAt'], search: { fields: ['title'] } });
const routes = crudRouteMetadata({ name: 'Report', parent: { name: 'Catalog' } });
const list = routes.find(route => route.operation === 'List')!;
const get = routes.find(route => route.operation === 'Get')!;
const params = z.strictObject({ catalogId: z.string() });
const empty = z.strictObject({});
const ListReports = {
  ...endpointRouteContract(list),
  Request: offset.extend(params.shape),
  RequestContent: z.strictObject({ params, query: offset, body: empty, headers: z.strictObject({ tenant: z.string() }) }),
};
type Offset = ListQueryOf<typeof ListReports>;
expectTypeOf<Offset>().toEqualTypeOf<z.output<typeof offset>>();
expectTypeOf<keyof Offset>().toEqualTypeOf<'page' | 'perPage' | 'q' | 'where' | 'orderBy'>();
expectTypeOf<Offset['perPage']>().toEqualTypeOf<number>();
expectTypeOf<keyof NonNullable<Offset['orderBy']>>().toEqualTypeOf<'filedAt'>();
type Condition = NonNullable<NonNullable<Offset['where']>['filedAt']>;
expectTypeOf<Condition>().toMatchTypeOf<{ $gte: Date }>();
expectTypeOf<keyof Condition>().toEqualTypeOf<'$gte'>();
expectTypeOf<RequestOf<typeof ListReports>['catalogId']>().toEqualTypeOf<string>();
expectTypeOf<RequestContentOf<typeof ListReports>['query']['perPage']>().toEqualTypeOf<string | undefined>();
// @ts-expect-error A parent path parameter does not belong to the query.
const withParent: Offset = { page: 0, perPage: 10, catalogId: '1' };
// @ts-expect-error A decoded range operand must be a date.
const encodedDate: Offset = { page: 0, perPage: 10, where: { filedAt: { $gte: '2026-11-01T00:00:00Z' } } };

const cursor = cursorListQuerySchema();
const CursorReports = { ...list, RequestContent: z.strictObject({ params, query: cursor }) };
type Cursor = ListQueryOf<typeof CursorReports>;
expectTypeOf<Cursor>().toEqualTypeOf<{ perPage: number; cursor?: string | undefined }>();
expectTypeOf<ListQueryOf<typeof CursorReports | typeof ListReports>>().toEqualTypeOf<Cursor | Offset>();
expectTypeOf<ListQueryOf<never>>().toBeNever();
type Content = typeof ListReports.RequestContent;
type GenericList<Query> = { readonly RequestContent: z.core.$ZodType<{ readonly query: Query }> };
expectTypeOf<ListQueryOf<GenericList<Cursor>>>().toEqualTypeOf<Cursor>();
expectTypeOf<ListQueryOf<GenericList<unknown>>>().toBeUnknown();
expectTypeOf<ListQueryOf<{ RequestContent: Content; Route: unknown }>>().toEqualTypeOf<Offset>();
expectTypeOf<ListQueryOf<{ Route: typeof get; RequestContent: Content }>>().toBeNever();
expectTypeOf<ListQueryOf<typeof get & { RequestContent: Content }>>().toBeNever();
const archive = transitionRouteMetadata({ name: 'Report', verb: 'archive' });
expectTypeOf<ListQueryOf<typeof archive & { RequestContent: Content }>>().toBeNever();
expectTypeOf<ListQueryOf<{ Route: typeof archive; RequestContent: Content }>>().toBeNever();
expectTypeOf<ListQueryOf<{ Kind: 'action'; RequestContent: Content }>>().toBeNever();
expectTypeOf<ListQueryOf<{ Kind: 'crud' | 'stream'; Route: { kind: string }; RequestContent: Content }>>().toEqualTypeOf<Offset>();
// @ts-expect-error Route metadata alone does not carry a query schema.
type NoContent = ListQueryOf<typeof list>;
// @ts-expect-error The decoded request content must contain a query section.
type NoQuery = ListQueryOf<{ RequestContent: typeof params }>;
