import type { Constructor } from '@epsilon-asi/foundation';
import { z } from 'zod/v4';
import type { CrudRouteAccess } from '../access/crudAccess.js';
import type { CreatedFields, ResourceModel, ResourceWire } from '../model/createResourceSystem.js';
import type { CreateInput, GetInput, IdOf, ReadModel, UpdateInput } from '../model/types.js';
import { unwrapFieldSchema } from '../model/unwrapFieldSchema.js';
import { listQueryFields, type ResolvedListQuerySchema } from '../query/listQuerySchema.js';
import type { CheckedFilters } from '../query/resolveFilters.js';
import type { CheckedSort } from '../query/resolveSorts.js';
import { offsetPaginationQuerySchema, offsetPaginationRequestSchema, type OffsetPaginationDefaultsOptions } from '../query/pagination.js';
import type { OffsetListResponseData } from '../responses/offsetListResponseData.js';
import type { EmptySuccessResponse, SuccessResponse } from '../responses/success.js';
import type { EndpointScope } from '../tenancy/endpointScope.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { assertOptionNamesAvailable } from './assertOptionNamesAvailable.js';
import { crudRouteMetadata, type CrudRouteMetadata, type CrudRouteMetadataOptions } from './crudRouteMetadata.js';
import { defaultFailureCodes, type DefaultFailureCode } from './defaultFailureCodes.js';
import type { CrudOperation, CrudOperationOptions } from './enabledCrudOperations.js';
import type { HttpEndpoint } from './httpEndpoint.js';
import { listResponseKey } from './listResponseKey.js';
import { isItemPathValue } from './pathParameterNames.js';
import { reassembleUpdateRequest } from './reassembleUpdateRequest.js';
import type { PluralName } from './resourceNames.js';
import { splitUpdateRequest } from './splitUpdateRequest.js';
import { responseTypeUnion, type ResponseTypeUnion } from './responseTypeUnion.js';

/** Operations available on generated unparented resource contracts. */
export interface ResourceEndpointsOptions<Name extends string = string> extends
  Pick<CrudRouteMetadataOptions, 'access' | 'docs' | 'plural' | 'principals' | 'scope' | 'tool' | 'warn'> {
  name: Name;
  operations?: Partial<Record<CrudOperation, boolean | CrudOperationOptions>>;
  list?: OffsetPaginationDefaultsOptions & {
    paging?: 'offset';
    sort?: true | readonly string[];
    filter?: Readonly<Record<string, readonly '$eq'[]>>;
    search?: never;
  };
  parent?: never;
  in?: never;
}

export type CheckedListDeclaration<C extends Constructor, O extends ResourceEndpointsOptions> = {
  list?: ResourceEndpointsOptions['list'] extends O['list'] ? O['list'] :
    CheckedSort<InstanceType<C>, string> & CheckedFilters<InstanceType<C>, Extract<keyof NonNullable<NonNullable<O['list']>['filter']>, string>>;
};

// Preserve the public type of a Create-only declaration.
export interface CreateEndpointsOptions<Name extends string = string> extends ResourceEndpointsOptions<Name> {
  operations: { Create?: true | CrudOperationOptions; Get: false; Update: false; Delete: false; List: false };
}

interface ContractDefaults {
  register(endpoint: HttpEndpoint): void;
  tenantHeader?: string;
  tenantContext?: string;
  apiVersion?: string;
  defaultAccess?: string | object;
}

export interface CreateRequestContent<Body> {
  params: Record<string, never>;
  query: Record<string, never>;
  body: Body;
  headers: Record<string, never>;
}

export type UpdateRequestContent<Name extends string, Body, Id = string> = {
  params: Record<`${Uncapitalize<Name>}Id`, Id>;
  query: Record<string, never>;
  body: Body;
  headers: Record<string, never>;
};

export type GetRequestContent<Name extends string, Id = string> = UpdateRequestContent<Name, Record<string, never>, Id>;
export type DeleteRequestContent<Name extends string, Id = string> = GetRequestContent<Name, Id>;

export type ListRequestContent<Query> = Omit<CreateRequestContent<Record<string, never>>, 'query'> & { query: Query };

