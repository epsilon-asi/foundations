import {ChildProcessCommandExecutor, type CommandExecutor, type LocalRepoSearch, type Sandbox, type SearchResult} from '@epsilon-asi/sandbox';
import {existsSync} from 'node:fs';
import {tool} from '@langchain/core/tools';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import type {z} from 'zod/v4';
import type {GlobalConfig} from '../../config/index.js';
import type {ProgressReporter} from '../workspace.js';

/** Lines of a search result preview shown to the model. */
export const DEFAULT_PREVIEW_LINES = 6;

/** A file of the repository, and whether the read tools can read it. */
export interface RepoFile {
    /** Repository-relative, with forward slashes. */
    readonly path: string;
    /** False for files the code search did not index: larger than `maxContextFileSizeBytes`, or not text. */
    readonly readable: boolean;
}

/** What every repo tool works with. One is shared by all tools of an agent run. */
export class RepoToolkit {
    readonly sandbox: Sandbox;
    readonly config: GlobalConfig;
    readonly progress: ProgressReporter;
    /** The directory the user ran the CLI from, repository-relative ('' at the root). */
    readonly runDirectory: string;
    /** Repository-relative paths the agent has written or deleted. */
    readonly changedFiles = new Set<string>();
    readonly #offLimits: readonly RegExp[];
    #stale = false;
    #queue: Promise<unknown> = Promise.resolve();

    readonly #executor: CommandExecutor;
    #files: Promise<readonly RepoFile[]> | undefined;

    constructor(options: {
        sandbox: Sandbox;
        config: GlobalConfig;
        progress?: ProgressReporter | undefined;
        /** Runs git on the host to list the worktree's files. Default: a ChildProcessCommandExecutor. */
        executor?: CommandExecutor | undefined;
        /** The directory the user ran the CLI from, repository-relative. Default: '' (the root). */
        runDirectory?: string | undefined;
    }) {
        this.sandbox = options.sandbox;
        this.config = options.config;
        this.runDirectory = options.runDirectory ?? '';
        this.progress = options.progress ?? (() => undefined);
        this.#executor = options.executor ?? new ChildProcessCommandExecutor();
        this.#offLimits = ['.git', ...options.config.offLimits, ...options.config.ignore].map(globToRegExp);
    }

    /** Whether a repository-relative path is off limits (`.git`, the config's `offLimits` and `ignore`). */
    isOffLimits(repoPath: string): boolean {
        return this.#offLimits.some((pattern) => pattern.test(repoPath));
    }

    /**
     * Every file of the worktree that git does not ignore and that is not off limits, sorted, including the ones
     * too large or not text to read. Listed again after a write.
     */
    files(): Promise<readonly RepoFile[]> {
        this.#files ??= this.#listFiles();
        return this.#files;
    }

