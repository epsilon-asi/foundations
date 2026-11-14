import {ContextualGraph} from '@epsilon-asi/langgraph';
import {type GitCommitInfo, Sandbox} from '@epsilon-asi/sandbox';
import type {BaseChatModel} from '@langchain/core/language_models/chat_models';
import type {LangGraphRunnableConfig} from '@langchain/langgraph';
import {randomUUID} from 'node:crypto';
import {mkdtempSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import type {GlobalConfig} from '../config/index.js';

/** Prefix of every branch a change agent commits to. */
export const DEFAULT_BRANCH_PREFIX = 'agent-engineer';

/** Message of the commit that records the working changes a change agent started from. */
export const WORKING_CHANGES_COMMIT_MESSAGE = 'agent-engineer: working changes the agent started from';

/** Reports what an agent is doing, e.g. to a live line. */
export type ProgressReporter = (text: string) => void;

/** What the caller passes in `invoke(input, { context })`. A type, not an interface, so it fits LangGraph's context type. */
export type EngineerRunContext = {
    /** The merged agent-engineer config. */
    readonly config: GlobalConfig;
    /** Directory the repository is found from. Default: process.cwd(). */
    readonly cwd?: string;
    /** Called as agents read and change files. Default: nothing is reported. */
    readonly progress?: ProgressReporter;
    /** The chat model agents run on. Default: the config's `model`, through OpenAI (see `createChatModel`). */
    readonly chatModel?: BaseChatModel;
};

/** The runtime context every engineer node reads: the run context plus the workspace created for the run. */
export type EngineerContext = EngineerRunContext & {
    readonly workspace: RepoWorkspace;
};

export interface RepoWorkspaceOptions {
    /** The merged agent-engineer config. */
    config: GlobalConfig;
    /** Directory the repository is found from. Default: process.cwd(). */
    cwd?: string;
}

export interface OpenWorkspaceOptions {
    /**
     * Create a branch named `agent-engineer/<branch>-<id>` and check it out, so changes can be committed.
     * Default: no branch, for read-only work.
     */
    branch?: string;
}

/**
 * The repository an engineer run works on. The first `open()` creates a {@link Sandbox}: a git worktree of the
 * repository in a temporary directory with the working changes (untracked files included) copied in, so agents
 * see the repository as it is and never touch the checkout itself. Later calls return the same sandbox.
 * Disposing removes the worktree; a branch and its commits are kept.
 */
export class RepoWorkspace implements AsyncDisposable {
    readonly config: GlobalConfig;
    readonly cwd: string;
    #sandbox: Promise<Sandbox> | undefined;
    #tempDir: string | undefined;

    constructor(options: RepoWorkspaceOptions) {
        this.config = options.config;
        this.cwd = options.cwd ?? process.cwd();
    }

    /** The run's sandbox, created on first use. The options of the first call decide whether it has a branch. */
    open(options: OpenWorkspaceOptions = {}): Promise<Sandbox> {
        this.#sandbox ??= this.#create(options);
        return this.#sandbox;
    }

    /** Whether `open()` has been called. */
    get opened(): boolean {
        return this.#sandbox !== undefined;
    }

    /** Commits everything changed in the sandbox, or returns undefined when nothing changed. */
    async commit(message: string): Promise<GitCommitInfo | undefined> {
        if (this.#sandbox === undefined) {
            return undefined;
        }
        const sandbox = await this.#sandbox;
        if ((await sandbox.status()).length === 0) {
            return undefined;
        }
        return await sandbox.commit({message});
    }

    /** The directory the run was started from, relative to the root of `sandbox`'s repository ('' at the root). */
    cwdIn(sandbox: Sandbox): string {
        return relative(realpathSync(sandbox.worktree.repoRoot), realpathSync(this.cwd)).split('\\').join('/');
    }

    async dispose(): Promise<void> {
        const sandbox = this.#sandbox;
        this.#sandbox = undefined;
        try {
            await (await sandbox?.catch(() => undefined))?.dispose();
        } finally {
            if (this.#tempDir !== undefined) {
                rmSync(this.#tempDir, {recursive: true, force: true});
                this.#tempDir = undefined;
            }
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
        await this.dispose();
    }

    async #create({branch}: OpenWorkspaceOptions): Promise<Sandbox> {
        this.#tempDir = mkdtempSync(join(tmpdir(), 'agent-engineer-'));
        const sandbox = await Sandbox.create({
            repoPath: this.cwd,
            worktreePath: join(this.#tempDir, 'worktree'),
            ...(branch === undefined ? {} : {branchName: `${DEFAULT_BRANCH_PREFIX}/${branch}-${randomUUID().slice(0, 8)}`}),
            overlayWorkingChanges: true,
            includeUntracked: true,
            search: {
                includeHidden: true,
                maxFileBytes: this.config.maxContextFileSizeBytes,
                exclude: offLimitsGlobs(this.config),
            },
        });
        // On a branch, the copied working changes get a commit of their own, so the agent's commit holds only its work.
        if (branch !== undefined && sandbox.worktree.overlayApplied) {
            await sandbox.commit({message: WORKING_CHANGES_COMMIT_MESSAGE});
        }
        return sandbox;
    }
}

/** Every configured `ignore` and `offLimits` pattern as search exclude globs, covering what is inside directories too. */
export const offLimitsGlobs = (config: Pick<GlobalConfig, 'ignore' | 'offLimits'>): string[] =>
    [...config.ignore, ...config.offLimits].flatMap((pattern) => {
        const trimmed = pattern.replace(/\/+$/, '');
        return trimmed === '' ? [] : [trimmed, `${trimmed}/**`];
    });

/**
 * Wraps a compiled graph so every `invoke` gets a {@link RepoWorkspace} in its runtime context, removed again when
 * the run ends, even when a node throws. Callers pass {@link EngineerRunContext} as `context`.
 */
export const withWorkspace = <Graph extends { invoke: (input: any, options?: any) => Promise<any> }>(graph: Graph): Graph =>
    ContextualGraph(graph, (_input, runtime) => {
        const {config, cwd} = (runtime.context ?? {}) as Partial<EngineerRunContext>;
        if (config === undefined) {
            throw new Error('An engineer graph needs the agent-engineer config: invoke(input, { context: { config } }).');
        }
        return {workspace: new RepoWorkspace({config, ...(cwd === undefined ? {} : {cwd})})};
    });

/** The engineer context of a node's runtime, failing loudly when the graph was not wrapped with {@link withWorkspace}. */
export const engineerContext = (runtime: LangGraphRunnableConfig | undefined): EngineerContext => {
    // Not requireContext: @epsilon-asi/langgraph is typed against the CommonJS build of @langchain/core, so its
    // LangGraphRunnableConfig is a different type from the one ESM code here gets.
    const context = runtime?.context as Partial<EngineerContext> | undefined;
    if (context?.workspace === undefined || context.config === undefined) {
        throw new Error('This node needs an engineer context. Wrap the graph with withWorkspace() and invoke it with { context: { config } }.');
    }
    return context as EngineerContext;
};
