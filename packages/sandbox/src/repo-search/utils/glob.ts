import { normalizeRepoPath, trimTrailingSlash } from './path.js';

export interface CompiledGlob {
  raw: string;
  negated: boolean;
  directoryOnly: boolean;
  basenameOnly: boolean;
  regex: RegExp;
}

export interface GlobOptions {
  caseSensitive?: boolean;
}

const REGEX_SPECIAL = /[|\\{}()[\]^$+?.]/g;

/**
 * Convert a small, Git-style glob subset to a regular expression.
 * Supports `*`, `?`, `**`, `!` negation, leading-slash anchoring, and directory-only trailing slashes.
 */
export function compileGlob(pattern: string, options: GlobOptions = {}): CompiledGlob | undefined {
  let raw = pattern.trim();
  if (!raw || raw.startsWith('#')) return undefined;

  const negated = raw.startsWith('!');
  if (negated) raw = raw.slice(1);

  raw = raw.replace(/\\ /g, ' ');
  const directoryOnly = raw.endsWith('/');
  raw = trimTrailingSlash(raw);
  const anchored = raw.startsWith('/');
  raw = normalizeRepoPath(raw);
  const basenameOnly = !raw.includes('/');

  const body = globBodyToRegex(raw);
  const prefix = anchored ? '^' : '(?:^|/)';
  const suffix = directoryOnly ? '(?:/|$)' : '$';

  return {
    raw: pattern,
    negated,
    directoryOnly,
    basenameOnly,
    regex: new RegExp(`${prefix}${body}${suffix}`, options.caseSensitive ? '' : 'i'),
  };
}

export function compileGlobs(patterns: readonly string[] | undefined, options: GlobOptions = {}): CompiledGlob[] {
  return (patterns ?? []).flatMap((pattern) => compileGlob(pattern, options) ?? []);
}

export function matchesAnyGlob(repoPath: string, globs: readonly CompiledGlob[]): boolean {
  const normalized = normalizeRepoPath(repoPath);
  return globs.some((glob) => glob.regex.test(normalized));
}

/** Applies ordered ignore rules: the last matching rule wins, so `!` rules can re-include paths. */
export function applyGitStyleGlobRules(repoPath: string, globs: readonly CompiledGlob[]): boolean {
  const normalized = normalizeRepoPath(repoPath);
  let ignored = false;
  for (const glob of globs) {
    if (glob.regex.test(normalized)) ignored = !glob.negated;
  }
  return ignored;
}

function globBodyToRegex(glob: string): string {
  let regex = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob.charAt(i);
    if (char === '*' && glob.charAt(i + 1) === '*') {
      const slashFollows = glob.charAt(i + 2) === '/';
      regex += slashFollows ? '(?:[^/]+/)*' : '.*';
      i += slashFollows ? 2 : 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += char.replace(REGEX_SPECIAL, '\\$&');
    }
  }
  return regex;
}