type ItemOperation = 'Get' | 'Update' | 'Delete';
type WriteOperation = 'Create' | 'Update' | 'Delete';
type Operation = ItemOperation | 'Create';
type Route<Name extends string, Op extends CrudOperation> =
  Extract<CrudRouteMetadata<{ name: Name; access?: CrudRouteMetadataOptions['access'] }>, { operation: Op }>;
type Success<Data, Op extends CrudOperation> = SuccessResponse<Data> & { code: Route<string, Op>['code'] };
type Response<C extends Constructor, Op extends Operation> = Op extends 'Delete'
  ? z.ZodType<EmptySuccessResponse, EmptySuccessResponse>
  : z.ZodType<Success<ReadModel<C>, Op>, Success<ResourceWire<ReadModel<C>>, Op>>;
type WireCreate<C extends Constructor> = CreateRequestContent<ResourceWire<CreateInput<C>>>;

type UpdateRequest<C> = GetInput<C> & UpdateInput<C>;
// Even a primary key marked editable belongs exclusively to the item URL.
type UpdateBody<C> = Exclude<keyof UpdateInput<C>, keyof GetInput<C>> extends never
  ? Record<string, never> : Omit<UpdateInput<C>, keyof GetInput<C>>;
type WireUpdate<C, Name extends string> = UpdateRequestContent<Name, ResourceWire<UpdateBody<C>>>;

type Option<Source, Key extends PropertyKey> = Source extends { [K in Key]: infer Value } ? Value :
  Source extends object ? Source[Key & keyof Source] | undefined : undefined;
type WithFallback<Value, Fallback> = Exclude<Value, undefined> | (undefined extends Value ? Fallback : never);
type ScopeSetting<Source> = Extract<EndpointScope | undefined, Option<Source, 'scope'>>;
// An absent scope uses the resource tenancy. Decorators record that tenancy at runtime.
type Scope<Options extends ResourceEndpointsOptions, Op extends CrudOperation> = Options extends unknown ? WithFallback<
  ScopeSetting<Option<Options['operations'], Op>>,
  WithFallback<ScopeSetting<Options>, 'account' | 'tenant'>
> : never;

interface EndpointMetadata<Name extends string, Options extends ResourceEndpointsOptions<Name>, Op extends CrudOperation> {
  readonly Name: Op extends 'List' ? `List${PluralName<Options>}` : `${Op}${Name}`;
  readonly Kind: 'crud';
  readonly Method: Route<Name, Op>['method'];
  readonly Path: string;
  readonly Access: WithFallback<CrudRouteAccess<Options, Op>['Access'], string | object>;
  readonly FieldAccess?: object;
  readonly Resource: object;
  readonly ResourcePolicy: HttpEndpoint['ResourcePolicy'];
  readonly Route: Extract<CrudRouteMetadata<Options>, { operation: Op }> & { readonly scope: Scope<Options, Op> } & CrudRouteAccess<Options, Op>;
  readonly TenantHeader?: string;
  readonly TenantContext?: string;
  readonly ApiVersion?: string;
}

interface Endpoint<C extends Constructor, Name extends string, Options extends ResourceEndpointsOptions<Name>, Op extends Operation>
  extends EndpointMetadata<Name, Options, Op> {
  readonly ResponseData: Op extends 'Delete' ? undefined : ResourceModel<C>['read'];
  readonly Response: Response<C, Op>;
}

/** A generated Create contract shared by callers and handlers. */
export interface CreateEndpoint<C extends Constructor, Name extends string,
  Options extends ResourceEndpointsOptions<Name> = CreateEndpointsOptions<Name>> extends Endpoint<C, Name, Options, 'Create'> {
  readonly Request: ResourceModel<C>['create'];
  readonly RequestContent: z.ZodType<CreateRequestContent<CreatedFields<C>>, WireCreate<C>>;
  readonly ResponseTypeUnion: ResponseTypeUnion<Response<C, 'Create'>, DefaultFailureCode<Scope<Options, 'Create'>>>;
  toContent(request: CreateInput<C>): WireCreate<C>;
  fromContent(content: WireCreate<C>): CreatedFields<C>;
}

interface ItemEndpoint<C extends Constructor, Name extends string, Options extends ResourceEndpointsOptions<Name>, Op extends ItemOperation>
  extends Endpoint<C, Name, Options, Op> {
  readonly Route: Endpoint<C, Name, Options, Op>['Route'] & {
    readonly paramFields: Readonly<Record<`${Uncapitalize<Name>}Id`, Extract<keyof GetInput<C>, string>>>;
  };
}

