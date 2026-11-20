import { z } from 'zod/v4';
import { updateFieldSchema, withoutFallbacks } from '../model/updateFieldSchema.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { assertPathRequestFields, pathRequestFields, type PathRequestFieldsOptions } from './assertPathRequestFields.js';
import { reassembleCreateRequest, splitCreateRequest } from './createRequest.js';
import type { BoundPathParamNames, SingleCreateField } from './crudRouteMetadata.js';
import type { DeclaredOption } from './declaredOption.js';
import { reassembleItemRequest, splitItemRequest } from './itemRequest.js';
import { reassembleUpdateRequest } from './reassembleUpdateRequest.js';
import { requestContentSchema } from './requestContentSchema.js';
import { splitUpdateRequest } from './splitUpdateRequest.js';

type RoutePath = Pick<PathRequestFieldsOptions, 'path' | 'paramFields'>;
export type BoundRoute = RoutePath & { kind: 'crud'; operation: 'Create' | 'Update' | 'Get' | 'Delete' };

interface PathBindingOptions {
  route: BoundRoute;
  request: z.ZodObject;
}

type MappedField<Aliases, Param extends string, Alias = DeclaredOption<Aliases, Param>> =
  Extract<Alias, string> | (undefined extends Alias ? Param : never);
export type RouteField<Route extends RoutePath, Param extends string> = Param extends unknown ? SingleCreateField<MappedField<Route['paramFields'], Param>> : never;
export type RequestParams<Flat, Route extends RoutePath, Names extends string = BoundPathParamNames<Route['path']>> =
  [Names] extends [never] ? Record<string, never> : string extends Names | RouteField<Route, Names> ? Partial<Record<string, Flat[keyof Flat]>> :
  { [Param in Names]: Exclude<Flat[Extract<RouteField<Route, Param>, keyof Flat>], undefined> };
export type RequestBody<Flat, Route extends RoutePath, Fields = RouteField<Route, BoundPathParamNames<Route['path']>>> =
  string extends Fields ? Partial<Flat> : Omit<Flat, Extract<Fields, keyof Flat>>;

// The full flat schema owns the codecs and refinements. Check section placement before decoding it once.
const sections = requestContentSchema({ params: z.unknown(), body: z.unknown() });
const itemSections = requestContentSchema({ params: z.unknown() });
export function ownFields(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') {
    throw new TypeError(`${name} must be an object.`);
  }
  if (Reflect.ownKeys(value).length !== Object.keys(value).length) throw new TypeError(`${name} must have enumerable string fields.`);
  return Object.fromEntries(Object.entries(value));
}

export function bindPathRequest(operation: 'Create' | 'Update' | 'Item', { route, request }: PathBindingOptions) {
  const item = operation === 'Item';
  if (route.kind !== 'crud' || (item ? route.operation !== 'Get' && route.operation !== 'Delete' : route.operation !== operation)) {
    throw new ApiDefinitionError(item ? 'An item request requires a CRUD Get or Delete route.' : `A ${operation} request requires a CRUD ${operation} route.`);
  }
  if (!(request instanceof z.ZodObject)) throw new ApiDefinitionError(`A ${operation} request requires a flat Zod object.`);
  const location = { path: route.path, paramFields: { ...route.paramFields } };
  assertPathRequestFields({ ...location, request });
  const fields = pathRequestFields(location);
  const inPath = new Set(fields.map(({ field }) => field));
  const required = new Set(fields.filter(({ optional }) => !optional).map(({ field }) => field));
  let flatRequest = request;
  if (item || operation === 'Update') {
    const shape = Object.fromEntries(Object.entries(request.shape).map(([name, schema]) => {
      if (item) {
        if (!inPath.has(name)) throw new ApiDefinitionError(`Route "${route.path}" has no path parameter for item field "${name}".`);
        return [name, required.has(name) ? z.nonoptional(schema) : z.optional(schema)];
      }
      return [name, required.has(name) ? z.nonoptional(withoutFallbacks(schema)) : updateFieldSchema({ schema })];
    }));
    flatRequest = (item ? request.strict() : request).safeExtend(shape);
    if (!item && request._zod.def.catchall) flatRequest = flatRequest.catchall(withoutFallbacks(request._zod.def.catchall));
  }
  const params = z.strictObject(Object.fromEntries(fields.map(({ param, field, optional }) => [
    param, optional ? z.optional(flatRequest.shape[field]) : z.nonoptional(flatRequest.shape[field]),
  ])));
  const body = z.strictObject(Object.fromEntries(Object.entries(flatRequest.shape).filter(([field]) => !inPath.has(field))));
  const catchall = flatRequest._zod.def.catchall;
  const declaredBody = catchall && inPath.size ? body.catchall(catchall).superRefine((values, ctx) => {
    for (const field of inPath) {
      if (Object.hasOwn(values, field)) ctx.addIssue({ code: 'custom', path: [field], message: `${operation} field "${field}" belongs in params.` });
    }
  }) : catchall ? body.catchall(catchall) : body;
  const RequestContent = item ? requestContentSchema({ params }) : requestContentSchema({ params, body: declaredBody });
  // Undeclared fields must survive under an explicit catchall or be reported instead of silently stripped.
  const flat = catchall ? flatRequest : flatRequest.strict();
  const split = item ? splitItemRequest : operation === 'Update' ? splitUpdateRequest : splitCreateRequest;
  const reassemble = operation === 'Update' ? reassembleUpdateRequest : reassembleCreateRequest;
  return {
    Request: flatRequest, RequestContent,
    toContent(value: object) {
      const encoded = flat.encode(ownFields(value, `${operation} request`));
      return { ...split({ ...location, request: encoded }), query: {}, headers: {} };
    },
    fromContent(value: object) {
      const content = ownFields(value, `${operation} content`);
      for (const section of Object.keys(content)) content[section] = ownFields(content[section], `${operation} ${section}`);
      if (item) {
        const { params } = itemSections.parse(content);
        return flat.parse(reassembleItemRequest({ ...location, params: ownFields(params, 'Item params') }));
      }
      const { params, body } = sections.parse(content);
      return flat.parse(reassemble({ ...location, params: ownFields(params, `${operation} params`), body: ownFields(body, `${operation} body`) }));
    },
  };
}
