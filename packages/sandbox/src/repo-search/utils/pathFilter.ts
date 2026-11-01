import type { SearchPathScope } from '../types.js';
import { compileGlobs, matchesAnyGlob } from './glob.js';
import { normalizeRepoPath } from './path.js';

/** Predicate over repository-relative paths. */
export type PathPredicate = (repoPath: string) => boolean;

const ACCEPT_ALL: PathPredicate = () => true;

/**
 * Builds the predicate behind every `paths` / `include` / `exclude` option: a path passes when it is listed in
 * `paths` (if given), matches an `include` glob (if any), and matches no `exclude` glob.
 */
export function createPathFilter(scope: SearchPathScope, caseSensitiveGlobs = false): PathPredicate {
  const allowed = scope.paths ? new Set(scope.paths.map(normalizeRepoPath)) : undefined;
  const include = compileGlobs(scope.include, { caseSensitive: caseSensitiveGlobs });
  const exclude = compileGlobs(scope.exclude, { caseSensitive: caseSensitiveGlobs });
  if (!allowed && include.length === 0 && exclude.length === 0) return ACCEPT_ALL;

  return (repoPath) => {
    const normalized = normalizeRepoPath(repoPath);
    if (allowed && !allowed.has(normalized)) return false;
    if (include.length > 0 && !matchesAnyGlob(normalized, include)) return false;
    return !matchesAnyGlob(normalized, exclude);
  };
}
