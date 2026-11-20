import type { ClientFailureResponse } from './clientFailure.js';
import type { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';
import { SERVER_FAILURE_CODES } from './serverFailureCodes.js';

export type FailureStatus = ClientFailureResponse['code'] | CLIENT_FAILURE_CODES | SERVER_FAILURE_CODES;

const serverStatuses = new Set<number>(Object.values(SERVER_FAILURE_CODES));

/** HTTP failure statuses supported by error declarations and endpoint response envelopes. */
export function isFailureStatus(code: unknown): code is FailureStatus {
  return typeof code === 'number' && Number.isInteger(code)
    && ((code >= 400 && code < 500) || serverStatuses.has(code));
}
