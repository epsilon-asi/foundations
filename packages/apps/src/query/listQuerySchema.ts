import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { selectOperationFields } from '../model/selectOperationFields.js';
import type { ReadModel } from '../model/types.js';
import { orderBySchema } from './orderBySchema.js';
import type { OffsetPaginationDefaultsOptions } from './pagination.js';
import { resolveFilters, type CheckedFilters, type ResolveFiltersOptions } from './resolveFilters.js';
import { declaredSorts, type CheckedSort, type ResolvedSorts, type ResolveSortsOptions, type SortSource } from './resolveSorts.js';
import { searchQuerySchema } from './search.js';
import { whereComparisonSchema, type WhereComparisonOptions, type WhereComparisonSchema } from './whereComparisonSchema.js';

const searchDeclaration = z.object({
  fields: z.array(z.string()).readonly(),
  mode: z.literal('text').optional(),
});

export interface ListQueryOptions extends OffsetPaginationDefaultsOptions, ResolveFiltersOptions {
  /** Adds the optional q field. Search mode defaults to 'text'. */
  search?: z.output<typeof searchDeclaration>;
  /** Adds orderBy for all immediate readable scalars or for the fields named in the allowlist. */
  sort?: ResolveSortsOptions['sort'];
}

// An erased object or open dictionary has no fixed set of field names to check.
type SearchField<Instance> = [keyof Instance] extends [never] ? string : string extends keyof Instance ? string :
  keyof ReadModel<Instance> & string;

/** The model's immediate readable fields, or runtime-checked names when its class type is unavailable. */
export type CheckedSearch<Instance> = {
  search?: { fields: readonly NoInfer<SearchField<Instance>>[] };
};

/** Checks the list's search declaration against the resource's readable fields when available. */
export function assertSearchDeclaration({ search, model }: Pick<ListQueryOptions, 'search' | 'model'>): void {
  if (search === undefined) return;
  const { fields } = searchDeclaration.parse(search);
  if (model === undefined) return;
  const readable = selectOperationFields({ fields: model.fields, operation: 'read' });
  for (const field of fields) {
    if (readable.has(field)) continue;
    const reason = model.fields.has(field) ? 'unreadable' : 'undeclared';
    throw new ApiDefinitionError(`Search on resource "${model.name}" includes the ${reason} field "${field}".`);
  }
}

type QueryObject<Shape extends z.core.$ZodShape> = z.ZodObject<Shape, z.core.$strict>;
type SearchShape = { q: z.ZodOptional<typeof searchQuerySchema> };

// A declaration with an optional capability can produce either schema.
type WhenPresent<Options, Key extends string, Present, Absent> = Key extends keyof Options
  ? Options[Key] extends undefined ? Absent : undefined extends Options[Key] ? Present | Absent : Present
  : Absent;
type QueryWithSort<Shape extends z.core.$ZodShape, Options extends ListQueryOptions> = WhenPresent<Options, 'sort',
  WhenPresent<Options, 'model', QueryObject<Shape & {
    orderBy: z.ZodOptional<ReturnType<typeof orderBySchema<ResolvedSorts<NonNullable<Options['model']>, NonNullable<Options['sort']>>>>>;
  }>, QueryObject<Shape>>, QueryObject<Shape>>;

type QueryWithWhere<Shape extends z.core.$ZodShape, Options extends ListQueryOptions, Where = WhereComparisonSchema<Options['model'], Options['filter']>> =
  [Where] extends [never] ? QueryWithSort<Shape, Options> : WhenPresent<Options, 'filter', WhenPresent<Options, 'model',
    QueryWithSort<Shape & { where: z.ZodOptional<Extract<Where, z.ZodType>> }, Options>, QueryWithSort<Shape, Options>>, QueryWithSort<Shape, Options>>;

export type ResolvedListQuerySchema<Shape extends z.core.$ZodShape, Options> = Options extends ListQueryOptions
  ? WhenPresent<Options, 'search', QueryWithWhere<Shape & SearchShape, Options>, QueryWithWhere<Shape, Options>>
  : QueryObject<Shape>;

type CheckedList<Instance, Name extends string, FilterPath extends string> =
  { model?: SortSource<Instance, Name> } & CheckedSort<Instance, Name> & CheckedFilters<Instance, FilterPath> & CheckedSearch<Instance>;

interface ListQueryFieldsOptions extends WhereComparisonOptions {
  sorts?: Readonly<object>;
  search?: ListQueryOptions['search'];
}

/** Both paging builders and the HTTP contract use the same resolved capabilities. */
export function listQueryFields({ sorts, search, ...comparison }: ListQueryFieldsOptions) {
  const where = whereComparisonSchema(comparison);
  return {
    ...(search === undefined ? {} : { q: searchQuerySchema.optional() }),
    ...(sorts ? { orderBy: orderBySchema(sorts).optional() } : {}),
    ...(where ? { where: where.optional() } : {}),
  };
}

/** Adds the declared search, sort and filter fields to either paging mode. */
export function createListQuerySchema<Shape extends z.core.$ZodShape>(
  pagingSchema: (options: OffsetPaginationDefaultsOptions) => z.ZodObject<Shape, z.core.$strict>,
) {
  function schema<const Options extends ListQueryOptions | undefined = undefined, Instance = unknown, Name extends string = string, FilterPath extends string = string>(
    ...args: [options: Options & (CheckedList<Instance, Name, FilterPath> | undefined)] | (undefined extends Options ? [] : never)
  ): ResolvedListQuerySchema<Shape, Options>;
  function schema(options: ListQueryOptions = {}) {
    const paging = pagingSchema(options);
    assertSearchDeclaration(options);
    return paging.extend(listQueryFields({
      model: options.model, filters: resolveFilters(options), sorts: declaredSorts(options), search: options.search,
    }));
  }
  return schema;
}
