/** HTTP status codes for successful resource responses. */
export const SUCCESS_CODES = Object.freeze({
  Ok: 200,
  Created: 201,
});

export type SUCCESS_CODES = (typeof SUCCESS_CODES)[keyof typeof SUCCESS_CODES];

/** A successful response from an endpoint that declares a data payload. */
export interface SuccessResponse<Data> {
  code: SUCCESS_CODES;
  data: Data;
  message?: string;
}
