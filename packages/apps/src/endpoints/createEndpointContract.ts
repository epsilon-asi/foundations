import type { z } from 'zod/v4';
import { crudSuccessResponseSchema, type CrudSuccessResponseSchema } from '../responses/crudSuccessResponseSchema.js';
import { bindCreateRequest, type BindCreateRequestOptions, type BoundCreateRequest } from './bindCreateRequest.js';
import type { CrudRouteMetadata } from './crudRouteMetadata.js';
import { endpointRouteContract, type EndpointRouteContract } from './endpointRouteContract.js';
import { responseTypeUnion, type EndpointResponseTypeUnion, type EndpointResponseTypeUnionOptions } from './responseTypeUnion.js';

export interface CreateEndpointContractOptions extends BindCreateRequestOptions, Pick<EndpointResponseTypeUnionOptions, 'failures'> {
  /** The generated Create descriptor for the resource's collection. */
  route: Extract<CrudRouteMetadata, { operation: 'Create' }>;
  /** The readable row returned after a successful Create. */
  row: z.core.$ZodType;
}

type ResponseDeclaration<Options extends CreateEndpointContractOptions> = Options extends unknown
  ? Options['route'] & Pick<Options, 'failures' & keyof Options> & { response: CrudSuccessResponseSchema<Options> }
  : never;

/** The route, request conversions and response schemas of a Create endpoint. */
export type CreateEndpointContract<Options extends CreateEndpointContractOptions = CreateEndpointContractOptions> =
  EndpointRouteContract<Options['route']> & BoundCreateRequest<Options> & {
    readonly ResponseData: Options['row'];
    readonly Response: CrudSuccessResponseSchema<Options>;
    readonly ResponseTypeUnion: EndpointResponseTypeUnion<ResponseDeclaration<Options>>;
  };

/** Builds the public Create endpoint contract from its route, flat request and readable row schema. */
export function createEndpointContract<const Options extends CreateEndpointContractOptions>(options: Options): CreateEndpointContract<Options>;
export function createEndpointContract(options: CreateEndpointContractOptions): object {
  const request = bindCreateRequest(options);
  const response = crudSuccessResponseSchema(options);
  return {
    ...endpointRouteContract(options.route),
    ...request,
    ResponseData: options.row,
    Response: response,
    ResponseTypeUnion: responseTypeUnion({ ...options.route, response, failures: options.failures }),
  };
}
