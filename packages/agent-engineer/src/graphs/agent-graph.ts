import type {LangGraphRunnableConfig} from '@langchain/langgraph';
import {END, START, StateGraph} from '@langchain/langgraph';
import {createRepoAgentNode, type RepoAgentOptions} from '../agents/repo-agent.js';
import {engineerContext} from '../agents/workspace.js';
import {type EngineerChanges, EngineerState, type EngineerStateType} from './state.js';

export type AgentGraphOptions = RepoAgentOptions;

/** Commits a change agent's work and records the branch, so the caller can review and merge it. */
const createCommitNode = (name: string) => async (state: EngineerStateType, runtime?: LangGraphRunnableConfig) => {
    const {workspace, progress} = engineerContext(runtime);
    progress?.('committing the changes');
    const request = state.messages.findLast((message) => message.role === 'user')?.content ?? name;
    const commit = await workspace.commit(`agent-engineer (${name}): ${request.split('\n')[0]!.slice(0, 72)}`);
    if (commit === undefined || commit.branchName === null) {
        return {changes: undefined};
    }
    const sandbox = await workspace.open();
    const files = (await sandbox.changedFiles({baseRef: `${commit.headSha}~1`})).map((entry) => entry.path);
    const changes: EngineerChanges = {branch: commit.branchName, commit: commit.headSha, files};
    return {changes};
};

/**
 * The graph of one intent: a repo agent following `instructions`. With `access: 'write'` the agent works on a branch
 * of its own, and its changes are committed to it when it finishes. Invoke it through the router, or wrap it with
 * `withWorkspace` to run it on its own.
 */
export const createAgentGraph = (options: AgentGraphOptions) => {
    const graph = new StateGraph(EngineerState).addNode('agent', createRepoAgentNode(options)).addEdge(START, 'agent');
    if (options.access !== 'write') {
        return graph.addEdge('agent', END).compile({name: options.name});
    }
    return graph
        .addNode('commit', createCommitNode(options.name))
        .addEdge('agent', 'commit')
        .addEdge('commit', END)
        .compile({name: options.name});
};
