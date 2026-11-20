import { validatedCrudOperations, type CheckedFieldWriteAccess, type CrudAccessMap, type CrudRouteAccess } from '../access/crudAccess.js';
import { assertFieldPatchModes } from '../model/assertFieldPatchModes.js';
import { assertResourceOwner, type AssertResourceOwnerOptions } from '../model/assertResourceOwner.js';
import { resolveCrudIdField, type ResolveCrudIdFieldOptions } from '../model/resolveCrudIdField.js';
import { resolveTenantField } from '../model/resolveTenantField.js';
import { assertSearchDeclaration, type CheckedSearch, type ListQueryOptions } from '../query/listQuerySchema.js';
import { resolveFilters, type CheckedFilters, type ResolvedFilters } from '../query/resolveFilters.js';
import { declaredSorts, type CheckedSort, type ResolvedSorts, type SortSource } from '../query/resolveSorts.js';
import { resolveEndpointPrincipals, type ResolveEndpointPrincipalsOptions } from '../tenancy/endpointPrincipals.js';
import { defaultEndpointScope, EndpointScope, endpointScopeSchema } from '../tenancy/endpointScope.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { assertOptionNamesAvailable } from './assertOptionNamesAvailable.js';
import type { PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { assertUniqueRoutes, type RouteDeclaration } from './assertUniqueRoutes.js';
import { crudEndpointNames } from './crudEndpointNames.js';
import { CRUD_OPERATIONS } from './crudOperations.js';
import { crudPaths, type CrudPathsOptions } from './crudPaths.js';
import { crudOperationOverride, type CrudOperation, type EnabledCrudOperationsOptions } from './enabledCrudOperations.js';
import { itemParamName } from './itemParamName.js';
import { pluralResourceName } from './resourceNames.js';

export const DEFAULT_ENDPOINT_DOCS = true;

const emptySorts = Object.freeze(Object.create(null) as Record<never, never>);

type PrincipalSettings = Pick<ResolveEndpointPrincipalsOptions, 'principals' | 'tool'>;

export interface CrudRouteMetadataOptions extends CrudPathsOptions, EnabledCrudOperationsOptions, AssertResourceOwnerOptions, PrincipalSettings {
  /** Shared resources require an explicit rule for each enabled operation. */
  access?: CrudAccessMap;
  /** Enabled CRUD routes require one ID. Tenant-owned models require one Tenant field. */
  fields?: ResolveCrudIdFieldOptions['fields'];
  /** Field filters, search fields and sorting for the resource's List operation. */
  list?: (object | Record<string, unknown>) & Pick<ListQueryOptions, 'filter' | 'search' | 'sort'>;
  /** OpenAPI visibility for enabled operations. Default: true. */
  docs?: boolean;
  /** Default endpoint scope. Derived from the resource's tenancy when omitted. */
  scope?: EndpointScope;
  /** Receives resource naming warnings. Default: console.warn. */
  warn?: (message: string) => void;
}

type RouteSettings = Required<Pick<CrudRouteMetadataOptions, 'docs' | 'scope'>>;

// An optional declaration can supply a value. A key absent from a literal cannot.
type DeclaredValue<Options, Key extends PropertyKey> =
  Options extends object ? NonNullable<Options[Key & keyof Options]> : never;
type ListSorts<Options extends CrudRouteMetadataOptions, Fields = DeclaredValue<Options, 'fields'>> =
  [Fields] extends [never] ? Readonly<object>
    : ResolvedSorts<Options & { fields: Fields }, DeclaredValue<Options['list'], 'sort'>>;

/** An enabled route with the export name and HTTP contract for its operation. */
export type CrudRouteMetadata<Options extends CrudRouteMetadataOptions = CrudRouteMetadataOptions> = RouteDeclaration & RouteSettings & {
  kind: 'crud';
  /** Set on endpoints exposed as tools. */
  tool?: true;
  /** Public endpoints omit the authenticated principal list. */
  principals?: PrincipalSettings['principals'];
} & Pick<PathRequestFieldsOptions, 'paramFields'> & {
  [Op in CrudOperation]: {
    operation: Op;
    name: ReturnType<typeof crudEndpointNames<Options>>[Op];
  } & (typeof CRUD_OPERATIONS)[Op] & CrudRouteAccess<Options, Op>
    & (Op extends 'List' ? {
      Filters: ResolvedFilters<Options, NonNullable<Options['list']>['filter']>;
      Sorts: ListSorts<Options>;
    } : object);
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
  const docs = Object.hasOwn(settings, 'docs') ? settings.docs : undefined;
  if (docs !== undefined && typeof docs !== 'boolean') {
    throw new TypeError(`The docs option on "${name}" must be a boolean.`);
  }
  const scope = Object.hasOwn(settings, 'scope') ? settings.scope : undefined;
  const parsed = endpointScopeSchema.safeParse(scope === undefined ? defaults.scope : scope);
  if (!parsed.success) {
    throw new ApiDefinitionError(`The scope option on "${name}" must be one of ${Object.values(EndpointScope).join(', ')}.`);
  }
  return { docs: docs ?? defaults.docs, scope: parsed.data };
}

/** Assembles route metadata in the order of the enabled CRUD operations. */
export function crudRouteMetadata<const Options extends CrudRouteMetadataOptions, Instance = unknown, Name extends string = string, FilterPath extends string = string>(
  options: Options & SortSource<Instance, Name> & CheckedFieldWriteAccess<NoInfer<Instance>, NoInfer<Options>>
    & { list?: CheckedSort<Instance, Name> & CheckedFilters<Instance, FilterPath> & CheckedSearch<Instance> },
): CrudRouteMetadata<Options>[] {
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
    const listing = operation === 'List' ? { Filters: filters, Sorts: sorts } : {};
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
    } as CrudRouteMetadata<Options>;
  });
  assertUniqueRoutes(routes);
  if (options.plural == null && /(?:s|x|y|ch|sh)$/i.test(options.name)) {
    const warn = options.warn ?? console.warn;
    warn(`Resource "${options.name}" defaults to the plural "${pluralResourceName(options)}". Set "plural" explicitly to confirm or change it.`);
  }
  return routes;
}
