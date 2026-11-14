import type {AgenticMessagingState} from '@epsilon-asi/langgraph';
import type {LangGraphRunnableConfig} from '@langchain/langgraph';
import {ChatOpenAI} from '@langchain/openai';
import {createAgent} from 'langchain';
import type {GlobalConfig} from '../config/index.js';
import {createReadTools} from './tools/read.js';
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

const describeDefaultContext = (config: GlobalConfig): string[] => {
    const entries = config.defaultContext.map((entry) => {
        const target = entry.kind === 'path' ? `path ${entry.path}` : `files matching ${entry.pattern}`;
        const required = entry.kind === 'path' && entry.required ? ' (required: read it before you answer)' : '';
        return `- ${target}${required}${entry.description ? `: ${entry.description}` : ''}`;
    });
    return entries.length === 0
        ? []
        : ['The project points every agent at this context. Paths are relative to the working directory:', ...entries];
};

/** The system prompt of a repo agent. */
export const buildRepoAgentPrompt = (options: {instructions: string; access: RepoAccess; config: GlobalConfig; cwd: string}): string =>
    [
        'You are a software engineering agent working on a git repository through tools.',
        options.instructions,
        accessPrompt[options.access],
        'The repository is a snapshot of the user\'s checkout, uncommitted and untracked files included. Tool paths are relative to the repository root.',
        `The user ran you from ${options.cwd === '' ? 'the repository root' : `${options.cwd}/`}; read "this package" or "here" as that directory.`,
        'Look things up with the tools before you rely on them, and name the files (path:line) your answer rests on.',
        ...describeDefaultContext(options.config),
        'Reply in concise Markdown for a terminal. Give conclusions and useful explanation, not your private reasoning.',
    ].join('\n\n');

/**
 * A graph node that runs a tool-calling agent over the run's repository sandbox and adds its final reply to the
 * conversation. The graph must be wrapped with `withWorkspace`.
 */
export const createRepoAgentNode = (options: RepoAgentOptions) => {
    const {name, instructions, access = 'read'} = options;

    return async (state: Messages, runtime?: LangGraphRunnableConfig): Promise<Messages> => {
        const {config, workspace, progress, chatModel} = engineerContext(runtime);
        progress?.('preparing the repository sandbox');
        const sandbox = await workspace.open(access === 'write' ? {branch: name} : {});
        const toolkit = new RepoToolkit({sandbox, config, progress});
        const tools = access === 'write' ? [...createReadTools(toolkit), ...createWriteTools(toolkit)] : createReadTools(toolkit);

        const agent = createAgent({
            name,
            model: chatModel ?? createChatModel(config),
            tools,
            systemPrompt: buildRepoAgentPrompt({instructions, access, config, cwd: workspace.cwdIn(sandbox)}),
        });
        progress?.('thinking');
        const result = await agent.invoke(
            {messages: state.messages},
            // Each tool round is a model step and a tool step.
            {recursionLimit: config.maxToolRounds * 2 + 1, ...(runtime?.signal ? {signal: runtime.signal} : {})},
        );

        const reply = result.messages.at(-1);
        return {messages: [{role: 'assistant', content: reply?.text ?? ''}]};
    };
};
