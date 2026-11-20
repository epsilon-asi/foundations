import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import {
  crudExtension, crudRouteMetadata, cursorListQuerySchema, FilterOperator, offsetListQuerySchema, resolveFilters,
  type BooleanOperator, type CrudRouteMetadataOptions, type Editable, type FilterValue, type Id, type Internal, type OffsetListQueryOptions,
  type Readable, type ResolveFiltersOptions, type Secret, type Tenant, type WriteOnly,
} from '../../src/index.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);
class RecordBase {
  @Prop.uuid({ crud: 'id' }) key!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) workspaceKey!: Tenant<string>;
}
class Ticket extends RecordBase {
  @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  @(Prop.enum(['open', 'closed'], { crud: 'readable' })) state!: Readable<'open' | 'closed'>;
  @Prop.number({ crud: 'readable', optional: true }) rank?: Readable<number>;
  @Prop(z.bigint(), { crud: 'readable' }) count!: Readable<bigint>;
  @Prop.date({ crud: 'readable' }) filedAt!: Readable<Date>;
  @Prop.boolean({ crud: 'readable' }) active!: Readable<boolean>;
  @Prop(z.array(z.string()), { crud: 'readable' }) tags!: Readable<string[]>;
  @Prop(z.array(z.string()).nullable(), { crud: 'readable' }) labels!: Readable<string[] | null>;
  @Prop.string() externalId!: string;
  @Prop.string({ crud: 'internal' }) memo!: Internal<string>;
  @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
  @Prop.string({ crud: 'secret' }) token!: Secret<string>;
  @Prop(z.json(), { crud: 'readable' }) metadata!: Readable<z.core.util.JSONType>;
  @Prop(z.object({ code: z.string() }), { crud: 'readable' }) details!: Readable<{ code: string }>;
}
const model = resolve(Ticket);
expectTypeOf<FilterValue<typeof model, 'state'>>().toEqualTypeOf<'open' | 'closed'>();
expectTypeOf<FilterValue<typeof model, 'filedAt'>>().toEqualTypeOf<Date>();
const filter = {
  key: ['$in'], title: [FilterOperator.ILike], state: ['$eq'], rank: ['$gte'], count: ['$gt'],
  filedAt: ['$lt'], active: true, tags: [], labels: ['$contains', '$eq', '$exists'],
} as const;
const filters = resolveFilters({ model, filter });
expectTypeOf<keyof typeof filters>().toEqualTypeOf<keyof typeof filter>();
expectTypeOf(filters.active.operators).toEqualTypeOf<readonly BooleanOperator[]>();
expectTypeOf(filters.state.values).toEqualTypeOf<readonly ('open' | 'closed')[]>();
const routes = crudRouteMetadata({ ...model, list: { filter, sort: ['title'] } });
const list = routes.find(route => route.operation === 'List')!;
expectTypeOf(list.Filters.title.operators).toEqualTypeOf<readonly '$ilike'[]>();
expectTypeOf(list.Filters.labels.operators).toEqualTypeOf<readonly ('$contains' | '$eq' | '$exists')[]>();

for (const query of [offsetListQuerySchema, cursorListQuerySchema]) {
  query({ model, filter, search: { fields: ['title'] }, sort: ['rank'] });
  // @ts-expect-error A field's name must match the resource.
  query({ model, filter: { titel: true } });
  // @ts-expect-error Enum fields cannot use text pattern matching.
  query({ model, filter: { state: ['$ilike'] } });
  // @ts-expect-error A numeric bound is not a boolean operator.
  query({ model, filter: { active: ['$gte'] } });
  // @ts-expect-error A non-null array cannot compare with null.
  query({ model, filter: { tags: ['$eq'] } });
  // @ts-expect-error This optional field does not accept null.
  query({ model, filter: { rank: ['$exists'] } });
  // @ts-expect-error Owned scope supplies the inherited tenant field.
  query({ model, filter: { workspaceKey: [] } });
}

// @ts-expect-error A text field cannot declare a range operator.
resolveFilters({ model, filter: { title: ['$gt'] } });
// @ts-expect-error Date fields cannot declare pattern matching.
resolveFilters({ model, filter: { filedAt: ['$like'] } });
// @ts-expect-error An ID uses equality and membership.
crudRouteMetadata({ ...model, list: { filter: { key: ['$ilike'] } } });
// @ts-expect-error Unmarked fields have no read grant.
crudRouteMetadata({ ...model, list: { filter: { externalId: true } } });
// @ts-expect-error Internal fields have no read grant.
resolveFilters({ model, filter: { memo: true } });
// @ts-expect-error Write-only fields cannot be filtered.
resolveFilters({ model, filter: { password: [] } });
// @ts-expect-error The Secret flavor hides a field from filters.
cursorListQuerySchema({ model, filter: { token: true } });
// @ts-expect-error JSON has no operator group.
offsetListQuerySchema({ model, filter: { metadata: true } });
// @ts-expect-error An object itself has no operator group.
resolveFilters({ model, filter: { details: true } });
// @ts-expect-error Declarations cover the model's immediate fields.
resolveFilters({ model, filter: { 'details.code': true } });
const extra = { ...filter, extra: true } as const;
// @ts-expect-error Variable and spread declarations still check every key.
crudRouteMetadata({ ...model, list: { filter: extra } });

// Schema previews and runtime metadata do not carry class types.
resolveFilters({ model: { name: model.name, fields: model.fields }, filter: { dynamicField: ['$ne'] } });
offsetListQuerySchema({ filter: { dynamicField: ['$ne'] } });
crudRouteMetadata({ name: 'Preview', list: { filter: { dynamicField: true } } });

function forwardFilters<const Options extends ResolveFiltersOptions>(options: Options) { return resolveFilters(options); }
function forwardQuery<const Options extends OffsetListQueryOptions>(options: Options) { return offsetListQuerySchema(options); }
function forwardCrud<const Options extends CrudRouteMetadataOptions>(options: Options) { return crudRouteMetadata(options); }
expectTypeOf(forwardFilters({ model, filter }).title.path).toEqualTypeOf<'title'>();
forwardQuery({ model, filter }).decode({});
forwardCrud({ ...model, list: { filter } });
