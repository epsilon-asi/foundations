import type { SERVER_FAILURE_CODES } from './serverFailureCodes.js';

/** The JSON body when a dependency is temporarily unavailable. */
export interface UnavailableFailureResponse {
  code: typeof SERVER_FAILURE_CODES.ServiceUnavailable;
  error: `${string}.${string}`;
  traceId: string;
}

/** The HTTP response carries the retry delay or HTTP date in the Retry-After header. */
export interface UnavailableFailureHttpResponse {
  body: UnavailableFailureResponse;
  headers: {
    'Retry-After': string;
    [name: string]: string;
  };
}
