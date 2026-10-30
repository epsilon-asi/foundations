import type { z } from 'zod/v4';
import type { TypeExtension } from './types';

/**
 * Declares a type extension. Exists for inference: the key stays a literal and the
 * `decorators` callback is typed by the `field` and `type` option schemas.
 */
export function defineTypeExtension<
  TKey extends string,
  TField extends z.ZodType | undefined = undefined,
  TType extends z.ZodType | undefined = undefined,
  TDecorators extends object = {},
>(
  extension: TypeExtension<TKey, TField, TType, TDecorators>,
): TypeExtension<TKey, TField, TType, TDecorators> {
  return Object.freeze({ ...extension });
}
