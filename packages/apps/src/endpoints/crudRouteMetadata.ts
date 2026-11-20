import { validatedCrudOperations, type CheckedFieldWriteAccess, type CrudAccessMap, type CrudRouteAccess } from '../access/crudAccess.js';
import { assertFieldPatchModes } from '../model/assertFieldPatchModes.js';
import type { Constructor } from '@epsilon-asi/foundation';
import type { IdKey } from '../model/types.js';
import { assertResourceOwner, type AssertResourceOwnerOptions } from '../model/assertResourceOwner.js';
import { resolveCrudIdField, type ResolveCrudIdFieldOptions } from '../model/resolveCrudIdField.js';
import { resolveTenantField } from '../model/resolveTenantField.js';
import { assertSearchDeclaration, resolveListPaging, type CheckedSearch, type DeclaredListPaging, type ListQuerySchemaOptions } from '../query/listQuerySchema.js';
import { offsetPaginationDefaults } from '../query/pagination.js';
import { resolveFilters, type CheckedFilters, type ResolvedFilters } from '../query/resolveFilters.js';
import { declaredSorts, type CheckedSort, type ResolvedSorts, type SortSource } from '../query/resolveSorts.js';
import { resolveEndpointPrincipals, type ResolveEndpointPrincipalsOptions } from '../tenancy/endpointPrincipals.js';
import { defaultEndpointScope, EndpointScope, endpointScopeSchema, type DeclaredScope, type TenancyScopeOf } from '../tenancy/endpointScope.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { assertOptionNamesAvailable } from './assertOptionNamesAvailable.js';
import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { assertUniqueRoutes, type RouteDeclaration } from './assertUniqueRoutes.js';
import { crudEndpointNames } from './crudEndpointNames.js';
import { CRUD_OPERATIONS } from './crudOperations.js';
import { crudPaths, type CrudPathsOptions } from './crudPaths.js';
import type { DeclaredOption } from './declaredOption.js';
import { crudOperationOverride, type CrudOperation, type EnabledCrudOperationsOptions, type EnabledCrudSetting } from './enabledCrudOperations.js';
import { DEFAULT_ENDPOINT_DOCS, resolveEndpointDocs } from './endpointDocs.js';
import { itemParamName } from './itemParamName.js';
import { pluralResourceName, type PluralName } from './resourceNames.js';

export { DEFAULT_ENDPOINT_DOCS };

const emptySorts = Object.freeze(Object.create(null) as Record<never, never>);

type PrincipalSettings = Pick<ResolveEndpointPrincipalsOptions, 'principals' | 'tool'>;

export interface CrudRouteMetadataOptions extends CrudPathsOptions, EnabledCrudOperationsOptions, AssertResourceOwnerOptions, PrincipalSettings {
  /** Shared resources require an explicit rule for each enabled operation. */
  access?: CrudAccessMap;
  /** Enabled CRUD routes require one ID. Tenant-owned models require one Tenant field. */
  fields?: ResolveCrudIdFieldOptions['fields'];
  /** Paging, field filters, search fields and sorting for the resource's List operation. */
  list?: (object | Record<string, unknown>) & Omit<ListQuerySchemaOptions, 'model'>;
  /** OpenAPI visibility for enabled operations. Default: true. */
  docs?: boolean;
  /** Default endpoint scope. Derived from the resource's tenancy when omitted. */
  scope?: EndpointScope;
  /** Receives resource naming warnings. Default: console.warn. */
  warn?: (message: string) => void;
}

type RouteSettings = Required<Pick<CrudRouteMetadataOptions, 'docs' | 'scope'>>;

// An optional declaration can supply a value. A key absent from a literal cannot.
type DeclaredValue<Options, Key extends PropertyKey> = NonNullable<DeclaredOption<Options, Key>>;
type ListSorts<Options extends CrudRouteMetadataOptions, Fields = DeclaredValue<Options, 'fields'>> =
  [Fields] extends [never] ? Readonly<object>
    : ResolvedSorts<Options & { fields: Fields }, DeclaredValue<Options['list'], 'sort'>>;

type ResourceScope<Options> = DeclaredScope<Options, TenancyScopeOf<Options>>;

declare const generatedParams: unique symbol;
declare const generatedItemParams: unique symbol;

/** A generated collection template whose only possible parameter is supplied by its parent. */
export type CrudCreatePath<Template extends string, Param extends string> = Template & { readonly [generatedParams]?: Param };

/** A generated item template carrying all its known path parameter names. */
export type CrudItemPath<Template extends string, Params extends string> = Template & { readonly [generatedItemParams]?: Params };

/** A union or open set of names leaves the actual parameter to runtime validation. */
export type SingleCreateField<Name extends string, All = Name> = Name extends unknown
  ? [All] extends [Name] ? {} extends Record<Name, unknown> ? string : Name : string : never;

