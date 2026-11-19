export function isLogError(value: object): value is Error {
  return value instanceof Error || (
    !(Symbol.toStringTag in value) && Object.prototype.toString.call(value) === '[object Error]'
  );
}

/** Expose standard Error properties alongside enumerable application metadata. */
export function getLogErrorFields(error: Error): Record<string, unknown> {
  const keys = new Set([...Object.keys(error), 'name', 'message']);
  if ('stack' in error) keys.add('stack');
  if (Object.hasOwn(error, 'cause')) keys.add('cause');
  if (Object.hasOwn(error, 'errors')) keys.add('errors'); // AggregateError.errors is non-enumerable.

  const fields: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    // Read on demand so a field removed by redaction never invokes its getter.
    Object.defineProperty(fields, key, {
      enumerable: true,
      get() {
        const value: unknown = Reflect.get(error, key);
        return key === 'toJSON' && typeof value === 'function' ? undefined : value;
      },
    });
  }
  return fields;
}
