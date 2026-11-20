import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

/** A 422 response with validation issues keyed by flat request field names. */
export interface ValidationFailureResponse<Field extends string = string> {
  code: typeof CLIENT_FAILURE_CODES.UnprocessableEntity;
  error: `${string}.${string}`;
  traceId: string;
  issues: { path: Field; message: string; code: string }[];
}
