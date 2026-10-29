import type { NativeWindowInfo, WindowMatcher } from './types.js';

function matchesRegex(value: string, regex: RegExp | string): boolean {
  const expression = typeof regex === 'string' ? new RegExp(regex) : regex;
  return expression.test(value);
}

function matchesOptional(actual: string | undefined, expected: string | undefined): boolean {
  return expected === undefined || actual === expected;
}

export function matchesWindow(info: NativeWindowInfo, matcher: WindowMatcher): boolean {
  if (!matchesOptional(info.appName, matcher.appName)) return false;
  if (!matchesOptional(info.bundleId, matcher.bundleId)) return false;
  if (!matchesOptional(info.role, matcher.role)) return false;
  if (matcher.title !== undefined && info.title !== matcher.title) return false;
  if (matcher.titleIncludes !== undefined && !info.title.includes(matcher.titleIncludes)) return false;
  if (matcher.titleRegex !== undefined && !matchesRegex(info.title, matcher.titleRegex)) return false;
  return true;
}

export function matcherToString(matcher: WindowMatcher): string {
  const parts: string[] = [];
  if (matcher.appName !== undefined) parts.push(`app=${matcher.appName}`);
  if (matcher.bundleId !== undefined) parts.push(`bundle=${matcher.bundleId}`);
  if (matcher.title !== undefined) parts.push(`title=${matcher.title}`);
  if (matcher.titleIncludes !== undefined) parts.push(`titleIncludes=${matcher.titleIncludes}`);
  if (matcher.titleRegex !== undefined) parts.push(`titleRegex=${String(matcher.titleRegex)}`);
  if (matcher.role !== undefined) parts.push(`role=${matcher.role}`);
  return parts.length === 0 ? '<any window>' : parts.join(', ');
}