/** Get and Delete use the same primary-key request. */
interface ItemIdRequest<C extends Constructor, Name extends string> {
  readonly Request: z.ZodType<GetInput<C>, GetInput<C>>;
  readonly RequestContent: z.ZodType<GetRequestContent<Name, NonNullable<IdOf<C>>>, GetRequestContent<Name>>;
  toContent(request: GetInput<C>): GetRequestContent<Name>;
  fromContent(content: GetRequestContent<Name>): GetInput<C>;
}

/** A generated Get contract reads by the declared primary key and returns the readable model. */
export interface GetEndpoint<C extends Constructor, Name extends string,
  Options extends ResourceEndpointsOptions<Name> = ResourceEndpointsOptions<Name>> extends ItemEndpoint<C, Name, Options, 'Get'>, ItemIdRequest<C, Name> {
  readonly ResponseTypeUnion: ResponseTypeUnion<Response<C, 'Get'>, Exclude<DefaultFailureCode<Scope<Options, 'Get'>>, 402 | 409>>;
}

/** Delete addresses one resource by ID and returns an empty success envelope. */
export interface DeleteEndpoint<C extends Constructor, Name extends string,
  Options extends ResourceEndpointsOptions<Name> = ResourceEndpointsOptions<Name>> extends ItemEndpoint<C, Name, Options, 'Delete'>, ItemIdRequest<C, Name> {
  readonly ResponseTypeUnion: ResponseTypeUnion<Response<C, 'Delete'>, Exclude<DefaultFailureCode<Scope<Options, 'Delete'>>, 402>>;
}

/** PATCH places the required ID in the URL and the supplied writable fields in the body. */
export interface UpdateEndpoint<C extends Constructor, Name extends string,
  Options extends ResourceEndpointsOptions<Name> = ResourceEndpointsOptions<Name>> extends ItemEndpoint<C, Name, Options, 'Update'> {
  readonly Request: z.ZodType<UpdateRequest<C>, UpdateRequest<C>>;
  readonly RequestContent: z.ZodType<UpdateRequestContent<Name, UpdateBody<C>, NonNullable<IdOf<C>>>, WireUpdate<C, Name>>;
  readonly ResponseTypeUnion: ResponseTypeUnion<Response<C, 'Update'>, Exclude<DefaultFailureCode<Scope<Options, 'Update'>>, 402>>;
  toContent(request: UpdateRequest<C>): WireUpdate<C, Name>;
  fromContent(content: WireUpdate<C, Name>): UpdateRequest<C>;
}

type PagingRequest = ReturnType<typeof offsetPaginationRequestSchema>;
type PagingQuery = ReturnType<typeof offsetPaginationQuerySchema>;
type ListOptions<C extends Constructor, O extends ResourceEndpointsOptions> = NonNullable<O['list']> & { model: ResourceModel<C> };
type QuerySchema<C extends Constructor, O extends ResourceEndpointsOptions> = ResolvedListQuerySchema<PagingQuery['shape'], ListOptions<C, O>>;
type OptionalOperand<T> = z.ZodOptional<z.ZodType<Exclude<T, undefined>, Exclude<T, undefined>>>;
type NativeRequest<Query extends z.ZodObject> = z.ZodObject<PagingRequest['shape'] & {
  [K in Exclude<keyof Query['shape'], 'page' | 'perPage'>]: OptionalOperand<z.output<Query['shape'][K]>>;
}, z.core.$strict>;
type WireListData<Data> = { [Key in keyof Data]: Key extends 'count' ? Data[Key] : ResourceWire<Data[Key]> };
type ListResponse<Data> = z.ZodType<Success<Data, 'List'>, Success<WireListData<Data>, 'List'>>;
type ListDescriptors<C extends Constructor, O extends ResourceEndpointsOptions> =
  Pick<Extract<CrudRouteMetadata<O & Pick<ResourceModel<C>, 'fields' | 'target'>>, { operation: 'List' }>, 'Filters' | 'Sorts'>;
type ListFailure<Scope extends EndpointScope> =
  Exclude<DefaultFailureCode<Scope>, 402 | 404 | 409> | (Scope extends 'tenant' ? 404 : never);

