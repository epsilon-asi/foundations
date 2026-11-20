import type { z } from 'zod/v4';
import type { updateFieldSchema } from '../model/updateFieldSchema.js';
import { bindPathRequest, type BoundRoute, type RequestBody, type RequestParams, type RouteField } from './bindPathRequest.js';
import type { BoundPathParamNames } from './crudRouteMetadata.js';
import type { RequestContentSchema } from './requestContentSchema.js';

export interface BindUpdateRequestOptions {
  /** The generated item route with its path-to-field mapping. */
  route: BoundRoute & { operation: 'Update' };
  /** The flat path and update-writable field declarations, including their codecs. */
  request: z.ZodObject;
}

type UpdateShape<Options extends BindUpdateRequestOptions, Shape extends z.core.$ZodShape = Options['request']['shape'],
  Fields = RouteField<Options['route'], BoundPathParamNames<Options['route']['path']>>> = {
  [Key in keyof Shape]: string extends Fields ? ReturnType<typeof updateFieldSchema<Shape[Key]>> :
    Key extends Fields ? z.ZodNonOptional<Shape[Key]> : ReturnType<typeof updateFieldSchema<Shape[Key]>>;
};

/** The bound flat PATCH object with required path fields and optional, fallback-free writes. */
export type UpdateRequestSchema<Options extends BindUpdateRequestOptions> =
  z.ZodObject<UpdateShape<Options>, Options['request']['_zod']['config']>;

/** Four request sections with the selected route's wire and decoded field types. */
export type UpdateRequestContentSchema<Options extends BindUpdateRequestOptions,
  Decoded = z.output<UpdateRequestSchema<Options>>, Wire = z.input<UpdateRequestSchema<Options>>> =
  RequestContentSchema<{
    params: z.ZodType<RequestParams<Decoded, Options['route']>, RequestParams<Wire, Options['route']>>;
    body: z.ZodType<RequestBody<Decoded, Options['route']>, RequestBody<Wire, Options['route']>>;
  }>;

export interface UpdateRequestWire<Options extends BindUpdateRequestOptions = BindUpdateRequestOptions> {
  params: RequestParams<z.input<UpdateRequestSchema<Options>>, Options['route']>;
  body: RequestBody<z.input<UpdateRequestSchema<Options>>, Options['route']>;
  query: Record<string, never>;
  headers: Record<string, never>;
}

/** An Update's flat PATCH schema, four-section wire contract and direction helpers. */
export interface BoundUpdateRequest<Options extends BindUpdateRequestOptions = BindUpdateRequestOptions> {
  readonly Request: UpdateRequestSchema<Options>;
  readonly RequestContent: UpdateRequestContentSchema<Options>;
  toContent(request: z.output<UpdateRequestSchema<Options>>): UpdateRequestWire<Options>;
  fromContent(content: UpdateRequestWire<Options>): z.output<UpdateRequestSchema<Options>>;
}

/** Binds the route's parent and item identifiers while keeping unsent PATCH values absent. */
export function bindUpdateRequest<const Options extends BindUpdateRequestOptions>(options: Options): BoundUpdateRequest<Options>;
export function bindUpdateRequest(options: BindUpdateRequestOptions): object {
  return bindPathRequest('Update', options);
}
