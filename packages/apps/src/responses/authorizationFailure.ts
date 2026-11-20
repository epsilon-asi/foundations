import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

/** A 403 response for a member who lacks a required role or permission. */
export interface AuthorizationFailureResponse {
  code: typeof CLIENT_FAILURE_CODES.Forbidden;
  error: `${string}.${string}`;
  traceId: string;
}
