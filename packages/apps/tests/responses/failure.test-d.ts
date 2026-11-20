import { expectTypeOf } from 'vitest';
import { failure, isFailure, type Failure } from '../../src/responses/failure.js';
import type { NotFoundFailureResponse } from '../../src/responses/notFoundFailure.js';

expectTypeOf(failure.notFound).toEqualTypeOf<() => Failure>();
expectTypeOf(failure.notFound().code).toEqualTypeOf<404>();
expectTypeOf<{ code: 404 }>().not.toExtend<Failure>();
expectTypeOf<NotFoundFailureResponse>().not.toExtend<Failure>();
expectTypeOf<Failure>().not.toExtend<NotFoundFailureResponse>();

declare const returned: Failure | { code: 404; title: string };
if (isFailure(returned)) {
  expectTypeOf(returned).toEqualTypeOf<Failure>();
} else {
  expectTypeOf(returned.title).toEqualTypeOf<string>();
}
