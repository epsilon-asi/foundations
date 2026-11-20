import type { SERVER_FAILURE_CODES } from './serverFailureCodes.js';

/** An unexpected server failure identified by its public error code and request trace ID. */
export interface ServerFailureResponse {
  code: typeof SERVER_FAILURE_CODES.InternalServerError;
  error: `${string}.${string}`;
  traceId: string;
}
