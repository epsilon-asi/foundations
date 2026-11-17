import {ContextualGraph, type StructuredOutputModel} from '@epsilon-asi/langgraph';
import {
    ChildProcessCommandExecutor,
    type CommandExecutor,
    type CreateWorktreeResult,
    type GitCommitInfo,
    Sandbox,
    type SandboxContainerOptions,
} from '@epsilon-asi/sandbox';
import type {BaseChatModel} from '@langchain/core/language_models/chat_models';
import {randomUUID} from 'node:crypto';
import {mkdirSync, mkdtempSync, realpathSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join, relative, sep} from 'node:path';
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
    /** The chat models the run uses. Default: each one's own default. */
    readonly models?: EngineerModels;
    /** Run the agent's commands (`run_task`) in a Docker container mounted on its worktree. Default: false. */
    readonly container?: boolean;
};

/** The chat models of an engineer run. A type, not an interface, so it fits LangGraph's context type. */
export type EngineerModels = {
    /** The model repo agents run on. Default: the config's `model`, through OpenAI (see `createChatModel`). */
    readonly agent?: BaseChatModel;
    /** The model that parses a request's intent. Default: @epsilon-asi/langgraph's DEFAULT_OPTION_SELECTION_MODEL. */
    readonly intent?: StructuredOutputModel;
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
    /** Runs the git commands the workspace runs itself (deleting an unused branch). Default: a ChildProcessCommandExecutor. */
    executor?: CommandExecutor;
    /** Mount the worktree into a Docker container that runs the sandbox's commands (see `containerOptionsFor`). Default: false. */
    container?: boolean;
}

/** Where the package manager's download cache is kept between container runs when `container.cache` is on. */
export const defaultContainerCacheDir = (): string => join(homedir(), '.easi', 'cache', 'npm');

export interface ContainerOptionsInput {
    /** Host directory mounted as the package manager's cache. */
    cacheDir: string;
    /**
     * `uid:gid` that commands run as, so files they write in the worktree belong to the host user and can be
     * removed with it. Default: the current user's, where the platform has them.
     */
    user?: string | undefined;
}

/** The container a sandbox gets for `--container`, from the config's `container` section. */
export const containerOptionsFor = (config: Pick<GlobalConfig, 'container'>, input: ContainerOptionsInput): SandboxContainerOptions => {
    const user = input.user ?? (process.getuid && process.getgid ? `${process.getuid()}:${process.getgid()}` : undefined);
    return {
        image: config.container.image,
        preset: 'node-typescript',
        installCachePath: input.cacheDir,
        // HOME on the writable /tmp, since the user that commands run as has no home in the image.
        env: {HOME: '/tmp'},
        labels: {[CONTAINER_LABEL]: 'true'},
        ...(user === undefined ? {} : {user}),
        ...(config.container.network ? {} : {security: {network: 'none'}}),
    };
};

/** Label on every container agent-engineer starts, so leftover containers can be found. */
export const CONTAINER_LABEL = 'agent-engineer';

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
 * Disposing removes the worktree. A branch is kept when `commit()` committed to it, and deleted otherwise, so a run
 * that failed or changed nothing leaves no branch behind.
 */
export class RepoWorkspace implements AsyncDisposable {
    readonly config: GlobalConfig;
    readonly cwd: string;
    readonly container: boolean;
    #sandbox: Promise<Sandbox> | undefined;
    #tempDir: string | undefined;
    #committed = false;
    readonly #executor: CommandExecutor;

    constructor(options: RepoWorkspaceOptions) {
        this.config = options.config;
        this.cwd = options.cwd ?? process.cwd();
        this.#executor = options.executor ?? new ChildProcessCommandExecutor();
        this.container = options.container ?? false;
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
        const commit = await sandbox.commit({message});
        this.#committed = true;
        return commit;
    }

    /** The directory the run was started from, relative to the root of `sandbox`'s repository ('' at the root). */
    cwdIn(sandbox: Sandbox): string {
        return relative(realpathSync(sandbox.worktree.repoRoot), realpathSync(this.cwd)).split(sep).join('/');
    }

    async dispose(): Promise<void> {
        const pending = this.#sandbox;
        this.#sandbox = undefined;
        try {
            const sandbox = await pending?.catch(() => undefined);
            await sandbox?.dispose();
            if (sandbox !== undefined && !this.#committed) {
                await this.#deleteBranch(sandbox.worktree);
            }
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

    /** Deletes the branch the sandbox was created on, once its worktree is gone. A failure here is not worth failing the run for. */
    async #deleteBranch({branchName, repoRoot}: Pick<CreateWorktreeResult, 'branchName' | 'repoRoot'>): Promise<void> {
        if (branchName !== null) {
            await this.#executor.run('git', ['branch', '-D', branchName], {cwd: repoRoot}).catch(() => undefined);
        }
    }

    async #create({branch}: OpenWorkspaceOptions): Promise<Sandbox> {
        this.#tempDir = mkdtempSync(join(tmpdir(), 'agent-engineer-'));
        let container: SandboxContainerOptions | undefined;
        if (this.container) {
            // Without a shared cache, each run downloads into a cache of its own, removed with the run.
            const cacheDir = this.config.container.cache ? defaultContainerCacheDir() : join(this.#tempDir, 'cache');
            mkdirSync(cacheDir, {recursive: true});
            container = containerOptionsFor(this.config, {cacheDir});
        }
        const sandbox = await Sandbox.create({
            repoPath: this.cwd,
            worktreePath: join(this.#tempDir, 'worktree'),
            ...(branch === undefined ? {} : {branchName: `${DEFAULT_BRANCH_PREFIX}/${branch}-${randomUUID().slice(0, 8)}`}),
            overlayWorkingChanges: true,
            includeUntracked: true,
            taskTimeoutMs: this.config.container.taskTimeoutSeconds * 1000,
            ...(container === undefined ? {} : {container}),
            search: {
                includeHidden: true,
                maxFileBytes: this.config.maxContextFileSizeBytes,
                exclude: offLimitsGlobs(this.config),
            },
        });
        // On a branch, the copied working changes get a commit of their own, so the agent's commit holds only its work.
        if (branch !== undefined && sandbox.worktree.overlayApplied) {
            try {
                await sandbox.commit({message: WORKING_CHANGES_COMMIT_MESSAGE});
            } catch (error) {
                // dispose() never sees a sandbox whose creation failed, so it is removed here.
                await sandbox.dispose().catch(() => undefined);
                await this.#deleteBranch(sandbox.worktree);
                throw error;
            }
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
        const {config, cwd, container} = (runtime.context ?? {}) as Partial<EngineerRunContext>;
        if (config === undefined) {
            throw new Error('An engineer graph needs the agent-engineer config: invoke(input, { context: { config } }).');
        }
        return {workspace: new RepoWorkspace({config, ...(cwd === undefined ? {} : {cwd}), ...(container === undefined ? {} : {container})})};
    });

/** The engineer context of a node's runtime, failing loudly when the graph was not wrapped with {@link withWorkspace}. */
export const engineerContext = (runtime: { readonly context?: unknown } | undefined): EngineerContext => {
    // Its own check rather than langgraph's requireContext, so the error says how to fix it: wrap with withWorkspace.
    const context = runtime?.context as Partial<EngineerContext> | undefined;
    if (context?.workspace === undefined || context.config === undefined) {
        throw new Error('This node needs an engineer context. Wrap the graph with withWorkspace() and invoke it with { context: { config } }.');
    }
    return context as EngineerContext;
};
