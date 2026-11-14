import type {LocalRepoSearch, Sandbox, SearchResult} from '@epsilon-asi/sandbox';
import {tool} from '@langchain/core/tools';
import {isAbsolute, relative, resolve} from 'node:path';
import type {z} from 'zod/v4';
import type {GlobalConfig} from '../../config/index.js';
import type {ProgressReporter} from '../workspace.js';

/** Lines of a search result preview shown to the model. */
export const DEFAULT_PREVIEW_LINES = 6;

/** What every repo tool works with. One is shared by all tools of an agent run. */
export class RepoToolkit {
    readonly sandbox: Sandbox;
    readonly config: GlobalConfig;
    readonly progress: ProgressReporter;
    /** Repository-relative paths the agent has written or deleted. */
    readonly changedFiles = new Set<string>();
    readonly #offLimits: readonly RegExp[];
    #stale = false;
    #queue: Promise<unknown> = Promise.resolve();

    constructor(options: { sandbox: Sandbox; config: GlobalConfig; progress?: ProgressReporter | undefined }) {
        this.sandbox = options.sandbox;
        this.config = options.config;
        this.progress = options.progress ?? (() => undefined);
        this.#offLimits = ['.git', ...options.config.offLimits, ...options.config.ignore].map(globToRegExp);
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
    }

    /**
     * Resolves a path the model gave (repository-relative, or absolute inside the worktree) to its
     * repository-relative and absolute forms, rejecting paths outside the worktree or off limits.
     */
    resolvePath(path: string): { path: string; absolutePath: string } {
        const root = this.sandbox.worktreePath;
        const toRepoPath = (absolute: string) => relative(root, absolute).split('\\').join('/');
        const inside = (repoPath: string) =>
            repoPath !== '' && repoPath !== '..' && !repoPath.startsWith('../') && !isAbsolute(repoPath);

        let absolutePath = resolve(root, path);
        // Models often write repository paths with a leading slash.
        if (isAbsolute(path) && !inside(toRepoPath(absolutePath))) {
            absolutePath = resolve(root, path.replace(/^\/+/, ''));
        }
        const repoPath = toRepoPath(absolutePath);
        if (!inside(repoPath)) {
            throw new Error(`${path} is outside the repository.`);
        }
        if (this.#offLimits.some((pattern) => pattern.test(repoPath))) {
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
