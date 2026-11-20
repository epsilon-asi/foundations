import { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';

const handlerFailure = Symbol.for('@epsilon-asi/apps/handlerFailure');

/** A returned handler failure. The HTTP adapter supplies the wire error and request trace ID. */
export interface Failure {
  readonly [handlerFailure]: true;
  readonly code: typeof CLIENT_FAILURE_CODES.NotFound;
}

const notFound: Failure = Object.freeze({ [handlerFailure]: true, code: CLIENT_FAILURE_CODES.NotFound } as const);

/** Failure values a handler can return in place of response data. */
export const failure = Object.freeze({
  /** The requested resource is missing or outside the caller's scope. */
  notFound(): Failure { return notFound; },
});

/** Recognizes a handler return without treating ordinary response data containing a code as a failure. */
export function isFailure(value: unknown): value is Failure {
  if (value === null || typeof value !== 'object') return false;
  return Object.getOwnPropertyDescriptor(value, handlerFailure)?.value === true
    && 'code' in value && value.code === CLIENT_FAILURE_CODES.NotFound;
}
