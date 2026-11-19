import { getLogErrorFields, isLogError } from './errorFields.js';
import type { LogFields } from './logger.js';

export interface LogRedactionOptions {
  /** Exact, case-sensitive field names to omit at any depth. Default: none. */
  readonly keys?: readonly string[];
  /** Return true to omit this field name at any depth. Default: none. */
  readonly shouldRedact?: (key: string) => boolean;
}

/** Prepare structured data before passing it to any writer. */
export function prepareLogFields(fields: LogFields, redaction?: LogRedactionOptions): LogFields {
  const redact = Boolean(redaction?.keys?.length || redaction?.shouldRedact);
  const ancestors = new WeakSet<object>();

  function visit(value: unknown): unknown {
    if (typeof value !== 'object' || value === null) return value;
    if (ancestors.has(value)) return '[Circular]';
    if (redact && value instanceof Date) {
      // Use the built-in conversion so a custom toJSON cannot reintroduce omitted fields.
      return Number.isNaN(Date.prototype.getTime.call(value)) ? null : Date.prototype.toISOString.call(value);
    }

    ancestors.add(value);
    const error = isLogError(value);
    const source = error ? getLogErrorFields(value) : value as Record<string, unknown>;
    const copy = Array.isArray(value) ? new Array(value.length) : Object.create(null);
    if (redact && Array.isArray(copy) && 'toJSON' in copy) {
      Object.defineProperty(copy, 'toJSON', { value: undefined, configurable: true });
    }
    let changed = redact || error;

    for (const key of Object.keys(source)) {
      if (redaction?.keys?.includes(key) || redaction?.shouldRedact?.(key)) continue;
      // A getter can replace its own descriptor as soon as it is read.
      if (!changed && Object.getOwnPropertyDescriptor(source, key)?.get) changed = true;
      const original = source[key];
      if (redact && typeof original === 'function') continue;
      const prepared = visit(original);
      // Defining own data properties also handles a field named __proto__ on an array.
      Object.defineProperty(copy, key, { value: prepared, enumerable: true, configurable: true, writable: true });
      if (!Object.is(original, prepared)) changed = true;
    }

    ancestors.delete(value);
    return changed ? copy : value;
  }

  return visit(fields) as LogFields;
}
