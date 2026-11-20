import type { z } from 'zod/v4';

/** The decoded flat request accepted by the endpoint's handler. */
export type RequestOf<E extends { readonly Request: z.core.$ZodType }> = z.output<E['Request']>;

/** The decoded success data, or void when every possible endpoint omits the response schema. */
export type ResponseDataOf<E extends { readonly ResponseData: z.core.$ZodType | undefined }> =
  [E['ResponseData']] extends [never] ? never :
  E['ResponseData'] extends undefined ? void : z.output<Exclude<E['ResponseData'], undefined>>;

/** The decoded success or failure envelope returned by the endpoint. */
export type ResponseTypeUnionOf<E extends { readonly ResponseTypeUnion: z.core.$ZodType }> = z.output<E['ResponseTypeUnion']>;
