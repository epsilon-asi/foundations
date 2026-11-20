import type { z } from 'zod/v4';
import { bindPathRequest, type BoundRoute, type RequestBody, type RequestParams } from './bindPathRequest.js';
import type { RequestContentSchema } from './requestContentSchema.js';

export interface BindCreateRequestOptions {
  /** The generated collection route, including any parent parameter aliases. */
  route: BoundRoute & { operation: 'Create' };
  /** Each flat request field and codec is declared here once. */
  request: z.ZodObject;
}

/** The four Create wire sections with the bound flat schema's field codecs. */
export type CreateRequestContentSchema<Options extends BindCreateRequestOptions, Wire = z.input<Options['request']>, Decoded = z.output<Options['request']>> =
  RequestContentSchema<{
    params: z.ZodType<RequestParams<Decoded, Options['route']>, RequestParams<Wire, Options['route']>>;
    body: z.ZodType<RequestBody<Decoded, Options['route']>, RequestBody<Wire, Options['route']>>;
  }>;

/** The wire input to the four sections of a bound Create request. */
export interface CreateRequestWire<Options extends BindCreateRequestOptions = BindCreateRequestOptions> {
  params: RequestParams<z.input<Options['request']>, Options['route']>;
  body: RequestBody<z.input<Options['request']>, Options['route']>;
  query: Record<string, never>;
  headers: Record<string, never>;
}

/** The Create request and its two directions between flat decoded fields and four wire sections. */
export interface BoundCreateRequest<Options extends BindCreateRequestOptions = BindCreateRequestOptions> {
  readonly Request: Options['request'];
  readonly RequestContent: CreateRequestContentSchema<Options>;
  toContent(request: z.output<Options['request']>): CreateRequestWire<Options>;
  fromContent(content: CreateRequestWire<Options>): z.output<Options['request']>;
}

/** Binds the Create route's field locations and codecs to its public request helpers. */
export function bindCreateRequest<const Options extends BindCreateRequestOptions>(options: Options): BoundCreateRequest<Options>;
export function bindCreateRequest(options: BindCreateRequestOptions): object {
  return bindPathRequest('Create', options);
}
