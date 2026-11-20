import { z } from 'zod/v4';
import { AUTHENTICATION_ERRORS, type AuthenticationFailureResponse } from '../responses/authenticationFailure.js';
import type { AuthorizationFailureResponse } from '../responses/authorizationFailure.js';
import type { ClientFailureResponse } from '../responses/clientFailure.js';
import { CLIENT_FAILURE_CODES } from '../responses/clientFailureCodes.js';
import type { ConflictFailureResponse } from '../responses/conflictFailure.js';
import { failureFields } from '../responses/failureFields.js';
import { isFailureStatus, type FailureStatus } from '../responses/failureStatus.js';
import type { NotFoundFailureResponse } from '../responses/notFoundFailure.js';
import type { ServerFailureResponse } from '../responses/serverFailure.js';
import type { EmptySuccessResponse, SUCCESS_CODES, SuccessResponse } from '../responses/success.js';
import type { UnavailableFailureResponse } from '../responses/unavailableFailure.js';
import { validationFailureSchema, type ValidationFailureResponse } from '../responses/validationFailure.js';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import type { DeclaredOption } from './declaredOption.js';
import { defaultFailureCodes, type DefaultFailureCodeFor, type DefaultFailureCodesOptions } from './defaultFailureCodes.js';

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

export interface EndpointResponseTypeUnionOptions<Response extends SuccessSchema = SuccessSchema, Code extends FailureStatus = FailureStatus>
  extends DefaultFailureCodesOptions, Pick<ResponseTypeUnionOptions<Response, Code>, 'response'> {
  /** Replaces the derived statuses. Omit the list to use the endpoint's defaults. */
  failures?: readonly Code[] | undefined;
}

/** The schema type of an endpoint's ResponseTypeUnion member, with separate wire input and decoded output. */
export type ResponseTypeUnion<Response extends SuccessSchema = SuccessSchema, Code extends FailureStatus = FailureStatus> =
  z.ZodType<z.output<Response> | FailureFor<Code>, z.input<Response> | FailureFor<Code>>;

type DeclaredFailureCode<Options extends EndpointResponseTypeUnionOptions, Failures = DeclaredOption<Options, 'failures'>> =
  | (unknown extends Failures ? FailureStatus : Failures extends readonly (infer Code extends FailureStatus)[] ? Code : never)
  | (undefined extends Failures ? DefaultFailureCodeFor<Options> : never);

/** The response schema for an endpoint declaration with derived or explicitly selected failures. */
export type EndpointResponseTypeUnion<Options extends EndpointResponseTypeUnionOptions = EndpointResponseTypeUnionOptions> =
  ResponseTypeUnion<Options['response'], Options extends unknown ? DeclaredFailureCode<Options> : never>;

const authentication = z.strictObject({
  code: z.literal(CLIENT_FAILURE_CODES.Unauthorized),
  error: z.enum(AUTHENTICATION_ERRORS),
  traceId: failureFields.traceId,
}) satisfies z.ZodType<AuthenticationFailureResponse>;

function failureEnvelope(code: FailureStatus) {
  if (!isFailureStatus(code)) throw new ApiDefinitionError(`Unsupported endpoint failure status "${String(code)}".`);
  if (code === CLIENT_FAILURE_CODES.Unauthorized) return authentication;
  if (code === CLIENT_FAILURE_CODES.UnprocessableEntity) return validationFailureSchema;
  return z.strictObject({ code: z.literal(code), ...failureFields });
}

/** Builds the endpoint's response schema. A declaration with no failure list uses its route defaults. */
export function responseTypeUnion<const Options extends EndpointResponseTypeUnionOptions>(options: Options): EndpointResponseTypeUnion<Options>;
export function responseTypeUnion<Response extends SuccessSchema, const Code extends FailureStatus>(
  options: ResponseTypeUnionOptions<Response, Code>,
): ResponseTypeUnion<Response, Code>;
export function responseTypeUnion(options: EndpointResponseTypeUnionOptions | ResponseTypeUnionOptions): z.ZodType {
  const { response, failures: declared } = options;
  const failures = declared === undefined && 'path' in options && typeof options.path === 'string'
    ? defaultFailureCodes(options) : declared;
  if (!Array.isArray(failures)) throw new ApiDefinitionError('Endpoint failures must be an array of HTTP failure statuses.');
  const [first, ...rest] = Array.from(new Set(failures), failureEnvelope);
  if (!first) return response;
  // Handle a known failure before running any of the application's success payload codecs.
  const failure = rest.length ? z.discriminatedUnion('code', [first, ...rest]) : first;
  return z.union([failure, response]);
}
