import type { Dirent, Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CommandExecutionError, isSuccessfulResult, type CommandExecutor } from '../../shared/index.js';
import { RepoSearchError } from '../errors.js';
import type { RepoFileEntry, ResolvedRepositorySearchOptions } from '../types.js';
import { mapConcurrent } from '../utils/async.js';
import { applyGitStyleGlobRules, compileGlobs, type CompiledGlob } from '../utils/glob.js';
import { createPathFilter, type PathPredicate } from '../utils/pathFilter.js';
import {
  extensionOf,
  isHiddenRepoPath,
  languageForPath,
  normalizeRepoPath,
  relativePath,
  trimLeadingSlash,
  trimTrailingSlash,
} from '../utils/path.js';
import { splitLines } from '../utils/text.js';
import { resolveExecutor } from './options.js';

export interface DiscoveryResult {
  files: RepoFileEntry[];
  source: 'git' | 'filesystem';
  /** Candidate paths rejected by filters, size limits, or unreadable entries. */
  skipped: number;
}

const GIT_PROBE_TIMEOUT_MS = 5_000;
const GIT_LIST_TIMEOUT_MS = 60_000;
const GIT_LIST_MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

/**
 * Lists the searchable files under `options.root`: from `git ls-files` when the root is inside a Git work tree
 * (and `useGit` is set), otherwise by walking the filesystem. Both sources go through the same file filters.
 */
export async function discoverFiles(options: ResolvedRepositorySearchOptions): Promise<DiscoveryResult> {
  const stats = await fs.stat(options.root);
  if (!stats.isDirectory()) throw new RepoSearchError(`Search root is not a directory: ${options.root}`);

  const selector = new FileSelector(options);
  const gitPaths = options.useGit ? await listGitPaths(resolveExecutor(options), options.root) : undefined;
  const files = gitPaths ? await selector.selectListed(gitPaths) : await selector.walk(options.root, []);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, source: gitPaths ? 'git' : 'filesystem', skipped: selector.skipped };
}

/**
 * Files tracked or untracked-but-not-ignored by Git, or `undefined` when Git cannot list them: the root is not in a
 * work tree, a command fails or times out, `git` cannot be spawned, or the listing exceeds the output limit.
 */
async function listGitPaths(executor: CommandExecutor, root: string): Promise<string[] | undefined> {
  try {
    const probe = await executor.run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root,
      timeoutMs: GIT_PROBE_TIMEOUT_MS,
    });
    if (!isSuccessfulResult(probe) || probe.stdout.trim() !== 'true') return undefined;
    const listing = await executor.run('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', '.'], {
      cwd: root,
      timeoutMs: GIT_LIST_TIMEOUT_MS,
      maxOutputBytes: GIT_LIST_MAX_OUTPUT_BYTES,
    });
    if (!isSuccessfulResult(listing)) return undefined;
    return listing.stdout.split('\0').map(normalizeRepoPath).filter(Boolean);
  } catch (error) {
    // Git could not run (not installed, or more output than we buffer): walk the filesystem instead.
    if (error instanceof CommandExecutionError) return undefined;
    throw error;
  }
}

/** The acceptance pipeline shared by Git and filesystem discovery, counting every rejected candidate. */
class FileSelector {
  skipped = 0;
  private readonly options: ResolvedRepositorySearchOptions;
  private readonly excludedDirectories: ReadonlySet<string>;
  private readonly notExcluded: PathPredicate;
  private readonly included: PathPredicate;

  constructor(options: ResolvedRepositorySearchOptions) {
    this.options = options;
    this.excludedDirectories = new Set(options.defaultExcludedDirectories);
    this.notExcluded = createPathFilter({ exclude: options.exclude });
    this.included = createPathFilter({ include: options.include });
  }

  /** Filters an explicit path listing (from Git). */
  async selectListed(repoPaths: readonly string[]): Promise<RepoFileEntry[]> {
    const entries = await mapConcurrent(repoPaths, this.options.concurrency, (repoPath) =>
      this.isPrunedPath(repoPath)
        ? Promise.resolve(this.skip())
        : this.acceptFile(repoPath, path.resolve(this.options.root, repoPath)),
    );
    return entries.filter((entry) => entry !== undefined);
  }

  /** Walks `directory`, applying .gitignore rules inherited from its ancestors plus its own. */
  /** Walks `directory` recursively, appending accepted files to `files` (never spread: trees can hold millions). */
  async walk(
    directory: string,
    inheritedRules: readonly CompiledGlob[],
    files: RepoFileEntry[] = [],
  ): Promise<RepoFileEntry[]> {
    const base = relativePath(this.options.root, directory);
    const rules = this.options.respectGitIgnore
      ? [...inheritedRules, ...(await readGitignoreRules(directory, base))]
      : inheritedRules;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      this.skip();
      return files;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const repoPath = relativePath(this.options.root, absolutePath);
      const isDirectory = entry.isDirectory();
      if (this.isPrunedPath(repoPath) || applyGitStyleGlobRules(isDirectory ? `${repoPath}/` : repoPath, rules)) {
        this.skip();
      } else if (isDirectory) {
        await this.walk(absolutePath, rules, files);
      } else if (entry.isSymbolicLink() && !this.options.followSymlinks) {
        this.skip();
      } else {
        const file = await this.acceptFile(repoPath, absolutePath);
        if (file) files.push(file);
      }
    }
    return files;
  }

  /** Path rules that also prune whole directories: hidden entries, default-excluded names, `exclude` globs. */
  private isPrunedPath(repoPath: string): boolean {
    return (
      (!this.options.includeHidden && isHiddenRepoPath(repoPath)) ||
      repoPath.split('/').some((segment) => this.excludedDirectories.has(segment)) ||
      !this.notExcluded(repoPath)
    );
  }

  /** File-only rules: `include` globs, allowed extensions, then a regular file within the size limit. */
  private async acceptFile(repoPath: string, absolutePath: string): Promise<RepoFileEntry | undefined> {
    const { allowedExtensions, maxFileBytes } = this.options;
    if (!this.included(repoPath)) return this.skip();
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(extensionOf(repoPath))) return this.skip();

    let stats: Stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch {
      return this.skip();
    }
    if (!stats.isFile() || stats.size > maxFileBytes) return this.skip();
    return {
      path: repoPath,
      absolutePath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      extension: extensionOf(repoPath),
      language: languageForPath(repoPath),
    };
  }

  private skip(): undefined {
    this.skipped += 1;
    return undefined;
  }
}

async function readGitignoreRules(directory: string, base: string): Promise<CompiledGlob[]> {
  let content: string;
  try {
    content = await fs.readFile(path.join(directory, '.gitignore'), 'utf8');
  } catch {
    return [];
  }
  const patterns = splitLines(content)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((pattern) => scopeIgnorePattern(pattern, base));
  return compileGlobs(patterns);
}

/**
 * Rewrites a pattern from `<base>/.gitignore` relative to the search root. As in Git, a pattern containing a
 * slash is anchored to the .gitignore's directory; otherwise it matches at any depth below it.
 */
export function scopeIgnorePattern(pattern: string, base: string): string {
  if (!base) return pattern;
  const negated = pattern.startsWith('!');
  const body = negated ? pattern.slice(1) : pattern;
  const scoped = trimTrailingSlash(body).includes('/') ? `/${base}/${trimLeadingSlash(body)}` : `/${base}/**/${body}`;
  return negated ? `!${scoped}` : scoped;
}