/** Foreign, widened or alternative paths leave their parameter locations to runtime validation. */
export type CreatePathParamNames<Path extends string, All = Path> = Path extends unknown ? [All] extends [Path]
  ? typeof generatedParams extends keyof Path ? SingleCreateField<Exclude<Path[typeof generatedParams], undefined> & string> : string
  : string : never;

export type BoundPathParamNames<Path extends string, All = Path> = Path extends unknown ? [All] extends [Path]
  ? typeof generatedItemParams extends keyof Path ? Exclude<Path[typeof generatedItemParams], undefined> & string : CreatePathParamNames<Path>
  : string : never;

type CreatePath<Parent> = unknown extends Parent ? string : [Parent] extends [undefined] ? CrudCreatePath<`/${string}`, never> :
  undefined extends Parent ? string : Parent extends { name: infer Name extends string }
    ? string extends Name ? string : CrudCreatePath<`/${string}/:${ReturnType<typeof itemParamName<Name>>}/${string}`, ReturnType<typeof itemParamName<Name>>> : string;

type ItemParam<Options extends CrudRouteMetadataOptions> = ReturnType<typeof itemParamName<Options['name']>>;
type ItemPath<Options extends CrudRouteMetadataOptions, Tenancy = DeclaredOption<Options, 'tenancy'>,
  Parent = DeclaredOption<Options, 'parent'>, Item extends string = ItemParam<Options>> =
  [Tenancy] extends ['self'] ? CrudItemPath<`/${string}`, never> : 'self' extends Tenancy ? string :
  string extends SingleCreateField<Options['name']> ? string :
  [Parent] extends [undefined] ? CrudItemPath<`/${string}/:${Item}`, Item> : undefined extends Parent ? string :
  Parent extends { name: infer Name extends string } ? string extends SingleCreateField<Name> ? string :
    CrudItemPath<`/${string}/:${ReturnType<typeof itemParamName<Name>>}/${string}/:${Item}`, ReturnType<typeof itemParamName<Name>> | Item>
  : string;

type ModelIdName<Options, Keys = Options extends { target: Constructor<infer Instance> } ? IdKey<Instance> & string : never> =
  [Keys] extends [never] ? string : Extract<Keys, string>;
type RouteParamFields<Options extends CrudRouteMetadataOptions, Op extends CrudOperation, Tenancy = DeclaredOption<Options, 'tenancy'>> =
  Op extends 'Create' | 'List' ? { paramFields?: undefined } : [Tenancy] extends ['self'] ? { paramFields?: undefined } :
  [DeclaredOption<Options, 'fields'>] extends [undefined] ? { paramFields?: undefined } :
  'self' extends Tenancy ? Pick<PathRequestFieldsOptions, 'paramFields'> : Options extends { fields: ResolveCrudIdFieldOptions['fields'] }
    ? { paramFields: Readonly<Record<ItemParam<Options>, ModelIdName<Options>>> } : Pick<PathRequestFieldsOptions, 'paramFields'>;

/** Resolved resource naming and paging used by the List success payload. */
export interface CrudListResponseDeclaration<Options extends CrudRouteMetadataOptions = CrudRouteMetadataOptions> {
  readonly name: Options['name'];
  readonly plural: PluralName<Options>;
  readonly paging: DeclaredListPaging<DeclaredOption<Options, 'list'>>;
}

type OperationMetadata<Options extends CrudRouteMetadataOptions, Op extends CrudOperation> = {
  name: ReturnType<typeof crudEndpointNames<Options>>[Op];
  scope: DeclaredScope<EnabledCrudSetting<Options, Op>, ResourceScope<Options>>;
} & CrudRouteAccess<Options, Op> & (Op extends 'List' ? {
  Filters: ResolvedFilters<Options, NonNullable<Options['list']>['filter']>;
  Sorts: ListSorts<Options>;
  readonly listResponse: CrudListResponseDeclaration<Options>;
} : object);

/** The named route descriptor for a CRUD operation in each declaration that can enable it. */
export type CrudOperationMetadata<Options extends CrudRouteMetadataOptions, Op extends CrudOperation> = Omit<RouteDeclaration, 'path'> & RouteSettings & {
  kind: 'crud';
  /** Set on endpoints exposed as tools. */
  tool?: true;
  /** Public endpoints omit the authenticated principal list. */
  principals?: PrincipalSettings['principals'];
} & {
  [Selected in Op]: {
    operation: Selected;
    path: Selected extends 'Create' | 'List' ? CreatePath<DeclaredOption<Options, 'parent'>> : ItemPath<Options>;
  } & RouteParamFields<Options, Selected> & (typeof CRUD_OPERATIONS)[Selected]
    & (Options extends unknown ? [EnabledCrudSetting<Options, Selected>] extends [never]
      ? never : OperationMetadata<Options, Selected> : never);
}[Op];

/** An enabled route with the export name and HTTP contract for its operation. */
export type CrudRouteMetadata<Options extends CrudRouteMetadataOptions = CrudRouteMetadataOptions> = {
  [Op in CrudOperation]: CrudOperationMetadata<Options, Op>;
}[CrudOperation];

