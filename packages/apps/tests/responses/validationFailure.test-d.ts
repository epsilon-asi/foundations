import { expectTypeOf } from 'vitest';
import type { ValidationFailureResponse } from '../../src/index.js';

type OfferingRequest = { name: string; price: number };
type Failure = ValidationFailureResponse<keyof OfferingRequest>;
const failure: Failure = {
  code: 422,
  error: 'Offering.INVALID',
  traceId: 'trace-1',
  issues: [{ path: 'price', message: 'offering.price.range', code: 'too_small' }],
};

expectTypeOf(failure.issues[0].path).toEqualTypeOf<keyof OfferingRequest>();
expectTypeOf<ValidationFailureResponse['issues'][number]>()
  .toEqualTypeOf<{ path: string; message: string; code: string }>();

// @ts-expect-error A 422 response requires its field issues.
const missingIssues: Failure = { code: 422, error: failure.error, traceId: failure.traceId };
// @ts-expect-error Every failure identifies its request.
const missingTrace: Failure = { code: 422, error: failure.error, issues: failure.issues };
// @ts-expect-error Every failure carries its wire error identifier.
const missingError: Failure = { code: 422, traceId: failure.traceId, issues: failure.issues };
// @ts-expect-error The status discriminates this response from other failures.
const wrongStatus: Failure = { ...failure, code: 400 };
// @ts-expect-error The path is a flat field name.
const pathSegments: Failure['issues'][number] = { ...failure.issues[0], path: ['body', 'price'] };
// @ts-expect-error A known request limits issue paths to its declared fields.
const unknownField: Failure['issues'][number] = { ...failure.issues[0], path: 'status' };
