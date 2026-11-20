import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Http4xx = `4${Digit}${Digit}` extends `${infer Code extends number}` ? Code : never;
type SpecializedCode = (typeof CLIENT_FAILURE_CODES)['Unauthorized' | 'Forbidden' | 'NotFound' | 'Conflict' | 'UnprocessableEntity'];
type GenericClientFailureCode = Exclude<Http4xx, SpecializedCode>;

/** A client failure with a public error and trace ID for one of the endpoint's 4xx statuses. */
export interface ClientFailureResponse<Code extends GenericClientFailureCode = GenericClientFailureCode> {
  code: Code;
  error: `${string}.${string}`;
  traceId: string;
}