interface ResolveRouteSettingsOptions {
  name: string;
  settings?: Partial<RouteSettings> | boolean;
  defaults: RouteSettings;
}

function principalSetting<Key extends keyof PrincipalSettings>(settings: PrincipalSettings | boolean | undefined, key: Key) {
  return typeof settings === 'object' && Object.hasOwn(settings, key) ? settings[key] : undefined;
}

function resolveRouteSettings({ name, settings, defaults }: ResolveRouteSettingsOptions): RouteSettings {
  if (typeof settings !== 'object') return defaults;
  assertOptionNamesAvailable(settings);
  const docs = resolveEndpointDocs({ name, settings, fallback: defaults.docs });
  const scope = Object.hasOwn(settings, 'scope') ? settings.scope : undefined;
  const parsed = endpointScopeSchema.safeParse(scope === undefined ? defaults.scope : scope);
  if (!parsed.success) {
    throw new ApiDefinitionError(`The scope option on "${name}" must be one of ${Object.values(EndpointScope).join(', ')}.`);
  }
  return { docs, scope: parsed.data };
}

/** Assembles route metadata in the order of the enabled CRUD operations. */
export function crudRouteMetadata<const Options extends CrudRouteMetadataOptions, Instance = unknown, Name extends string = string, FilterPath extends string = string>(
  options: Options & SortSource<Instance, Name> & CheckedFieldWriteAccess<NoInfer<Instance>, NoInfer<Options>>
    & { list?: CheckedSort<Instance, Name> & CheckedFilters<Instance, FilterPath> & CheckedSearch<Instance> },
): CrudRouteMetadata<Options>[];
export function crudRouteMetadata(options: CrudRouteMetadataOptions): CrudRouteMetadata[] {
  const names = crudEndpointNames(options);
  const resourceSettings = resolveRouteSettings({
    name: options.name, settings: options, defaults: { docs: DEFAULT_ENDPOINT_DOCS, scope: defaultEndpointScope(options) },
  });
  const resourceTool = principalSetting(options, 'tool');
  const declaredPrincipals = principalSetting(options, 'principals');
  const resourcePrincipals = resolveEndpointPrincipals({
    name: options.name, scope: resourceSettings.scope, tool: resourceTool, principals: declaredPrincipals,
  });
  const paths = crudPaths(options);

  const operations = validatedCrudOperations(options);
  const model = options.fields && { name: options.name, fields: options.fields };
  const paging = resolveListPaging(options.list);
  if (options.list) offsetPaginationDefaults(options.list);
  const filters = resolveFilters({ model, filter: options.list?.filter });
  assertSearchDeclaration({ model, search: options.list?.search });
  const sorts = declaredSorts({ model, sort: options.list?.sort }) ?? emptySorts;
  if (model) {
    assertFieldPatchModes(model);
    assertResourceOwner(options);
    if (options.tenancy === 'owned') resolveTenantField(model);
  }
  const id = model && operations.length > 0 ? resolveCrudIdField(model) : undefined;
  const item = id && options.tenancy !== 'self'
    ? { path: paths.item, paramFields: Object.freeze({ [itemParamName(options.name)]: id.name }) }
    : { path: paths.item };
  const routes = operations.map(({ operation, rule }) => {
    const { method, code } = CRUD_OPERATIONS[operation];
    const location = operation === 'Create' || operation === 'List' ? { path: paths.collection } : item;
    const listing = operation === 'List' ? {
      Filters: filters, Sorts: sorts, listResponse: Object.freeze({ name: options.name, plural: pluralResourceName(options), paging }),
    } : {};
    const name = names[operation];
    const override = crudOperationOverride(options, operation);
    const settings = resolveRouteSettings({ name, settings: override, defaults: resourceSettings });
    const operationTool = principalSetting(override, 'tool');
    const tool = operationTool === undefined ? resourceTool : operationTool;
    const principals = resolveEndpointPrincipals({
      name, scope: settings.scope, tool, principals: principalSetting(override, 'principals'),
      inheritedPrincipals: declaredPrincipals === undefined ? undefined : resourcePrincipals,
    });
    // The same operation indexes both tables, preserving the correlation in the result.
    return {
      kind: 'crud', operation, name, method, ...location, code, ...settings, ...listing,
      ...(rule === undefined ? {} : { Access: rule }), ...(tool ? { tool: true } : {}), ...(principals === undefined ? {} : { principals }),
    } as CrudRouteMetadata;
  });
  assertUniqueRoutes(routes);
  if (options.plural == null && /(?:s|x|y|ch|sh)$/i.test(options.name)) {
    const warn = options.warn ?? console.warn;
    warn(`Resource "${options.name}" defaults to the plural "${pluralResourceName(options)}". Set "plural" explicitly to confirm or change it.`);
  }
  return routes;
}
