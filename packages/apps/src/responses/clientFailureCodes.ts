/** HTTP status codes for the resource framework's client failures. */
export const CLIENT_FAILURE_CODES = Object.freeze({
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
});

export type CLIENT_FAILURE_CODES = (typeof CLIENT_FAILURE_CODES)[keyof typeof CLIENT_FAILURE_CODES];
