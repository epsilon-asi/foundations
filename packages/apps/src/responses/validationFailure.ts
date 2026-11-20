import { z } from 'zod/v4';
import { CLIENT_FAILURE_CODES } from './clientFailureCodes.js';
import { failureFields } from './failureFields.js';
import { requestValidationIssues, type RequestValidationIssuesOptions } from './requestValidationIssues.js';

/** A 422 response with validation issues keyed by flat request field names. */
export interface ValidationFailureResponse<Field extends string = string> {
  code: typeof CLIENT_FAILURE_CODES.UnprocessableEntity;
  error: `${string}.${string}`;
  traceId: string;
  issues: { path: Field; message: string; code: string }[];
}

export interface ValidationFailureResponseOptions extends Pick<RequestValidationIssuesOptions, 'path' | 'paramFields'>,
  Pick<ValidationFailureResponse, 'error' | 'traceId'> {
  /** The error from validating the endpoint's RequestContent. */
  zodError: z.core.$ZodError;
}

export const validationFailureSchema = z.strictObject({
  code: z.literal(CLIENT_FAILURE_CODES.UnprocessableEntity),
  ...failureFields,
  issues: z.array(z.strictObject({ path: z.string(), message: z.string(), code: z.string() })),
}) satisfies z.ZodType<ValidationFailureResponse>;

/** Builds the endpoint's 422 response with field issues from request-content validation. */
export function validationFailureResponse({ path, paramFields, zodError, error, traceId }: ValidationFailureResponseOptions): ValidationFailureResponse {
  if (!(zodError instanceof z.core.$ZodError)) throw new TypeError('A validation failure response requires a Zod error.');
  return validationFailureSchema.parse({
    code: CLIENT_FAILURE_CODES.UnprocessableEntity,
    error, traceId,
    issues: requestValidationIssues({ path, paramFields, issues: zodError.issues }),
  });
}
