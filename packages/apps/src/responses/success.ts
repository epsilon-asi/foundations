import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';

/** HTTP status codes for successful resource responses. */
export const SUCCESS_CODES = Object.freeze({
  Ok: 200,
  Created: 201,
});

export type SUCCESS_CODES = (typeof SUCCESS_CODES)[keyof typeof SUCCESS_CODES];

/** A successful response from an endpoint that declares a data payload. */
export interface SuccessResponse<Data, Code extends SUCCESS_CODES = SUCCESS_CODES> {
  code: Code;
  data: Data;
  message?: string;
}

/** A success envelope for an endpoint with no declared payload. Delete uses the default 200. */
export interface EmptySuccessResponse<Code extends SUCCESS_CODES = typeof SUCCESS_CODES.Ok> {
  code: Code;
  data?: never;
  message?: string;
}

export interface SuccessResponseSchemaOptions<
  Code extends SUCCESS_CODES = SUCCESS_CODES, Data extends z.core.$ZodType | undefined = z.core.$ZodType | undefined,
> {
  /** The endpoint's declared success status. */
  code: Code;
  /** The schema for a required data member. Omit it for an empty success response. */
  data?: Data;
}

type SuccessEnvelope<Code extends SUCCESS_CODES, Data extends z.core.$ZodType | undefined, Direction extends 'input' | 'output'> =
  Data extends z.core.$ZodType
    ? SuccessResponse<Exclude<Direction extends 'input' ? z.input<Data> : z.output<Data>, undefined>, Code>
    : EmptySuccessResponse<Code>;

/** The success envelope schema with its payload's wire input and decoded output. */
export type SuccessResponseSchema<
  Code extends SUCCESS_CODES = SUCCESS_CODES, Data extends z.core.$ZodType | undefined = z.core.$ZodType | undefined,
> = z.ZodType<SuccessEnvelope<Code, Data, 'output'>, SuccessEnvelope<Code, Data, 'input'>>;

const successCodes = new Set(Object.values(SUCCESS_CODES));

/** Builds the endpoint's strict success envelope from its status and optional payload schema. */
export function successResponseSchema<Code extends SUCCESS_CODES, Data extends z.core.$ZodType | undefined>(
  options: SuccessResponseSchemaOptions<Code, Data> & { data: Data },
): SuccessResponseSchema<Code, Data>;
export function successResponseSchema<Code extends SUCCESS_CODES>(
  options: SuccessResponseSchemaOptions<Code, undefined>,
): SuccessResponseSchema<Code, undefined>;
export function successResponseSchema<Code extends SUCCESS_CODES, Data extends z.core.$ZodType | undefined>(
  options: SuccessResponseSchemaOptions<Code, Data>,
): SuccessResponseSchema<Code, Data | undefined>;
export function successResponseSchema({ code, data }: SuccessResponseSchemaOptions): z.ZodType {
  if (!successCodes.has(code)) throw new ApiDefinitionError(`Unsupported endpoint success status "${String(code)}".`);
  const envelope = { code: z.literal(code), message: z.string().optional() };
  if (data === undefined) return z.strictObject(envelope);
  if (!(data instanceof z.core.$ZodType)) throw new ApiDefinitionError(`Success response ${code} requires a Zod schema for data.`);
  return z.strictObject({ ...envelope, data: z.nonoptional(data) });
}
