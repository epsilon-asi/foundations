import * as path from 'node:path';
import { ChildProcessCommandExecutor, type CommandExecutor } from '../../shared/index.js';
import { omitUndefined } from '../../shared/objects.js';
import type { RepositorySearchOptions, ResolvedRepositorySearchOptions } from '../types.js';

/** Directory names skipped anywhere in the tree unless `defaultExcludedDirectories` overrides them. */
export const DEFAULT_SEARCH_EXCLUDED_DIRECTORIES: readonly string[] = [
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'bower_components',
  '.next',
  '.nuxt',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.parcel-cache',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'target',
  'vendor',
  '.gradle',
  '.idea',
  '.vscode',
];

/** Defaults for every optional repository option. */
export const DEFAULT_REPOSITORY_OPTIONS = {
  useGit: true,
  respectGitIgnore: true,
  includeHidden: false,
  followSymlinks: false,
  maxFileBytes: 1024 * 1024,
  include: [],
  exclude: [],
  defaultExcludedDirectories: DEFAULT_SEARCH_EXCLUDED_DIRECTORIES,
  allowedExtensions: [],
  concurrency: 16,
  chunkLines: 160,
  chunkOverlap: 32,
  backend: 'auto',
} as const satisfies Omit<ResolvedRepositorySearchOptions, 'root'>;

export function resolveOptions(options: RepositorySearchOptions): ResolvedRepositorySearchOptions {
  const defaults = DEFAULT_REPOSITORY_OPTIONS;
  return {
    root: path.resolve(options.root),
    useGit: options.useGit ?? defaults.useGit,
    respectGitIgnore: options.respectGitIgnore ?? defaults.respectGitIgnore,
    includeHidden: options.includeHidden ?? defaults.includeHidden,
    followSymlinks: options.followSymlinks ?? defaults.followSymlinks,
    maxFileBytes: options.maxFileBytes ?? defaults.maxFileBytes,
    include: options.include ?? defaults.include,
    exclude: options.exclude ?? defaults.exclude,
    defaultExcludedDirectories: options.defaultExcludedDirectories ?? defaults.defaultExcludedDirectories,
    allowedExtensions: (options.allowedExtensions ?? defaults.allowedExtensions).map(normalizeExtension),
    concurrency: options.concurrency ?? defaults.concurrency,
    chunkLines: options.chunkLines ?? defaults.chunkLines,
    chunkOverlap: options.chunkOverlap ?? defaults.chunkOverlap,
    backend: options.backend ?? defaults.backend,
    ...omitUndefined({ executor: options.executor }),
  };
}

/** The executor that runs `git` and `rg`: the caller's, or a `ChildProcessCommandExecutor`. */
export function resolveExecutor(options: Pick<ResolvedRepositorySearchOptions, 'executor'>): CommandExecutor {
  return options.executor ?? new ChildProcessCommandExecutor();
}

function normalizeExtension(extension: string): string {
  const lower = extension.toLowerCase();
  return lower.startsWith('.') ? lower : `.${lower}`;
}