/** An offset-paged collection read. Every returned row uses the resource's read projection. */
export interface ListEndpoint<C extends Constructor, Name extends string,
  Options extends ResourceEndpointsOptions<Name> = ResourceEndpointsOptions<Name>> extends EndpointMetadata<Name, Options, 'List'> {
  readonly Route: EndpointMetadata<Name, Options, 'List'>['Route'] & ListDescriptors<C, Options>;
  readonly Filters: ListDescriptors<C, Options>['Filters'];
  readonly Sorts: ListDescriptors<C, Options>['Sorts'];
  readonly Request: NativeRequest<QuerySchema<C, Options>>;
  readonly RequestContent: z.ZodType<ListRequestContent<z.output<QuerySchema<C, Options>>>, ListRequestContent<z.input<QuerySchema<C, Options>>>>;
  readonly ResponseData: z.ZodType<OffsetListResponseData<C, Options>, OffsetListResponseData<C, Options>>;
  readonly Response: ListResponse<OffsetListResponseData<C, Options>>;
  readonly ResponseTypeUnion: ResponseTypeUnion<ListResponse<OffsetListResponseData<C, Options>>, ListFailure<Scope<Options, 'List'>>>;
  toContent(request: z.input<NativeRequest<QuerySchema<C, Options>>>): ListRequestContent<z.input<QuerySchema<C, Options>> & { page: string; perPage: string }>;
  fromContent(content: ListRequestContent<z.input<QuerySchema<C, Options>>>): z.output<QuerySchema<C, Options>>;
}

export type CreateEndpoints<C extends Constructor, Name extends string,
  Options extends CreateEndpointsOptions<Name> = CreateEndpointsOptions<Name>> = {
  readonly [Key in `Create${Name}`]: CreateEndpoint<C, Name, Options>;
};

type Enabled<Setting, Fallback extends boolean> = (false extends Setting ? false : never)
  | ([Exclude<Setting, false | undefined>] extends [never] ? never : true)
  | (undefined extends Setting ? Fallback : never);
type ReadEnabled<O extends ResourceEndpointsOptions, Op extends 'Get' | 'List'> = Enabled<Option<O['operations'], Op>, true>;
// Shared resources disable writes by default. If no other operation could run for a shared
// resource, a successful declaration necessarily uses the ordinary (write-enabled) default.
type WriteEnabled<O extends ResourceEndpointsOptions, Op extends WriteOperation> = Enabled<Option<O['operations'], Op>,
  (ReadEnabled<O, 'Get'> | ReadEnabled<O, 'List'>) extends false
    ? [Exclude<Option<O['operations'], Exclude<WriteOperation, Op>>, false | undefined>] extends [never] ? true : boolean
    : boolean>;
type Member<Key extends string, Value, State extends boolean> = [State] extends [false] ? {} :
  [State] extends [true] ? Readonly<Record<Key, Value>> : Readonly<Partial<Record<Key, Value>>>;
// A conditional plural produces one collection key per declaration.
type ListMember<C extends Constructor, O extends ResourceEndpointsOptions, Plural extends string = PluralName<O>> =
  Plural extends unknown ? Member<`List${Plural}`, ListEndpoint<C, O['name'], Omit<O, 'plural'> & { plural: Plural }>,
    ReadEnabled<O, 'List'> | (string extends Plural ? false : never)> : never;
export type ResourceEndpoints<C extends Constructor, O extends ResourceEndpointsOptions> = O extends unknown ?
  Member<`Create${O['name']}`, CreateEndpoint<C, O['name'], O>, WriteEnabled<O, 'Create'>>
  & Member<`Get${O['name']}`, GetEndpoint<C, O['name'], O>, ReadEnabled<O, 'Get'>>
  & Member<`Update${O['name']}`, UpdateEndpoint<C, O['name'], O>, WriteEnabled<O, 'Update'>>
  & Member<`Delete${O['name']}`, DeleteEndpoint<C, O['name'], O>, WriteEnabled<O, 'Delete'>>
  & ListMember<C, O> : never;

const emptySection = z.strictObject({});

