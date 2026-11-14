import type {AgenticMessagingState} from '@epsilon-asi/langgraph';
import {GraphRecursionError, type LangGraphRunnableConfig} from '@langchain/langgraph';
import {ChatOpenAI} from '@langchain/openai';
import {posix} from 'node:path';
import {createAgent} from 'langchain';
import type {GlobalConfig} from '../config/index.js';
import {createReadTools} from './tools/read.js';
import {createTaskTools} from './tools/task.js';
import {RepoToolkit} from './tools/shared.js';
import {createWriteTools} from './tools/write.js';
import {engineerContext} from './workspace.js';

/** `read` agents search and read the repository; `write` agents can also change files on a branch of their own. */
export type RepoAccess = 'read' | 'write';

export interface RepoAgentOptions {
    /** Names the agent; a `write` agent's branch is `agent-engineer/<name>-<id>`. */
    name: string;
    /** What the agent is for and how it should work, added to the shared repo-agent prompt. */
    instructions: string;
    /** Default: 'read'. */
    access?: RepoAccess;
}

type Messages = Pick<typeof AgenticMessagingState.State, 'messages'>;

/** An agent used up `maxToolRounds` without giving its answer. */
export class ToolRoundLimitError extends Error {
    readonly agent: string;
    readonly maxToolRounds: number;

    constructor(options: { agent: string; maxToolRounds: number; cause?: unknown }) {
        super(
            `The ${options.agent} agent did not finish within ${options.maxToolRounds} tool rounds. ` +
            'Narrow the request, or raise maxToolRounds in agent-engineer.yaml.',
            {cause: options.cause},
        );
        this.name = 'ToolRoundLimitError';
        this.agent = options.agent;
        this.maxToolRounds = options.maxToolRounds;
    }
}

/**
 * The recursion limit that lets an agent make `maxToolRounds` tool rounds and then answer. Measured on createAgent:
 * each round is a model step and a tool step, and answering takes two more (tests/graphs/lifecycle.test.ts pins it).
 */
export const recursionLimitFor = (maxToolRounds: number): number => maxToolRounds * 2 + 2;

// By name as well as class, in case another copy of @langchain/langgraph threw it.
const isRecursionError = (error: unknown): boolean =>
    error instanceof GraphRecursionError || (error instanceof Error && error.name === 'GraphRecursionError');

/** The chat model an agent runs on: the config's `model`, through the Responses API. */
export const createChatModel = (config: Pick<GlobalConfig, 'model'>) =>
    new ChatOpenAI({model: config.model, useResponsesApi: true, zdrEnabled: true, maxRetries: 2});

const accessPrompt: Record<RepoAccess, string> = {
    read: 'You can read the repository but not change it. Never claim to have changed a file.',
    write: [
        'You change the repository with write_file, edit_file and delete_file. Your changes go to a branch of their own',
        'and are committed when you finish, so make every change the request needs, then stop.',
        'Read a file before you edit it, keep to the style around your change, and change nothing the request does not need.',
    ].join(' '),
};

/**
 * The config's default context as one prompt section, or none when it is empty. Config paths are relative to the
 * directory the CLI runs in (`cwd`, repository-relative); the prompt gives them relative to the repository root, as
 * the tools take them.
 */
const describeDefaultContext = (config: GlobalConfig, cwd: string): string[] => {
    const toRepoPath = (path: string) => {
        const joined = posix.normalize(posix.join(cwd, path));
        return joined === '..' || joined.startsWith('../') ? path : joined;
    };
    const entries = config.defaultContext.map((entry) => {
        const target = entry.kind === 'path' ? `path ${toRepoPath(entry.path)}` : `files matching ${entry.pattern}`;
        const required = entry.kind === 'path' && entry.required ? ' (required: read it before you answer)' : '';
        return `- ${target}${required}${entry.description ? `: ${entry.description}` : ''}`;
    });
    return entries.length === 0 ? [] : [['The project points every agent at this context:', ...entries].join('\n')];
};

const taskPrompt: Record<RepoAccess, string> = {
    read: 'run_task runs the repository\'s tests, builds and other tasks in a container; use it when running something settles the question.',
    write: 'run_task runs the repository\'s tests, builds and other tasks in a container. Run the tests your change affects before you finish, and fix what fails.',
};

export interface RepoAgentPromptOptions {
    instructions: string;
    access: RepoAccess;
    config: GlobalConfig;
    /** The directory the user ran the CLI from, repository-relative. */
    cwd: string;
    /** Whether the agent has run_task. Default: false. */
    canRunTasks?: boolean;
}

/** The system prompt of a repo agent. */
export const buildRepoAgentPrompt = (options: RepoAgentPromptOptions): string =>
    [
        'You are a software engineering agent working on a git repository through tools.',
        options.instructions,
        accessPrompt[options.access],
        ...(options.canRunTasks ? [taskPrompt[options.access]] : []),
        'The repository is a snapshot of the user\'s checkout, uncommitted and untracked files included. Tool paths are relative to the repository root.',
        `The user ran you from ${options.cwd === '' ? 'the repository root' : `${options.cwd}/`}; read "this package" or "here" as that directory.`,
        'Look things up with the tools before you rely on them, and name the files (path:line) your answer rests on.',
        ...describeDefaultContext(options.config, options.cwd),
        'Reply in concise Markdown for a terminal. Give conclusions and useful explanation, not your private reasoning.',
    ].join('\n\n');

/**
 * A graph node that runs a tool-calling agent over the run's repository sandbox and adds its final reply to the
 * conversation. The graph must be wrapped with `withWorkspace`.
 */
export const createRepoAgentNode = (options: RepoAgentOptions) => {
    const {name, instructions, access = 'read'} = options;

    return async (state: Messages, runtime?: LangGraphRunnableConfig): Promise<Messages> => {
        const {config, workspace, progress, models} = engineerContext(runtime);
        progress?.(workspace.container ? 'preparing the repository sandbox and its container' : 'preparing the repository sandbox');
        const sandbox = await workspace.open(access === 'write' ? {branch: name} : {});
        const cwd = workspace.cwdIn(sandbox);
        const toolkit = new RepoToolkit({sandbox, config, progress, runDirectory: cwd});
        const canRunTasks = sandbox.container !== undefined;
        const tools = [
            ...createReadTools(toolkit),
            ...(access === 'write' ? createWriteTools(toolkit) : []),
            ...(canRunTasks ? createTaskTools(toolkit) : []),
        ];

        const agent = createAgent({
            name,
            model: models?.agent ?? createChatModel(config),
            tools,
            systemPrompt: buildRepoAgentPrompt({instructions, access, config, cwd, canRunTasks}),
        });
        progress?.('thinking');
        const result = await agent.invoke(
            {messages: state.messages},
            {
                recursionLimit: recursionLimitFor(config.maxToolRounds),
                // The node's callbacks carry tracing and run recorders into the agent's model and tool calls.
                ...(runtime?.callbacks ? {callbacks: runtime.callbacks} : {}),
                ...(runtime?.signal ? {signal: runtime.signal} : {}),
            },
        ).catch((error: unknown) => {
            throw isRecursionError(error) ? new ToolRoundLimitError({agent: name, maxToolRounds: config.maxToolRounds, cause: error}) : error;
        });

        const reply = result.messages.at(-1);
        return {messages: [{role: 'assistant', content: reply?.text ?? ''}]};
    };
};
