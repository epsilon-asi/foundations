import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { CRUD_OPERATIONS } from '../endpoints/crudOperations.js';
import type { CrudRouteMetadata } from '../endpoints/crudRouteMetadata.js';
import { listResponseDataSchema, type ListResponseDataSchema } from './listResponseDataSchema.js';
import { successResponseSchema, type SuccessResponseSchema } from './success.js';

/** A generated CRUD route and its readable row schema. Delete can omit the schema. */
export type CrudSuccessResponseSchemaOptions<Row extends z.core.$ZodType = z.core.$ZodType> =
  | { route: CrudRouteMetadata; row: Row }
  | { route: Extract<CrudRouteMetadata, { operation: 'Delete' }>; row?: Row };

type RouteResponse<Route extends CrudRouteMetadata, Row extends z.core.$ZodType> =
  Route extends { operation: 'Delete' } ? SuccessResponseSchema<Route['code'], undefined> :
  Route extends { operation: 'List' } ? SuccessResponseSchema<Route['code'], ListResponseDataSchema<Route['listResponse'] & { row: Row }>> :
  SuccessResponseSchema<Route['code'], Row>;

type DeclaredResponse<Options extends CrudSuccessResponseSchemaOptions> = Options extends unknown
  ? RouteResponse<Options['route'], NonNullable<Options['row']>> : never;

/** The selected operation's envelope with its literal status and distinct wire and decoded data. */
export type CrudSuccessResponseSchema<Options extends CrudSuccessResponseSchemaOptions = CrudSuccessResponseSchemaOptions> =
  z.ZodType<z.output<DeclaredResponse<Options>>, z.input<DeclaredResponse<Options>>>;

/** Builds a CRUD success envelope from the route and the resource's readable row schema. */
export function crudSuccessResponseSchema<const Options extends CrudSuccessResponseSchemaOptions>(options: Options): CrudSuccessResponseSchema<Options>;
export function crudSuccessResponseSchema({ route, row }: CrudSuccessResponseSchemaOptions): z.ZodType {
  const { operation, code } = route;
  if (route.kind !== 'crud' || !Object.hasOwn(CRUD_OPERATIONS, operation) || CRUD_OPERATIONS[operation].code !== code) {
    throw new ApiDefinitionError(`Invalid CRUD success operation or status for "${route.name}".`);
  }
  if (operation === 'Delete') return successResponseSchema({ code });
  if (!(row instanceof z.core.$ZodType)) throw new ApiDefinitionError(`CRUD response for "${route.name}" requires a row schema.`);
  if (operation === 'List') {
    if (!route.listResponse) throw new ApiDefinitionError(`"${route.name}" requires the List route's resource and paging declaration.`);
    return successResponseSchema({ code, data: listResponseDataSchema({ ...route.listResponse, row }) });
  }
  return successResponseSchema({ code, data: row });
}
