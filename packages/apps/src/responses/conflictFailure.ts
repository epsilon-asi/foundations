import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

/** A 409 response when the request conflicts with the resource's current state. */
export interface ConflictFailureResponse {
  code: typeof CLIENT_FAILURE_CODES.Conflict;
  error: `${string}.${string}`;
  traceId: string;
}
