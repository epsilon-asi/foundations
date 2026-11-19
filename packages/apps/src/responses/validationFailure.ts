/** A 422 response with validation issues keyed by flat request field names. */
export interface ValidationFailureResponse<Field extends string = string> {
  code: 422;
  error: `${string}.${string}`;
  traceId: string;
  issues: { path: Field; message: string; code: string }[];
}
