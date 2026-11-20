import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

/** A 404 response for a missing resource or one outside the caller's scope. */
export interface NotFoundFailureResponse {
  code: typeof CLIENT_FAILURE_CODES.NotFound;
  error: `${string}.${string}`;
  traceId: string;
}
