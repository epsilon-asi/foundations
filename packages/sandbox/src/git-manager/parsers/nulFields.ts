import { GitOutputParseError } from '../errors.js';

/**
 * Splits `-z` git output into its NUL-terminated fields. Empty fields (the trailing terminator and the blank
 * separators between `worktree list` records) are dropped.
 */
export function splitNulFields(output: string): string[] {
  return output.split('\0').filter((field) => field.length > 0);
}

/** Consumes the next field from `fields`, failing with a {@link GitOutputParseError} when the output ends early. */
export function takeField(fields: Iterator<string, unknown>, output: string, expected: string): string {
  const next = fields.next();

  if (next.done === true) {
    throw new GitOutputParseError(`Unexpected end of git output: expected ${expected}.`, output);
  }

  return next.value;
}
