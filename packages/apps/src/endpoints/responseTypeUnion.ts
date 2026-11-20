import { z } from 'zod/v4';
import { AUTHENTICATION_ERRORS, type AuthenticationFailureResponse } from '../responses/authenticationFailure.js';
import type { AuthorizationFailureResponse } from '../responses/authorizationFailure.js';
import type { ClientFailureResponse } from '../responses/clientFailure.js';
import { CLIENT_FAILURE_CODES } from '../responses/clientFailureCodes.js';
import type { ConflictFailureResponse } from '../responses/conflictFailure.js';
import { isFailureStatus, type FailureStatus } from '../responses/failureStatus.js';
import type { NotFoundFailureResponse } from '../responses/notFoundFailure.js';
import type { ServerFailureResponse } from '../responses/serverFailure.js';
import type { EmptySuccessResponse, SUCCESS_CODES, SuccessResponse } from '../responses/success.js';
import type { UnavailableFailureResponse } from '../responses/unavailableFailure.js';
import type { ValidationFailureResponse } from '../responses/validationFailure.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';

type Success = SuccessResponse<unknown> | EmptySuccessResponse<SUCCESS_CODES>;
type SuccessSchema = z.ZodType<Success, Success>;
type SpecializedFailure = AuthenticationFailureResponse | AuthorizationFailureResponse | NotFoundFailureResponse
  | ConflictFailureResponse | ValidationFailureResponse | ServerFailureResponse | UnavailableFailureResponse;
type FailureFor<Code extends FailureStatus> = Code extends ClientFailureResponse['code']
  ? ClientFailureResponse<Code> : Extract<SpecializedFailure, { code: Code }>;

export interface ResponseTypeUnionOptions<Response extends SuccessSchema = SuccessSchema, Code extends FailureStatus = FailureStatus> {
  /** The endpoint's success envelope, including any wire codecs on its payload. */
  response: Response;
  /** The resolved failure statuses for this endpoint. An empty list admits success alone. */
  failures: readonly Code[];
}

/** The schema type of an endpoint's ResponseTypeUnion member, with separate wire input and decoded output. */
export type ResponseTypeUnion<Response extends SuccessSchema = SuccessSchema, Code extends FailureStatus = FailureStatus> =
  z.ZodType<z.output<Response> | FailureFor<Code>, z.input<Response> | FailureFor<Code>>;

const errorPart = z.string().regex(/[^.\s]+/);
const failureFields = { error: z.templateLiteral([errorPart, '.', errorPart]), traceId: z.string() };
const authentication = z.strictObject({
  code: z.literal(CLIENT_FAILURE_CODES.Unauthorized),
  error: z.enum(AUTHENTICATION_ERRORS),
  traceId: failureFields.traceId,
}) satisfies z.ZodType<AuthenticationFailureResponse>;
const validation = z.strictObject({
  code: z.literal(CLIENT_FAILURE_CODES.UnprocessableEntity),
  ...failureFields,
  issues: z.array(z.strictObject({ path: z.string(), message: z.string(), code: z.string() })),
}) satisfies z.ZodType<ValidationFailureResponse>;

function failureEnvelope(code: FailureStatus) {
  if (!isFailureStatus(code)) throw new ApiDefinitionError(`Unsupported endpoint failure status "${String(code)}".`);
  if (code === CLIENT_FAILURE_CODES.Unauthorized) return authentication;
  if (code === CLIENT_FAILURE_CODES.UnprocessableEntity) return validation;
  return z.strictObject({ code: z.literal(code), ...failureFields });
}

/** Builds the endpoint's bidirectional schema for its success and declared failure envelopes. */
export function responseTypeUnion<Response extends SuccessSchema, const Code extends FailureStatus>(
  options: ResponseTypeUnionOptions<Response, Code>,
): ResponseTypeUnion<Response, Code>;
export function responseTypeUnion({ response, failures }: ResponseTypeUnionOptions): z.ZodType {
  if (!Array.isArray(failures)) throw new ApiDefinitionError('Endpoint failures must be an array of HTTP failure statuses.');
  const [first, ...rest] = Array.from(new Set(failures), failureEnvelope);
  if (!first) return response;
  // Handle a known failure before running any of the application's success payload codecs.
  const failure = rest.length ? z.discriminatedUnion('code', [first, ...rest]) : first;
  return z.union([failure, response]);
}