function createRequest<C extends Constructor>(model: ResourceModel<C>) {
  const content = z.strictObject({ params: emptySection, query: emptySection, body: model.wire.create, headers: emptySection });
  return {
    Request: model.create, RequestContent: content,
    toContent(input: CreateInput<C>) {
      const decoded = model.create.parse(input);
      return { params: {}, query: {}, headers: {}, body: model.wire.create.encode(decoded) };
    },
    fromContent(wire: unknown) {
      return content.parse(wire).body;
    },
  };
}

function listContract<C extends Constructor>(
  model: ResourceModel<C>, options: ResourceEndpointsOptions, route: Extract<CrudRouteMetadata, { operation: 'List' }>,
) {
  const { list = {} } = options;
  if ((list.paging !== undefined && list.paging !== 'offset') ||
      list.search !== undefined || Object.values(list.filter ?? {}).some(cap => !Array.isArray(cap) || cap.some(op => op !== '$eq'))) {
    throw new ApiDefinitionError(`List on "${options.name}" currently supports offset pagination, scalar equality filters and immediate sort fields.`);
  }
  const key = listResponseKey(options);
  if (key === 'count') throw new ApiDefinitionError(`List on "${options.name}" cannot use the reserved collection key "count".`);
  const fields = listQueryFields({
    model, filters: route.Filters, sorts: list.sort === undefined ? undefined : route.Sorts, requireDeclaredOperators: true,
  });
  const query = offsetPaginationQuerySchema(list).extend(fields);
  // Native callers supply decoded filter operands (e.g. Date). Reuse the wire validators in reverse.
  const where = fields.where;
  const request = offsetPaginationRequestSchema(list).extend({
    ...fields,
    ...(where && { where: z.unknown().check(payload => {
      const result = where.safeEncode(payload.value);
      if (!result.success) {
        for (const issue of result.error.issues) {
          payload.issues.push({ code: 'custom', input: payload.value, path: issue.path, message: issue.message });
        }
      }
    }).optional() }),
  });
  const content = z.strictObject({ params: emptySection, query, body: emptySection, headers: emptySection });
  const count = z.int().nonnegative();
  return {
    Request: request, RequestContent: content,
    toContent(input: z.input<typeof request>) {
      return { params: {}, query: query.encode(request.parse(input)), body: {}, headers: {} };
    },
    fromContent(wire: unknown) { return content.parse(wire).query; },
    ResponseData: z.strictObject({ [key]: z.array(model.read), count }),
    wireData: z.strictObject({ [key]: z.array(model.wire.read), count }),
  };
}

// Every URL parameter is text. A union of different stored kinds could decode "1" as the wrong ID.
function pathScalarKind(schema: z.core.$ZodType): string | null | undefined {
  const def = unwrapFieldSchema(schema).schema._zod.def;
  switch (def.type) {
    case 'string': case 'number': case 'boolean': case 'date': return def.type;
    case 'null': return null;
    case 'enum': case 'literal': {
      const values = def.type === 'enum' ? z.core.util.getEnumValues(def.entries) : def.values;
      const value = values.find(item => item != null);
      return value === undefined ? null : typeof value;
    }
    case 'union': {
      const kinds = new Set(def.options.map(pathScalarKind));
      // A nullable stored key contributes no URL representation of its own.
      kinds.delete(null);
      if (!kinds.size) return null;
      return kinds.size === 1 ? [...kinds][0] : undefined;
    }
  }
}

