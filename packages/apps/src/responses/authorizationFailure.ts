/** A 403 response for a member who lacks a required role or permission. */
export interface AuthorizationFailureResponse {
  code: 403;
  error: `${string}.${string}`;
  traceId: string;
}
