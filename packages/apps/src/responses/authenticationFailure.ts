/** A 401 response that distinguishes an expired access token from other authentication failures. */
export interface AuthenticationFailureResponse {
  code: 401;
  error: 'Auth.UNAUTHENTICATED' | 'Auth.TOKEN_EXPIRED';
  traceId: string;
}
