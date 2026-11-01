import * as path from 'node:path';
import { RepoSearchError } from '../errors.js';

/** Convert Windows separators to POSIX-style separators for stable repo-relative keys. */
export function toPosixPath(input: string): string {
  return input.replace(/\\+/g, '/');
}

export function trimLeadingSlash(input: string): string {
  return input.replace(/^\/+/, '');
}

export function trimTrailingSlash(input: string): string {
  return input.replace(/\/+$/, '');
}

/** Repository-relative key: forward slashes, no leading `./` or `/`. */
export function normalizeRepoPath(input: string): string {
  return trimLeadingSlash(toPosixPath(input).replace(/^\.\//, ''));
}

/** `absolutePath` relative to `root`, as a normalized repository path. */
export function relativePath(root: string, absolutePath: string): string {
  return normalizeRepoPath(path.relative(root, absolutePath));
}

export function isInsideRoot(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolves `candidate` (relative to `root`, or absolute) and rejects paths outside `root`. */
export function resolveInsideRoot(root: string, candidate: string): string {
  const resolved = path.resolve(root, candidate);
  if (!isInsideRoot(root, resolved)) throw new RepoSearchError(`Path escapes search root: ${candidate}`);
  return resolved;
}

export function extensionOf(repoPath: string): string {
  return path.extname(repoPath).toLowerCase();
}

const LANGUAGE_BY_BASENAME: ReadonlyMap<string, string> = new Map([
  ['dockerfile', 'dockerfile'],
  ['makefile', 'makefile'],
  ['gemfile', 'ruby'],
  ['rakefile', 'ruby'],
]);

const LANGUAGE_BY_EXTENSION: ReadonlyMap<string, string> = new Map(
  Object.entries({
    typescript: ['.ts'],
    typescriptreact: ['.tsx'],
    javascript: ['.js', '.mjs', '.cjs'],
    javascriptreact: ['.jsx'],
    json: ['.json'],
    python: ['.py'],
    go: ['.go'],
    rust: ['.rs'],
    java: ['.java'],
    kotlin: ['.kt', '.kts'],
    csharp: ['.cs'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    c: ['.c', '.h'],
    ruby: ['.rb'],
    php: ['.php'],
    swift: ['.swift'],
    scala: ['.scala'],
    shell: ['.sh', '.bash', '.zsh'],
    markdown: ['.md', '.mdx'],
    yaml: ['.yaml', '.yml'],
    toml: ['.toml'],
    xml: ['.xml'],
    html: ['.html', '.htm'],
    css: ['.css'],
    scss: ['.scss', '.sass'],
    sql: ['.sql'],
    graphql: ['.graphql', '.gql'],
  }).flatMap(([language, extensions]) => extensions.map((extension) => [extension, language] as const)),
);

/** Language id for a path: well-known filenames first, then the extension, else the bare extension or `text`. */
export function languageForPath(repoPath: string): string {
  const base = path.basename(repoPath).toLowerCase();
  if (base.endsWith('.dockerfile')) return 'dockerfile';
  const extension = extensionOf(repoPath);
  return (
    LANGUAGE_BY_BASENAME.get(base) ?? LANGUAGE_BY_EXTENSION.get(extension) ?? (extension ? extension.slice(1) : 'text')
  );
}

/** True when any path segment is a dotfile or dot-directory. */
export function isHiddenRepoPath(repoPath: string): boolean {
  return normalizeRepoPath(repoPath)
    .split('/')
    .some((part) => part.length > 1 && part.startsWith('.'));
}
