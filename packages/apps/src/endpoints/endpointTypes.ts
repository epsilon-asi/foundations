import type { z } from 'zod/v4';
import type { CrudOperation } from './enabledCrudOperations.js';

/** The decoded flat request accepted by the endpoint's handler. */
export type RequestOf<E extends { readonly Request: z.core.$ZodType }> = z.output<E['Request']>;

/** The wire input for the endpoint's params, query, body and headers. */
export type RequestContentOf<E extends { readonly RequestContent: z.core.$ZodType }> = z.input<E['RequestContent']>;

type NonCrudKind = 'action' | 'transition' | 'stream';
type NonListRoute = { readonly operation: Exclude<CrudOperation, 'List'> } | { readonly kind: NonCrudKind };

/** The decoded query section of a List endpoint, including its declared paging, filters, sorting and search. */
export type ListQueryOf<E extends { readonly RequestContent: z.core.$ZodType<{ query: unknown }> }> =
  E extends NonListRoute | { readonly Kind: NonCrudKind } | { readonly Route: NonListRoute }
    ? never : z.output<E['RequestContent']>['query'];

/** The decoded success envelope, including the endpoint's status and any declared payload. */
export type ResponseOf<E extends { readonly Response: z.core.$ZodType }> = z.output<E['Response']>;

/** The decoded success data, or void when every possible endpoint omits the response schema. */
export type ResponseDataOf<E extends { readonly ResponseData: z.core.$ZodType | undefined }> =
  [E['ResponseData']] extends [never] ? never :
  E['ResponseData'] extends undefined ? void : z.output<Exclude<E['ResponseData'], undefined>>;

/** The decoded success or failure envelope returned by the endpoint. */
export type ResponseTypeUnionOf<E extends { readonly ResponseTypeUnion: z.core.$ZodType }> = z.output<E['ResponseTypeUnion']>;
