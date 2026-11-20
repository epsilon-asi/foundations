import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

/** Wire errors for the framework's 401 response. */
export const AUTHENTICATION_ERRORS = Object.freeze({
  Unauthenticated: 'Auth.UNAUTHENTICATED',
  TokenExpired: 'Auth.TOKEN_EXPIRED',
});

/** A 401 response that distinguishes an expired access token from other authentication failures. */
export interface AuthenticationFailureResponse {
  code: typeof CLIENT_FAILURE_CODES.Unauthorized;
  error: (typeof AUTHENTICATION_ERRORS)[keyof typeof AUTHENTICATION_ERRORS];
  traceId: string;
}
