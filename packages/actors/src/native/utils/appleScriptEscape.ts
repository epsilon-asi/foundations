/**
 * Escapes arbitrary text for use as an AppleScript string literal.
 * AppleScript string literals are double-quoted and escape double quotes/backslashes.
 */
export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function appleScriptRegexLiteral(value: RegExp | string): string {
  return value instanceof RegExp ? value.source : value;
}
