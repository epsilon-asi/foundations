import type { z } from 'zod/v4';
import { ApiDefinitionError } from './ApiDefinitionError.js';
import { pathParameters } from './pathParameterNames.js';

export interface PathRequestFieldsOptions {
  /** Declared route template. */
  path: string;
  /** Flat request schema for the endpoint. */
  request: z.ZodObject;
  /** Maps parameter names to request fields. Defaults to matching names. */
  paramFields?: Readonly<Record<string, string>>;
}

/** Resolves the request field for each parameter in the route template. */
export function pathRequestFields({ path, paramFields }: Pick<PathRequestFieldsOptions, 'path' | 'paramFields'>) {
  return pathParameters(path).map(({ name: param, optional }) => {
    const field = paramFields && Object.hasOwn(paramFields, param) ? paramFields[param] : param;
    return { param, field, optional };
  });
}

/** Checks that every parameter maps to a declared field on the flat request. */
export function assertPathRequestFields({ path, request, paramFields }: PathRequestFieldsOptions): void {
  for (const { param, field } of pathRequestFields({ path, paramFields })) {
    if (!Object.hasOwn(request.shape, field)) {
      throw new ApiDefinitionError(`Route "${path}" parameter "${param}" has no request field "${field}".`);
    }
  }
}
