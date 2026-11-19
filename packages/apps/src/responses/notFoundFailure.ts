/** A 404 response for a missing resource or one outside the caller's scope. */
export interface NotFoundFailureResponse {
  code: 404;
  error: `${string}.${string}`;
  traceId: string;
}
