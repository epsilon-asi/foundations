import { isRecord } from '../shared/objects.js';

export function assertNonEmptyArray<T>(value: readonly T[], message: string): asserts value is [T, ...T[]] {
  if (value.length === 0) {
    throw new TypeError(message);
  }
}

/** Keeps only the string-valued entries of an unknown value; non-objects become `{}`. */
export function coerceStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
