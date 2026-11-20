/** HTTP status codes for server failures in resource responses. */
export const SERVER_FAILURE_CODES = Object.freeze({
  InternalServerError: 500,
  ServiceUnavailable: 503,
});

export type SERVER_FAILURE_CODES = (typeof SERVER_FAILURE_CODES)[keyof typeof SERVER_FAILURE_CODES];
