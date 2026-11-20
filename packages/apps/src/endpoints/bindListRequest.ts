import { z } from 'zod/v4';
import { withoutFallbacks } from '../model/updateFieldSchema.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { pathRequestFields, type PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { ownFields, type RouteField } from './bindPathRequest.js';
import type { BoundPathParamNames } from './crudRouteMetadata.js';
import type { DeclaredOption } from './declaredOption.js';
import { reassembleListRequest, splitListRequest } from './listRequest.js';
import { requestContentSchema, type RequestContentSchema } from './requestContentSchema.js';

export interface BindListRequestOptions {
  route: Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> & { kind: 'crud'; operation: 'List' };
  /** The List query schema, including its paging defaults, filter codecs and refinements. */
  query: z.ZodObject;
  /** Optional schema for each wire parameter. An undeclared parameter uses a string. */
  params?: Readonly<Record<string, z.core.$ZodType>>;
}

type Names<O extends BindListRequestOptions> = BoundPathParamNames<O['route']['path']>;
type ParamSchema<O, Name extends string, Params = DeclaredOption<O, 'params'>,
  Value = DeclaredOption<Params, Name> | (string extends Name ? Params extends object ? Params[keyof Params] : never : never)> =
  Extract<Value, z.core.$ZodType> | (undefined extends Value ? z.ZodString : never);
type Value<S, Direction extends 'input' | 'output'> = Direction extends 'input' ? z.input<S> : z.output<S>;
type ListParams<O extends BindListRequestOptions, Direction extends 'input' | 'output'> =
  [Names<O>] extends [never] ? Record<string, never> : string extends Names<O>
    ? Partial<Record<string, Value<ParamSchema<O, string>, Direction>>>
    : { [Name in Names<O>]: Exclude<Value<ParamSchema<O, Name>, Direction>, undefined> };
/** The query's object shape together with the names and codecs of the bound parent fields. */
export type ListRequestSchema<O extends BindListRequestOptions, Query = O['query']> = Query extends z.ZodObject<infer Shape, infer Config>
  ? string extends RouteField<O['route'], Names<O>> ? z.ZodObject<Shape, z.core.$loose>
    : z.ZodObject<Shape & { [Name in Names<O> as RouteField<O['route'], Name>]: z.ZodNonOptional<ParamSchema<O, Name>> }, Config>
  : never;

/** Four wire sections of a List endpoint. Paging defaults may be omitted from the query on input. */
export interface ListRequestWire<O extends BindListRequestOptions = BindListRequestOptions> {
  params: ListParams<O, 'input'>;
  query: z.input<O['query']>;
  body: Record<string, never>;
  headers: Record<string, never>;
}

export type ListRequestContentSchema<O extends BindListRequestOptions> = RequestContentSchema<{
  params: z.ZodType<ListParams<O, 'output'>, ListParams<O, 'input'>>;
  query: O['query'];
}>;

/** A flat List request, its section schema and the conversions in both directions. */
export interface BoundListRequest<O extends BindListRequestOptions = BindListRequestOptions> {
  readonly Request: ListRequestSchema<O>;
  readonly RequestContent: ListRequestContentSchema<O>;
  toContent(request: z.output<ListRequestSchema<O>>): ListRequestWire<O>;
  fromContent(content: ListRequestWire<O>): z.output<ListRequestSchema<O>>;
}

/** Binds a generated List route to the full query schema and its parent parameter codecs. */
export function bindListRequest<const O extends BindListRequestOptions>(options: O): BoundListRequest<O>;
export function bindListRequest({ route, query, params = {} }: BindListRequestOptions): object {
  if (route.kind !== 'crud' || route.operation !== 'List') throw new ApiDefinitionError('A List request requires a CRUD List route.');
  if (!(query instanceof z.ZodObject)) throw new ApiDefinitionError('A List request requires a Zod query object.');
  const location = { path: route.path, paramFields: { ...route.paramFields } };
  const fields = pathRequestFields(location);
  const paramNames = new Set(fields.map(({ param }) => param));
  for (const key of Reflect.ownKeys(params)) {
    if (typeof key !== 'string' || !paramNames.has(key)) throw new ApiDefinitionError(`Route "${route.path}" has no List path parameter "${String(key)}".`);
  }
  const schemas = fields.map(({ param, field, optional }) => {
    if (Object.hasOwn(query.shape, field)) throw new ApiDefinitionError(`List query field "${field}" also belongs to path parameter "${param}".`);
    const schema = Object.hasOwn(params, param) ? params[param] : z.string();
    if (!(schema instanceof z.core.$ZodType)) throw new ApiDefinitionError(`List parameter "${param}" requires a Zod schema.`);
    const inner = withoutFallbacks(schema);
    return { param, field, schema: optional ? z.optional(inner) : z.nonoptional(inner) };
  });
  const paramShape = Object.fromEntries(schemas.map(({ param, schema }) => [param, schema]));
  const flatParams = Object.fromEntries(schemas.map(({ field, schema }) => [field, schema]));
  const strictQuery = query._zod.def.catchall ? query : query.strict();
  // A catchall still cannot take the parent in the query section.
  const sectionQuery = fields.length && strictQuery._zod.def.catchall?._zod.def.type !== 'never' ? strictQuery.superRefine((values, ctx) => {
    for (const { param, field } of fields) {
      if (Object.hasOwn(values, field)) ctx.addIssue({ code: 'custom', path: [field], message: `List field "${field}" belongs in path parameter "${param}".` });
    }
  }) : strictQuery;
  const RequestContent = requestContentSchema({ params: z.strictObject(paramShape), query: sectionQuery });

  // The flat object's fields own the codecs. Whole-query checks receive just the decoded query fields.
  const shape = { ...query.shape, ...flatParams };
  const catchall = strictQuery._zod.def.catchall;
  const flat = catchall ? z.object(shape).catchall(catchall) : z.strictObject(shape);
  const checks = query._zod.def.checks;
  const emptyQuery = z.looseObject({});
  const queryChecks = checks?.length ? z.clone(emptyQuery, { ...emptyQuery.def, checks }) : undefined;
  const Request = !fields.length ? strictQuery : !queryChecks ? flat : flat.check(payload => {
    const { params, query } = splitListRequest({ ...location, request: payload.value });
    const checked = queryChecks._zod.run({ value: query, issues: [] }, { async: true });
    function finish(result: z.core.ParsePayload) {
      if (result.issues.length) payload.issues.push(...result.issues);
      else payload.value = reassembleListRequest({ ...location, params, query: ownFields(result.value, 'List query') });
    }
    if (checked instanceof Promise) return checked.then(finish);
    finish(checked);
  });

  return {
    Request, RequestContent,
    toContent(value: object) {
      const { params, query } = splitListRequest({ ...location, request: ownFields(value, 'List request') });
      return RequestContent.encode({ params, query, body: {}, headers: {} });
    },
    fromContent(value: object) {
      const content = ownFields(value, 'List content');
      for (const key of Object.keys(content)) content[key] = ownFields(content[key], `List ${key}`);
      const { params, query, body } = RequestContent.parse(content);
      return reassembleListRequest({ ...location, params, query, body });
    },
  };
}