    async #listFiles(): Promise<readonly RepoFile[]> {
        const root = this.sandbox.worktreePath;
        const result = await this.#executor.run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: root});
        if (result.exitCode !== 0) {
            throw new Error(`Listing the repository's files failed: ${result.stderr.trim()}`);
        }
        // Documents are what the search indexed as text; `files` also holds binaries it discovered but could not read.
        const indexed = new Set((await this.search()).documents.map((document) => document.path));
        // --cached also lists tracked files deleted from the worktree, hence the existence check.
        return [...new Set(result.stdout.split('\0'))]
            .filter((path) => path !== '' && !this.isOffLimits(path) && existsSync(join(root, path)))
            .sort()
            .map((path) => ({path, readable: indexed.has(path)}));
    }

    /** The sandbox's code search, re-indexed when files changed since it was last used. */
    async search(): Promise<LocalRepoSearch> {
        const search = await this.sandbox.search({refresh: this.#stale});
        this.#stale = false;
        return search;
    }

    /** Runs `task` after every task queued before it, so parallel tool calls that write cannot interleave. */
    serial<T>(task: () => Promise<T>): Promise<T> {
        const result = this.#queue.then(task);
        this.#queue = result.catch(() => undefined);
        return result;
    }

    /** Marks the search index stale after a write. */
    touched(path: string): void {
        this.changedFiles.add(path);
        this.#stale = true;
        this.#files = undefined;
    }

    /**
     * Resolves a path the model gave (repository-relative, or absolute inside the worktree) to its
     * repository-relative and absolute forms, rejecting paths outside the worktree or off limits.
     */
    resolvePath(path: string): { path: string; absolutePath: string } {
        const root = this.sandbox.worktreePath;
        // Only the platform separator separates segments: on POSIX, a backslash is an ordinary filename character.
        const toRepoPath = (absolute: string) => relative(root, absolute).split(sep).join('/');
        const inside = (repoPath: string) =>
            repoPath !== '' && repoPath !== '..' && !repoPath.startsWith('../') && !isAbsolute(repoPath);

        // An absolute path at or under the worktree is taken as it is. Any other absolute path is read as
        // repository-relative, since models often write repository paths with a leading slash.
        const underRoot = path === root || path.startsWith(`${root}${sep}`);
        const absolutePath = isAbsolute(path) && !underRoot ? resolve(root, path.replace(/^[\\/]+/, '')) : resolve(root, path);
        const repoPath = toRepoPath(absolutePath);
        if (!inside(repoPath)) {
            throw new Error(`${path} is outside the repository.`);
        }
        if (this.isOffLimits(repoPath)) {
            throw new Error(`${repoPath} is off limits.`);
        }
        return {path: repoPath, absolutePath};
    }
}

/**
 * Converts a gitignore-style pattern (`*`, `**`, `?`, a leading `/` anchors it to the root) to a regular expression
 * that matches the path itself and everything inside it.
 */
export const globToRegExp = (pattern: string): RegExp => {
    const trimmed = pattern.trim().replace(/\/+$/, '');
    const anchored = trimmed.startsWith('/');
    const body = trimmed
        .replace(/^\/+/, '')
        .split(/(\*\*\/?|\*|\?)/)
        .map((part) => {
            if (part === '**/') return '(?:.*/)?';
            if (part === '**') return '.*';
            if (part === '*') return '[^/]*';
            if (part === '?') return '[^/]';
            return part.replace(/[|\\{}()[\]^$+.]/g, '\\$&');
        })
        .join('');
    return new RegExp(`${anchored ? '^' : '(?:^|/)'}${body}(?:/|$)`);
};

export interface RepoToolDefinition<Schema extends z.ZodObject> {
    name: string;
    description: string;
    schema: Schema;
    /** What the progress line says while the tool runs. Default: the tool name. */
    describe?: (input: z.infer<Schema>) => string;
    /**
     * Run one at a time with the toolkit's other serial tools, in the order the model called them. Models make
     * parallel tool calls, so every tool that writes sets this. Default: false.
     */
    serial?: boolean;
    run: (input: z.infer<Schema>) => Promise<string> | string;
}

/**
 * Defines a tool for a repo agent. Progress is reported before it runs, and errors come back to the model as the
 * tool's answer, so it can correct itself rather than the run failing.
 */
export const defineRepoTool = <Schema extends z.ZodObject>(
    toolkit: RepoToolkit,
    definition: RepoToolDefinition<Schema>,
) =>
    tool(
        async (input: z.infer<Schema>) => {
            const run = async () => {
                toolkit.progress(definition.describe?.(input) ?? definition.name);
                try {
                    return await definition.run(input);
                } catch (error) {
                    return `Error: ${error instanceof Error ? error.message : String(error)}`;
                }
            };
            return definition.serial === true ? await toolkit.serial(run) : await run();
        },
        {name: definition.name, description: definition.description, schema: definition.schema},
    );

/** Formats search results as `path:line` headings with an indented preview. */
export const formatSearchResults = (results: readonly SearchResult[], previewLines = DEFAULT_PREVIEW_LINES): string => {
    if (results.length === 0) {
        return 'No results.';
    }
    return results
        .map((result) => {
            const lines = result.endLine > result.line ? `${result.line}-${result.endLine}` : `${result.line}`;
            const preview = result.preview.split('\n').slice(0, previewLines).map((line) => `    ${line}`).join('\n');
            return `${result.path}:${lines}\n${preview}`;
        })
        .join('\n\n');
};
