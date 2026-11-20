import { z } from 'zod/v4';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import type { DeclaredOption } from './declaredOption.js';

/** The declared section schemas. Each omitted section accepts an empty object. */
export interface RequestContentSchemaOptions {
  params?: z.core.$ZodType | undefined;
  query?: z.core.$ZodType | undefined;
  body?: z.core.$ZodType | undefined;
  headers?: z.core.$ZodType | undefined;
}

const emptySection = z.strictObject({});

/** A required section that uses the declaration's schema or the strict empty object. */
export type RequestContentSectionSchema<
  Options extends RequestContentSchemaOptions | undefined, Name extends keyof RequestContentSchemaOptions,
> = DeclaredOption<Options, Name> extends infer Declared
  ? unknown extends Declared ? typeof emptySection | z.ZodNonOptional<z.core.$ZodType>
    : Declared extends z.core.$ZodType ? z.ZodNonOptional<Declared> : typeof emptySection
  : never;

/** The endpoint's strict four-section request schema, including each section's wire input and decoded output. */
export type RequestContentSchema<Options extends RequestContentSchemaOptions | undefined = RequestContentSchemaOptions> = z.ZodObject<{
  [Section in keyof RequestContentSchemaOptions]-?: RequestContentSectionSchema<Options, Section>;
}, z.core.$strict>;

function requiredSection(sections: RequestContentSchemaOptions, name: keyof RequestContentSchemaOptions) {
  const schema = sections[name];
  if (schema === undefined) return emptySection;
  if (!(schema instanceof z.core.$ZodType)) throw new ApiDefinitionError(`Request content section "${name}" requires a Zod schema.`);
  return z.nonoptional(schema);
}

/** Builds RequestContent. The wire request always supplies params, query, body and headers. */
export function requestContentSchema<const Options extends RequestContentSchemaOptions | undefined = undefined>(
  ...args: [sections: Options] | (undefined extends Options ? [] : never)
): RequestContentSchema<Options>;
export function requestContentSchema(sections: RequestContentSchemaOptions = {}) {
  return z.strictObject({
    params: requiredSection(sections, 'params'),
    query: requiredSection(sections, 'query'),
    body: requiredSection(sections, 'body'),
    headers: requiredSection(sections, 'headers'),
  });
}