function itemRequest<C extends Constructor>(model: ResourceModel<C>, route: Route<string, ItemOperation>) {
  const mappings = Object.entries(route.paramFields ?? {});
  if (mappings.length !== 1) throw new ApiDefinitionError(`Item endpoint "${route.name}" requires a single item path parameter.`);
  const [[param, field]] = mappings;
  const id = model.fields.get(field);
  const read = model.wire.read;
  if (!id || !(read instanceof z.ZodObject) || !Object.hasOwn(read.shape, field)) {
    throw new ApiDefinitionError(`Item endpoint "${route.name}" requires a readable primary key "${field}".`);
  }
  if (!pathScalarKind(id.schema)) {
    throw new ApiDefinitionError(`Item endpoint "${route.name}" requires a scalar primary key "${field}".`);
  }
  // A path must be present even if the stored ID has a default. Keep its declared validators and wire codec.
  const segment = z.string().refine(isItemPathValue, 'Expected a nonempty, non-dot item ID.');
  const scalar = z.union([segment, z.number(), z.date(), z.boolean()]);
  const patch = route.operation === 'Update' ? model.update : emptySection;
  const wirePatch = route.operation === 'Update' ? model.wire.update : emptySection;
  if (!(patch instanceof z.ZodObject) || !(wirePatch instanceof z.ZodObject)) {
    throw new ApiDefinitionError(`Item endpoint "${route.name}" requires an object request schema.`);
  }
  const request = z.strictObject({ ...patch.shape, [field]: scalar.pipe(id.schema as z.ZodType<unknown, z.output<typeof scalar>>) });
  const params = z.strictObject({ [param]: segment.pipe(read.shape[field]) });
  const wireFields: z.ZodRawShape = wirePatch.shape;
  const { [field]: _pathField, ...bodyFields } = wireFields;
  const content = z.strictObject({ params, query: emptySection, body: z.strictObject(bodyFields), headers: emptySection });
  return {
    Request: request, RequestContent: content,
    toContent(input: unknown) {
      const flat = request.parse(input);
      return content.encode({ ...splitUpdateRequest({ ...route, request: flat }), query: {}, headers: {} });
    },
    fromContent(wire: unknown) {
      const { params, body } = content.parse(wire);
      return reassembleUpdateRequest({ ...route, params, body });
    },
  };
}

/** Assembles the enabled contracts before registering any of them with the resource system. */
export function createEndpoints<C extends Constructor, const Options extends ResourceEndpointsOptions>(
  model: ResourceModel<C>, options: Options, defaults: ContractDefaults,
): ResourceEndpoints<C, Options>;
export function createEndpoints<C extends Constructor>(
  model: ResourceModel<C>, options: ResourceEndpointsOptions, defaults: ContractDefaults,
): unknown {
  assertOptionNamesAvailable(options);
  if (options.parent !== undefined || options.in !== undefined) {
    throw new ApiDefinitionError(`Generated resource endpoints currently support only unparented default locations on "${options.name}".`);
  }
  const routes = crudRouteMetadata({
    ...options, name: options.name, fields: model.fields, tenancy: model.tenancy, owner: model.owner,
  });
  if (!routes.length) throw new ApiDefinitionError(`Enable at least one CRUD operation on "${options.name}" to build an endpoint contract.`);
  const endpoints = routes.map(route => {
    const access = route.Access ?? defaults.defaultAccess;
    if (access === undefined) throw new ApiDefinitionError(`Endpoint "${route.name}" requires an access rule or a resource-system default.`);
    const envelope = { code: z.literal(route.code), message: z.string().optional() };
    const { wireData, ...contract } = route.operation === 'List'
      ? { ...listContract(model, options, route), Filters: route.Filters, Sorts: route.Sorts }
      : {
        ...(route.operation === 'Create' ? createRequest(model) : itemRequest(model, route)),
        ResponseData: route.operation === 'Delete' ? undefined : model.read,
        wireData: route.operation === 'Delete' ? undefined : model.wire.read,
      };
    const response = wireData ? z.strictObject({ ...envelope, data: wireData }) : z.strictObject(envelope);
    let fieldAccess = route.operation === 'Create' || route.operation === 'Update' ? options.access?.fields : undefined;
    if (route.operation === 'Update' && fieldAccess) {
      const pathFields = Object.values(route.paramFields ?? {});
      fieldAccess = Object.fromEntries(Object.entries(fieldAccess).filter(([name]) => !pathFields.includes(name)));
    }
    return {
      Name: route.name, Kind: route.kind, Method: route.method, Path: route.path, Access: access, Route: route,
      TenantHeader: defaults.tenantHeader, TenantContext: defaults.tenantContext, ApiVersion: defaults.apiVersion,
      FieldAccess: fieldAccess,
      Resource: model,
      ResourcePolicy: Object.freeze({ tenancy: model.tenancy, owner: model.owner }),
      ...contract, Response: response,
      ResponseTypeUnion: responseTypeUnion({ response, failures: defaultFailureCodes(route) }),
    } satisfies HttpEndpoint & { Kind: 'crud'; ApiVersion?: string };
  });
  for (const endpoint of endpoints) defaults.register(endpoint);
  return Object.fromEntries(endpoints.map(endpoint => [endpoint.Name, endpoint]));
}
