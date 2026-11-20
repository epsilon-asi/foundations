import type { z } from 'zod/v4';
import { bindPathRequest, type BoundRoute, type RequestParams, type RouteField } from './bindPathRequest.js';
import type { BoundPathParamNames } from './crudRouteMetadata.js';
import type { RequestContentSchema } from './requestContentSchema.js';

export interface BindItemRequestOptions {
  /** An enabled Get or Delete route, including its model ID mapping. */
  route: BoundRoute & { operation: 'Get' | 'Delete' };
  /** Flat schemas for the route's path fields. A self route takes an empty object. */
  request: z.ZodObject;
}

type ItemShape<Options extends BindItemRequestOptions, Shape extends z.core.$ZodShape = Options['request']['shape'],
  Fields = RouteField<Options['route'], BoundPathParamNames<Options['route']['path']>>> = {
  [Key in keyof Shape]: string extends Fields ? z.ZodOptional<Shape[Key]> : z.ZodNonOptional<Shape[Key]>;
};

/** The Get or Delete request accepts only its declared path fields. */
export type ItemRequestSchema<Options extends BindItemRequestOptions> = z.ZodObject<ItemShape<Options>, z.core.$strict>;

/** Get and Delete carry wire and decoded path parameters with three empty sections. */
export type ItemRequestContentSchema<Options extends BindItemRequestOptions> = RequestContentSchema<{
  params: z.ZodType<RequestParams<z.output<ItemRequestSchema<Options>>, Options['route']>, RequestParams<z.input<ItemRequestSchema<Options>>, Options['route']>>;
}>;

export interface ItemRequestWire<Options extends BindItemRequestOptions = BindItemRequestOptions> {
  params: RequestParams<z.input<ItemRequestSchema<Options>>, Options['route']>;
  body: Record<string, never>;
  query: Record<string, never>;
  headers: Record<string, never>;
}

export interface BoundItemRequest<Options extends BindItemRequestOptions = BindItemRequestOptions> {
  readonly Request: ItemRequestSchema<Options>;
  readonly RequestContent: ItemRequestContentSchema<Options>;
  toContent(request: z.output<ItemRequestSchema<Options>>): ItemRequestWire<Options>;
  fromContent(content: ItemRequestWire<Options>): z.output<ItemRequestSchema<Options>>;
}

/** Binds Get and Delete path fields to their flat input and four wire sections. */
export function bindItemRequest<const Options extends BindItemRequestOptions>(options: Options): BoundItemRequest<Options>;
export function bindItemRequest(options: BindItemRequestOptions): object {
  return bindPathRequest('Item', options);
}
